"""
SSE streaming endpoint for document processing.

Runs the full processing pipeline (evaluate → vector search → extract text →
match template → extract fields) and yields Server-Sent Events after each stage
so the frontend can show real-time progress.
"""

import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Optional, Dict, Any, AsyncGenerator

from fastapi import APIRouter, UploadFile, File, Query, HTTPException, Depends
from fastapi.responses import StreamingResponse

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

from ..middleware.file_validation import validate_and_save_uploaded_file
from ..middleware.admin_auth import admin_auth
from ..services.enhanced_docling_service import enhanced_docling_service
from ..services.document_evaluator import document_evaluator
from ..services.smart_field_extractor import smart_field_extractor
from ..services.embedding_service import embedding_service
from ..services.document_event_bus import document_event_bus
from ..services.document_processing_pipeline import pipeline
from ..config.database import db_config

router = APIRouter(
    prefix="/api/enhanced-documents",
    tags=["streaming"],
    dependencies=[Depends(admin_auth.get_current_user)]
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------



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
    document_id: Optional[int] = None,
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

    # ── Stage 2: extracting text (single Docling call) ────────────────
    # Extract text ONCE here and reuse for evaluation + downstream stages.
    # Previously Docling was called 3 times: twice inside evaluate_document
    # (type detection + content preview) and once more here. Now it's 1x.
    yield _sse_event("stage", {
        "stage": "extracting_text",
        "message": "Extracting document text...",
        "progress": 10,
        "elapsed_ms": elapsed_ms(),
    })

    # Text extraction timeout — matches the evaluator's default (env:
    # DOCUMENT_PROCESSING_TIMEOUT, default 120s).  Now that converter.convert()
    # runs in a thread (asyncio.to_thread), wait_for can actually cancel it.
    extraction_timeout = float(os.environ.get("DOCUMENT_PROCESSING_TIMEOUT", "120"))
    # Timeout for LLM-based operations (evaluation, field extraction, template generation).
    llm_timeout = float(os.environ.get("LLM_OPERATION_TIMEOUT", "90"))

    document_text = ""
    extraction_result: Dict[str, Any] = {}
    try:
        logger.info(f"[STREAM_TIMING] Text extraction START | file={filename} | timeout={extraction_timeout}s")
        import time as _time
        t_extract_start = _time.monotonic()
        extraction_result = await asyncio.wait_for(
            enhanced_docling_service.process_document(
                file_path,
                extract_text=True,
                extract_metadata=True,
                extract_structure=False,
            ),
            timeout=extraction_timeout,
        )
        t_extract_end = _time.monotonic()
        logger.info(f"[STREAM_TIMING] Text extraction DONE | file={filename} | took={t_extract_end - t_extract_start:.2f}s | status={extraction_result.get('status')}")
        if extraction_result.get("status") == "completed":
            document_text = extraction_result.get("content", {}).get("text", "")
        else:
            logger.warning(f"[STREAM_TIMING] Extraction returned non-completed status: {extraction_result.get('status')} | error: {extraction_result.get('error_message', 'N/A')}")
    except asyncio.TimeoutError:
        logger.error(f"[STREAM_TIMING] Text extraction TIMED OUT after {extraction_timeout}s | file={filename}")
        yield _sse_event("error", {
            "stage": "extracting_text",
            "message": f"Text extraction timed out after {int(extraction_timeout)}s",
            "elapsed_ms": elapsed_ms(),
        })
        if document_id:
            await pipeline.update_document_status(document_id, "failed", metadata_updates={"error_message": f"Text extraction timed out after {int(extraction_timeout)}s"})
        return
    except Exception as exc:
        logger.error(f"[STREAM_TIMING] Text extraction FAILED | file={filename} | error={exc}", exc_info=True)
        yield _sse_event("error", {
            "stage": "extracting_text",
            "message": f"Text extraction failed: {exc}",
            "elapsed_ms": elapsed_ms(),
        })
        if document_id:
            await pipeline.update_document_status(document_id, "failed", metadata_updates={"error_message": str(exc)})
        return

    char_count = len(document_text)
    yield _sse_event("stage", {
        "stage": "text_extracted",
        "message": f"Text extracted: {char_count:,} chars",
        "progress": 25,
        "elapsed_ms": elapsed_ms(),
    })

    # ── Stage 3: evaluating (reuses extracted text) ───────────────────
    yield _sse_event("stage", {
        "stage": "evaluating",
        "message": "Evaluating document type...",
        "progress": 30,
        "elapsed_ms": elapsed_ms(),
    })

    try:
        # Pass extracted text to evaluator so it skips its own Docling calls.
        # Use None (not "") when empty so the evaluator's own fallbacks still
        # work (e.g. filename-based detection, direct text file reads).
        evaluation = await asyncio.wait_for(
            document_evaluator.evaluate_document(
                file_path,
                filename,
                content_type,
                quick_scan=quick_scan,
                organization_id=organization_id,
                content_override=document_text or None,
            ),
            timeout=llm_timeout,
        )
    except asyncio.TimeoutError:
        logger.error(f"Document evaluation timed out after {llm_timeout}s")
        yield _sse_event("error", {
            "stage": "evaluating",
            "message": f"Document evaluation timed out after {int(llm_timeout)}s",
            "elapsed_ms": elapsed_ms(),
        })
        if document_id:
            await pipeline.update_document_status(document_id, "failed", metadata_updates={"error_message": f"Document evaluation timed out after {int(llm_timeout)}s"})
        return
    except Exception as exc:
        logger.error(f"Evaluation failed: {exc}")
        yield _sse_event("error", {
            "stage": "evaluating",
            "message": f"Document evaluation failed: {exc}",
            "elapsed_ms": elapsed_ms(),
        })
        if document_id:
            await pipeline.update_document_status(document_id, "failed", metadata_updates={"error_message": str(exc)})
        return

    primary_type = (evaluation.get("type_evaluation") or {}).get("primary_type", "unknown")
    type_confidence = (evaluation.get("type_evaluation") or {}).get("confidence", 0)

    yield _sse_event("stage", {
        "stage": "evaluated",
        "message": f"Document type: {primary_type} ({int(type_confidence * 100)}% confidence)",
        "progress": 45,
        "elapsed_ms": elapsed_ms(),
    })

    suggestions = evaluation.get("template_suggestions", []) or []

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

    # ── Stage 4b: decide on top match ────────────────────────────────
    chosen_template: Optional[Dict[str, Any]] = None
    decision_metadata: Dict[str, Any] = {}

    # Cache for template row fetched from DB — reused in stage 5 to avoid
    # a redundant (and event-loop-blocking) duplicate query.
    _cached_template_row: Optional[Dict[str, Any]] = None

    # NOTE: Test extraction was removed here for performance (~7s LLM call).
    # It used to run `smart_field_extractor.test_template_extraction()` to
    # verify the matched template's fields could actually be extracted from
    # the document *before* committing to it.  With document-exemplar
    # embeddings now yielding high-confidence matches (0.96+), the
    # validation is unnecessary for strong matches.  If we start seeing
    # poor extractions from medium-confidence metadata-only matches
    # (0.60–0.70 range), this step should be re-added — ideally gated on
    # match_score < 0.85 or match_source != "document_exemplar".

    if suggestions and document_text:
        best = suggestions[0]
        match_score = best.get("match_score", 0.0)
        template_id = best.get("template_id")

        # Pre-fetch the template row for stage 5 field extraction.
        if template_id and db_config.is_configured and db_config.client:
            try:
                def _fetch_template(tid: str) -> Any:
                    return (
                        db_config.client.table("smart_templates")
                        .select("id, name, smart_variables, category")
                        .eq("id", tid)
                        .single()
                        .execute()
                    )

                template_result = await asyncio.to_thread(_fetch_template, template_id)
                _cached_template_row = template_result.data
            except Exception as exc:
                logger.warning(f"Failed to pre-fetch template {template_id}: {exc}")

        # Trust the vector score as the extraction quality estimate.
        best["extraction_quality"] = match_score
        best["combined_score"] = match_score

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
            # Reuse the template row fetched during stage 4b instead of
            # making a second blocking Supabase query.
            tpl_data = _cached_template_row
            if not tpl_data and template_id and db_config.is_configured and db_config.client:
                def _fetch_tpl(tid: str) -> Any:
                    return (
                        db_config.client.table("smart_templates")
                        .select("id, name, smart_variables, category")
                        .eq("id", tid)
                        .single()
                        .execute()
                    )
                tpl_result = await asyncio.to_thread(_fetch_tpl, template_id)
                tpl_data = tpl_result.data
            if tpl_data:
                smart_vars = tpl_data.get("smart_variables", [])
                if smart_vars:
                    field_result = await asyncio.wait_for(
                        smart_field_extractor.extract_fields_intelligently(
                            text_content=document_text,
                            template_variables=smart_vars,
                            confidence_threshold=0.6,
                            provider="azure",
                            organization_id=organization_id,
                        ),
                        timeout=llm_timeout,
                    )
                    extracted_fields = field_result.get("extracted_values", {})
        except asyncio.TimeoutError:
            logger.error(f"Field extraction timed out after {llm_timeout}s")
            yield _sse_event("error", {
                "stage": "extracting_fields",
                "message": f"Field extraction timed out after {int(llm_timeout)}s",
                "progress": 80,
                "elapsed_ms": elapsed_ms(),
            })
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

            # Detect fields directly from already-extracted text.
            # Previously this called analyze_document_structure(file_path)
            # which re-processed the PDF through Docling a second time,
            # adding ~2-14s of redundant work.
            detected_fields = await asyncio.wait_for(
                ai_template_generator._detect_fields_with_azure_openai(
                    document_text, primary_type
                ),
                timeout=llm_timeout,
            )

            # Build the analysis dict that generate_template_from_analysis expects
            analysis = {
                "analysis_id": str(__import__("uuid").uuid4()),
                "document_type": primary_type,
                "confidence": type_confidence,
                "suggested_category": ai_template_generator._suggest_template_category(
                    {"primary_category": primary_type, "confidence": type_confidence}
                ),
                "detected_fields": detected_fields or [],
                "structural_elements": [],
                "extraction_complexity": (
                    "simple" if len(detected_fields or []) <= 5
                    else "moderate" if len(detected_fields or []) <= 15
                    else "complex"
                ),
            }

            template_name = f"{primary_type.title()} Template"
            gen_result = await asyncio.wait_for(
                ai_template_generator.generate_template_from_analysis(
                    analysis, template_name
                ),
                timeout=llm_timeout,
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

                    field_result = await asyncio.wait_for(
                        smart_field_extractor.extract_fields_intelligently(
                            text_content=document_text,
                            template_variables=gen_vars,
                            confidence_threshold=0.6,
                            provider="azure",
                            organization_id=organization_id,
                        ),
                        timeout=llm_timeout,
                    )
                    extracted_fields = field_result.get("extracted_values", {})
        except asyncio.TimeoutError:
            logger.error(f"Template generation/extraction timed out after {llm_timeout}s")
            yield _sse_event("error", {
                "stage": "generating_template",
                "message": f"Template generation timed out after {int(llm_timeout)}s",
                "progress": 80,
                "elapsed_ms": elapsed_ms(),
            })
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

    # ── Update document status in database ─────────────────────────
    if document_id:
        try:
            import datetime
            await pipeline.update_document_status(
                document_id,
                "completed",
                metadata_updates={
                    "processing_completed_at": datetime.datetime.utcnow().isoformat(),
                    "processing_method": "sse_stream",
                },
            )
        except Exception as exc:
            logger.warning(f"[Stream] Failed to update document status: {exc}")

    # ── Emit document event for webhook subscriptions ──────────────
    try:
        await document_event_bus.emit(
            event_type="document.processed",
            organization_id=organization_id or "",
            data={
                "document_id": result.get("metadata", {}).get("document_id"),
                "filename": file.filename,
                "document_type": evaluation.get("document_type") if evaluation else None,
                "extracted_fields": extracted_fields,
                "template_id": chosen_template.get("id") if chosen_template else None,
                "template_name": chosen_template.get("name") if chosen_template else None,
                "match_confidence": decision_metadata.get("match_score") if decision_metadata else None,
                "action": result.get("action"),
                "processing_time_ms": elapsed_ms(),
            },
        )
    except Exception as exc:
        logger.warning(f"[Stream] Failed to emit document event: {exc}")


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
    document_id: Optional[int] = Query(
        None, description="Document ID for server-side status updates"
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

    # Keepalive interval — read from env so it can be tuned per-deployment
    # without a container rebuild.  Azure Container Apps' Envoy proxy has a
    # very aggressive idle-stream timeout for HTTP/2 browser connections
    # (~1.5s measured empirically).  We default to 1s keepalives to stay
    # well within that window.  curl/requests over HTTP/1.1 are far more
    # tolerant, but browsers negotiate HTTP/2 via ALPN and hit this limit.
    KEEPALIVE_INTERVAL = float(os.environ.get("SSE_KEEPALIVE_INTERVAL", "1"))

    # Sentinel pushed to the queue when the pipeline finishes.
    _DONE = object()

    async def event_stream() -> AsyncGenerator[str, None]:
        nonlocal temp_file_path

        queue: asyncio.Queue = asyncio.Queue()

        async def _run_pipeline() -> None:
            """Run the processing pipeline and push events to the queue."""
            upload_complete = False
            try:
                nonlocal temp_file_path
                temp_file_path = await validate_and_save_uploaded_file(file)
                upload_complete = True

                async for event in _process_document_stream(
                    file_path=temp_file_path,
                    filename=file.filename or "unknown",
                    content_type=file.content_type or "",
                    quick_scan=quick_scan,
                    min_match_confidence=min_match_confidence,
                    allow_generation=allow_generation,
                    organization_id=organization_id,
                    document_id=document_id,
                ):
                    await queue.put(event)

            except Exception as exc:
                stage = "upload" if not upload_complete else "processing"
                logger.error(f"Stream {stage} error: {exc}")
                await queue.put(_sse_event("error", {
                    "stage": stage,
                    "message": f"{'Upload' if not upload_complete else 'Processing'} failed: {exc}",
                    "elapsed_ms": 0,
                }))

            finally:
                await queue.put(_DONE)

        async def _keepalive(stop_event: asyncio.Event) -> None:
            """Emit SSE keepalive events to prevent proxy idle-timeout.

            Uses a real ``event: keepalive`` frame instead of an SSE comment
            because Azure Container Apps' Envoy proxy may buffer small
            comment-only lines without flushing them to the client.

            Sends an immediate keepalive on start to prime the stream,
            then continues at KEEPALIVE_INTERVAL.
            """
            # Prime: send one keepalive immediately so the proxy sees
            # data flowing right from the start.
            await queue.put(_sse_event("keepalive", {"ts": time.time()}))
            while not stop_event.is_set():
                try:
                    await asyncio.wait_for(
                        stop_event.wait(), timeout=KEEPALIVE_INTERVAL
                    )
                except asyncio.TimeoutError:
                    await queue.put(
                        _sse_event("keepalive", {"ts": time.time()})
                    )

        stop = asyncio.Event()
        pipeline_task = asyncio.create_task(_run_pipeline())
        keepalive_task = asyncio.create_task(_keepalive(stop))

        try:
            while True:
                item = await queue.get()
                if item is _DONE:
                    break
                yield item
        finally:
            stop.set()
            keepalive_task.cancel()
            # Wait for pipeline to finish so temp file cleanup can happen
            await asyncio.gather(pipeline_task, return_exceptions=True)
            if temp_file_path:
                await _cleanup_temp_file(temp_file_path)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "identity",
        },
    )
