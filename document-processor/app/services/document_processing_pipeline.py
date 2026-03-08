"""
Shared Document Processing Pipeline

Core processing functions used by both the SSE stream endpoint and the API v1
endpoint. Each function handles one stage of the pipeline and can be composed
differently depending on the caller's needs (streaming vs background task).

Usage:
    from app.services.document_processing_pipeline import pipeline

    text = await pipeline.extract_text(file_path)
    evaluation = await pipeline.evaluate_document(file_path, filename, text)
    matches = await pipeline.match_templates_vector(text, org_id)
    fields = await pipeline.extract_fields(text, variables, threshold)
"""

import asyncio
import logging
import sys
from pathlib import Path
from typing import Optional, Dict, Any, List

# Safe logger initialization
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

from .enhanced_docling_service import enhanced_docling_service
from .document_evaluator import document_evaluator
from .smart_field_extractor import smart_field_extractor
from .embedding_service import embedding_service
from ..config.database import db_config

# Timeouts (seconds)
TEXT_EXTRACTION_TIMEOUT = int(
    __import__("os").environ.get("DOCUMENT_PROCESSING_TIMEOUT", "120")
)
LLM_OPERATION_TIMEOUT = int(
    __import__("os").environ.get("LLM_OPERATION_TIMEOUT", "90")
)


class DocumentProcessingPipeline:
    """Stateless pipeline of composable document-processing stages."""

    # ── Stage 1: Text Extraction ──────────────────────────────────────

    async def extract_text(
        self,
        file_path: Path,
        *,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Extract text + metadata from a document using Docling.

        Returns the raw Docling result dict with keys like
        ``content.text``, ``metadata``, etc.
        """
        effective_timeout = timeout or TEXT_EXTRACTION_TIMEOUT

        try:
            result = await asyncio.wait_for(
                enhanced_docling_service.process_document(
                    file_path,
                    extract_text=True,
                    extract_metadata=True,
                    extract_structure=False,
                ),
                timeout=effective_timeout,
            )
        except asyncio.TimeoutError:
            raise TimeoutError(
                f"Text extraction timed out after {effective_timeout}s"
            )

        text = result.get("content", {}).get("text", "")
        if not text:
            raise ValueError("No text could be extracted from document")

        return result

    # ── Stage 2: Document Evaluation ──────────────────────────────────

    async def evaluate_document(
        self,
        file_path: Path,
        original_filename: str,
        extracted_text: Optional[str] = None,
        *,
        quick_scan: bool = True,
        user_id: Optional[str] = None,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Classify document type and get initial template suggestions.

        If *extracted_text* is supplied it is passed as ``content_override``
        so the evaluator doesn't re-extract the document.
        """
        effective_timeout = timeout or LLM_OPERATION_TIMEOUT

        kwargs: Dict[str, Any] = {
            "quick_scan": quick_scan,
            "user_id": user_id,
        }
        if extracted_text:
            kwargs["content_override"] = extracted_text

        try:
            return await asyncio.wait_for(
                document_evaluator.evaluate_document(
                    file_path,
                    original_filename,
                    "",  # content_type not needed
                    **kwargs,
                ),
                timeout=effective_timeout,
            )
        except asyncio.TimeoutError:
            raise TimeoutError(
                f"Document evaluation timed out after {effective_timeout}s"
            )

    # ── Stage 3: Vector Template Matching ─────────────────────────────

    async def match_templates_vector(
        self,
        text: str,
        organization_id: Optional[str] = None,
        *,
        min_score: float = 0.6,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Search for matching templates using Qdrant vector similarity.

        Returns a list of template suggestions sorted by score (descending).
        Falls back to an empty list if embedding/vector services are
        unavailable.
        """
        try:
            from .template_vector_service import template_vector_service

            if not template_vector_service.available:
                logger.info("Vector search not available, skipping")
                return []

            if not embedding_service:
                logger.info("Embedding service not available, skipping")
                return []

            embedding = await embedding_service.generate_single_embedding(text[:4000])
            if not embedding:
                return []

            results = await template_vector_service.search_similar_templates(
                embedding,
                limit=limit,
                min_score=min_score,
                organization_id=organization_id,
            )

            return results or []

        except Exception as e:
            logger.warning(f"Vector template matching failed (non-fatal): {e}")
            return []

    # ── Stage 4: Field Extraction ─────────────────────────────────────

    async def extract_fields(
        self,
        text: str,
        smart_variables: List[Dict[str, Any]],
        confidence_threshold: float = 0.6,
        *,
        provider: str = "azure",
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Extract structured field values from document text using the
        smart field extractor (LLM-based).
        """
        if not smart_variables:
            return {"message": "No smart variables defined"}

        effective_timeout = timeout or LLM_OPERATION_TIMEOUT

        try:
            return await asyncio.wait_for(
                smart_field_extractor.extract_fields_intelligently(
                    text,
                    smart_variables,
                    confidence_threshold,
                    provider=provider,
                ),
                timeout=effective_timeout,
            )
        except asyncio.TimeoutError:
            raise TimeoutError(
                f"Field extraction timed out after {effective_timeout}s"
            )

    # ── Stage 5: Fetch Template ───────────────────────────────────────

    async def fetch_template(
        self, template_id: int | str
    ) -> Optional[Dict[str, Any]]:
        """Fetch a template row from the database."""
        if not db_config.client:
            return None

        result = (
            db_config.client.table("smart_templates")
            .select("id, name, smart_variables, category, description")
            .eq("id", int(template_id))
            .execute()
        )

        if result.data:
            return result.data[0]
        return None


# Singleton
pipeline = DocumentProcessingPipeline()
