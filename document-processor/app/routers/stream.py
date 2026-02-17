"""
SSE streaming endpoint for document processing.

Runs the full processing pipeline (evaluate → vector search → extract text →
match template → extract fields) and yields Server-Sent Events after each stage
so the frontend can show real-time progress.
"""

import asyncio
import json
import logging
import sys
import time
import uuid
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any, AsyncGenerator

from fastapi import APIRouter, UploadFile, File, Query, HTTPException
from fastapi.responses import StreamingResponse

import aiofiles

# Safe logger initialization for Docker environment
try:
    logger = logging.getLogger(__name__)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        )
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
except Exception:
    logging.basicConfig(stream=sys.stdout, level=logging.INFO)
    logger = logging.getLogger(__name__)

from ..services.enhanced_docling_service import enhanced_docling_service
from ..services.document_evaluator import document_evaluator
from ..services.smart_field_extractor import smart_field_extractor
from ..services.embedding_service import embedding_service
from ..config.database import db_config

router = APIRouter(prefix="/api/enhanced-documents", tags=["streaming"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _save_uploaded_file(upload_file: UploadFile) -> Path:
    """Save an uploaded file to a temporary location and return the path."""
    temp_dir = Path(tempfile.gettempdir()) / "docling_uploads"
    temp_dir.mkdir(exist_ok=True)
    file_extension = Path(upload_file.filename or "unknown").suffix
    temp_filename = f"{uuid.uuid4()}{file_extension}"
    temp_path = temp_dir / temp_filename
    async with aiofiles.open(temp_path, "wb") as f:
        content = await upload_file.read()
        await f.write(content)
    return temp_path


async def _cleanup_temp_file(file_path: Path):
    try:
        if file_path.exists():
            file_path.unlink()
    except Exception:
        pass


def _sse_event(event: str, data: dict) -> str:
    """Format a single SSE frame."""
    payload = json.dumps(data, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


# ---------------------------------------------------------------------------
# Streaming pipeline generator
# ---------------------------------------------------------------------------

async def _process_document_stream(
    file_path: Path,
    filename: str,
    content_type: str,
    quick_scan: bool,
    min_match_confidence: float,
    allow_generation: bool,
    organization_id: Optional[str],
) -> AsyncGenerator[str, None]:
    """Async generator that yields SSE events as processing progresses."""

    t0 = time.monotonic()

    def elapsed_ms() -> int:
        return int((time.monotonic() - t0) * 1000)

    # ── Stage 1: received ─────────────────────────────────────────────
    yield _sse_event("stage", {
        "stage": "received",
        "message": f"File received: {filename}",
        "progress": 5,
        "elapsed_ms": elapsed_ms(),
    })

    # ── Stage 2: evaluating ───────────────────────────────────────────
    yield _sse_event("stage", {
        "stage": "evaluating",
        "message": "Evaluating document type...",
        "progress": 10,
        "elapsed_ms": elapsed_ms(),
    })

    try:
        evaluation = await document_evaluator.evaluate_document(
            file_path,
            filename,
            content_type,
            quick_scan=quick_scan,
            organization_id=organization_id,
        )
    except Exception as exc:
        logger.error(f"Evaluation failed: {exc}")
        yield _sse_event("error", {
            "stage": "evaluating",
            "message": f"Document evaluation failed: {exc}",
            "elapsed_ms": elapsed_ms(),
        })
        return

    primary_type = (evaluation.get("type_evaluation") or {}).get("primary_type", "unknown")
    type_confidence = (evaluation.get("type_evaluation") or {}).get("confidence", 0)

    yield _sse_event("stage", {
        "stage": "evaluated",
        "message": f"Document type: {primary_type} ({int(type_confidence * 100)}% confidence)",
        "progress": 25,
        "elapsed_ms": elapsed_ms(),
    })

    suggestions = evaluation.get("template_suggestions", []) or []

    # ── Stage 3: extracting text ──────────────────────────────────────
    yield _sse_event("stage", {
        "stage": "extracting_text",
        "message": "Extracting document text...",
        "progress": 30,
        "elapsed_ms": elapsed_ms(),
    })

    document_text = ""
    extraction_result: Dict[str, Any] = {}
    try:
        extraction_result = await enhanced_docling_service.process_document(
            file_path,
            extract_text=True,
            extract_metadata=True,
            extract_structure=False,
        )
        if extraction_result.get("status") == "completed":
            document_text = extraction_result.get("content", {}).get("text", "")
    except Exception as exc:
        logger.error(f"Text extraction failed: {exc}")
        yield _sse_event("error", {
            "stage": "extracting_text",
            "message": f"Text extraction failed: {exc}",
            "elapsed_ms": elapsed_ms(),
        })
        return

    char_count = len(document_text)
    yield _sse_event("stage", {
        "stage": "text_extracted",
        "message": f"Text extracted: {char_count:,} chars",
        "progress": 45,
        "elapsed_ms": elapsed_ms(),
    })

    # ── Stage 4: vector search / template matching ────────────────────
    if document_text:
        yield _sse_event("stage", {
            "stage": "matching_template",
            "message": "Searching for matching templates...",
            "progress": 50,
            "elapsed_ms": elapsed_ms(),
        })

        try:
            from ..services.template_vector_service import template_vector_service
            if template_vector_service.available:
                doc_embedding = await embedding_service.generate_single_embedding(
                    document_text[:2000]
                )
                if doc_embedding:
                    vector_suggestions = await template_vector_service.search_similar_templates(
                        document_embedding=doc_embedding,
                        limit=5,
                        category_filter=primary_type,
                    )
                    if vector_suggestions:
                        logger.info(
                            f"Vector search returned {len(vector_suggestions)} matches"
                        )
                        suggestions = vector_suggestions
        except Exception as exc:
            logger.warning(f"Vector search failed, using multi-factor scoring: {exc}")

    # ── Stage 4b: test extraction quality on top match ────────────────
    chosen_template: Optional[Dict[str, Any]] = None
    decision_metadata: Dict[str, Any] = {}

    if suggestions and document_text:
        best = suggestions[0]
        template_id = best.get("template_id")

        if template_id and db_config.is_configured and db_config.client:
            try:
                template_result = (
                    db_config.client.table("smart_templates")
                    .select("id, name, smart_variables, category")
                    .eq("id", template_id)
                    .single()
                    .execute()
                )

                if template_result.data:
                    smart_variables = template_result.data.get("smart_variables", [])
                    if smart_variables:
                        test_result = await smart_field_extractor.test_template_extraction(
                            content=document_text,
                            template_variables=smart_variables,
                            confidence_threshold=0.6,
                            provider="azure",
                            organization_id=organization_id,
                        )
                        best["extraction_quality"] = test_result.get("field_success_rate", 0.0)
                        best["avg_field_confidence"] = test_result.get("avg_confidence", 0.0)
                        best["extractable_fields"] = test_result.get("extractable_count", 0)
                        best["total_fields"] = test_result.get("total_fields", 0)
                        best["combined_score"] = (
                            best.get("match_score", 0.0) * best["extraction_quality"]
                        )
            except Exception as exc:
                logger.error(f"Extraction test failed for top match: {exc}")
                best["extraction_quality"] = best.get("match_score", 0.0)
                best["combined_score"] = best.get("match_score", 0.0)

    # Apply 2-way validation thresholds
    if suggestions:
        best = suggestions[0]
        match_score = best.get("match_score", 0.0)
        extraction_quality = best.get("extraction_quality", match_score)

        if match_score >= 0.60 and extraction_quality >= 0.50:
            chosen_template = best

            if match_score >= 0.70 and extraction_quality >= 0.70:
                validation_level = "high_confidence"
            else:
                validation_level = "medium_confidence"

            decision_metadata = {
                "validation_level": validation_level,
                "match_score": match_score,
                "extraction_quality": extraction_quality,
                "combined_score": best.get("combined_score", 0.0),
            }

    if chosen_template:
        tpl_name = chosen_template.get("template_name", "unknown")
        tpl_score = int(chosen_template.get("match_score", 0) * 100)
        yield _sse_event("stage", {
            "stage": "template_matched",
            "message": f"Template matched: {tpl_name} ({tpl_score}%)",
            "progress": 60,
            "elapsed_ms": elapsed_ms(),
        })
    else:
        yield _sse_event("stage", {
            "stage": "template_matched",
            "message": "No strong template match — will generate new template",
            "progress": 60,
            "elapsed_ms": elapsed_ms(),
        })

    # ── Stage 5: extract fields ───────────────────────────────────────
    extracted_fields: Optional[Dict[str, Any]] = None
    generated_template: Optional[Dict[str, Any]] = None

    if chosen_template and document_text:
        yield _sse_event("stage", {
            "stage": "extracting_fields",
            "message": "Extracting fields with matched template...",
            "progress": 65,
            "elapsed_ms": elapsed_ms(),
        })

        template_id = chosen_template.get("template_id")
        try:
            if template_id and db_config.is_configured and db_config.client:
                tpl_row = (
                    db_config.client.table("smart_templates")
                    .select("id, name, smart_variables, category")
                    .eq("id", template_id)
                    .single()
                    .execute()
                )
                if tpl_row.data:
                    smart_vars = tpl_row.data.get("smart_variables", [])
                    if smart_vars:
                        field_result = await smart_field_extractor.extract_fields_intelligently(
                            text_content=document_text,
                            template_variables=smart_vars,
                            confidence_threshold=0.6,
                            provider="azure",
                            organization_id=organization_id,
                        )
                        extracted_fields = field_result.get("extracted_values", {})
        except Exception as exc:
            logger.error(f"Field extraction failed: {exc}")
            yield _sse_event("stage", {
                "stage": "extraction_warning",
                "message": f"Field extraction encountered an error: {exc}",
                "progress": 80,
                "elapsed_ms": elapsed_ms(),
            })

    elif allow_generation and document_text:
        # Generate a new template
        yield _sse_event("stage", {
            "stage": "generating_template",
            "message": "Generating new template with AI...",
            "progress": 65,
            "elapsed_ms": elapsed_ms(),
        })

        try:
            from ..services.ai_template_generator import ai_template_generator

            analysis = await ai_template_generator.analyze_document_structure(file_path)
            template_name = f"{primary_type.title()} Template"
            gen_result = await ai_template_generator.generate_template_from_analysis(
                analysis, template_name
            )

            if gen_result:
                generated_template = gen_result
                gen_vars = gen_result.get("smart_variables", gen_result.get("variables", []))

                yield _sse_event("stage", {
                    "stage": "template_generated",
                    "message": f"Template generated: {gen_result.get('name', template_name)} ({len(gen_vars)} fields)",
                    "progress": 75,
                    "elapsed_ms": elapsed_ms(),
                })

                # Extract fields with generated template
                if gen_vars:
                    yield _sse_event("stage", {
                        "stage": "extracting_fields",
                        "message": "Extracting fields with generated template...",
                        "progress": 80,
                        "elapsed_ms": elapsed_ms(),
                    })

                    field_result = await smart_field_extractor.extract_fields_intelligently(
                        text_content=document_text,
                        template_variables=gen_vars,
                        confidence_threshold=0.6,
                        provider="azure",
                        organization_id=organization_id,
                    )
                    extracted_fields = field_result.get("extracted_values", {})
        except Exception as exc:
            logger.error(f"Template generation failed: {exc}")
            yield _sse_event("stage", {
                "stage": "generation_warning",
                "message": f"Template generation error: {exc}",
                "progress": 80,
                "elapsed_ms": elapsed_ms(),
            })

    fields_count = len(extracted_fields) if extracted_fields else 0
    if extracted_fields:
        yield _sse_event("stage", {
            "stage": "fields_extracted",
            "message": f"Extracted {fields_count} fields",
            "progress": 90,
            "elapsed_ms": elapsed_ms(),
        })

    # ── Stage 6: complete ─────────────────────────────────────────────
    result: Dict[str, Any] = {
        "evaluation": evaluation,
        "content": document_text,
        "metadata": extraction_result.get("metadata", {}),
        "chosen_template": chosen_template,
        "decision_metadata": decision_metadata,
        "extracted_fields": extracted_fields,
        "generated_template": generated_template,
        "alternatives": suggestions[1:5] if suggestions else [],
        "action": "use_existing" if chosen_template else ("generate_new" if generated_template else "no_match"),
    }

    yield _sse_event("complete", {
        "message": "Processing complete",
        "progress": 100,
        "elapsed_ms": elapsed_ms(),
        "result": result,
    })


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/process-document-stream")
async def process_document_stream(
    file: UploadFile = File(...),
    quick_scan: bool = Query(True, description="Use quick evaluation path"),
    min_match_confidence: float = Query(
        0.7, ge=0.0, le=1.0, description="Minimum match score"
    ),
    allow_generation: bool = Query(
        True, description="Allow generating a template when no strong match"
    ),
    organization_id: Optional[str] = Query(
        None, description="Organization ID for org-specific LLM config"
    ),
):
    """
    Stream document processing progress via Server-Sent Events.

    Runs the full pipeline: evaluate → vector search → extract text →
    match template → extract fields.  Each stage emits an SSE event so
    the client can show a live progress log.

    Events:
    - ``event: stage``  — progress update  (``progress``, ``message``, ``elapsed_ms``)
    - ``event: error``  — non-recoverable error in a stage
    - ``event: complete`` — final result payload
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    temp_file_path: Optional[Path] = None

    async def event_stream() -> AsyncGenerator[str, None]:
        nonlocal temp_file_path
        upload_complete = False
        try:
            temp_file_path = await _save_uploaded_file(file)
            upload_complete = True

            async for event in _process_document_stream(
                file_path=temp_file_path,
                filename=file.filename or "unknown",
                content_type=file.content_type or "",
                quick_scan=quick_scan,
                min_match_confidence=min_match_confidence,
                allow_generation=allow_generation,
                organization_id=organization_id,
            ):
                yield event

        except Exception as exc:
            stage = "upload" if not upload_complete else "processing"
            logger.error(f"Stream {stage} error: {exc}")
            yield _sse_event("error", {
                "stage": stage,
                "message": f"{'Upload' if not upload_complete else 'Processing'} failed: {exc}",
                "elapsed_ms": 0,
            })

        finally:
            if temp_file_path:
                await _cleanup_temp_file(temp_file_path)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        },
    )
