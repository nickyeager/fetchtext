"""
Template Vector Service - Manages template embeddings in Qdrant for fast similarity search.

Provides Template-RAG capabilities: embeds templates at creation/update time,
searches for matching templates by document embedding at decision time.
"""

import logging
import os
import time
from typing import Dict, List, Optional, Any

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http.models import (
        Distance,
        VectorParams,
        PointStruct,
        Filter,
        FieldCondition,
        MatchValue,
    )
    from qdrant_client.http import models as qdrant_models
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False

from app.services.embedding_service import embedding_service
from app.config.database import db_config

logger = logging.getLogger(__name__)


class TemplateVectorService:
    """Service for template-specific vector operations in Qdrant.

    Manages a dedicated ``template_embeddings`` collection separate from the
    ``documents`` collection used for general document search.
    """

    collection_name = "template_embeddings"

    def __init__(self):
        self.embedding_service = embedding_service
        self.available = False
        self.client: Optional[Any] = None
        self._collection_ready = False

        host = os.getenv("QDRANT_HOST", "qdrant")
        port = int(os.getenv("QDRANT_PORT", "6333"))
        api_key = os.getenv("QDRANT_API_KEY")

        if not QDRANT_AVAILABLE:
            logger.warning("qdrant-client not installed — template vector search disabled")
            return

        try:
            if host.startswith("http") or "." in host:
                # External Qdrant (production Container App / HTTPS)
                url = host if host.startswith("http") else f"https://{host}"
                self.client = QdrantClient(url=url, api_key=api_key, prefer_grpc=False, timeout=30)
                conn_label = url
            else:
                # Docker internal (local dev)
                self.client = QdrantClient(host=host, port=port, api_key=api_key, timeout=10)
                conn_label = f"{host}:{port}"
            # Quick connectivity check
            self.client.get_collections()
            self.available = True
            logger.info(f"TemplateVectorService connected to Qdrant at {conn_label}")
        except Exception as e:
            logger.warning(f"Qdrant not reachable at {host} — template vector search disabled: {e}")

    # ------------------------------------------------------------------
    # Collection management
    # ------------------------------------------------------------------

    async def ensure_collection_exists(self) -> bool:
        """Create the ``template_embeddings`` collection if it doesn't exist."""
        if not self.available or not self.client:
            return False

        if self._collection_ready:
            return True

        try:
            existing = [c.name for c in self.client.get_collections().collections]
            if self.collection_name not in existing:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
                )
                # Payload indexes for filtered search
                index_failures = []
                for field, schema in [
                    ("template_id", qdrant_models.PayloadSchemaType.INTEGER),
                    ("category", qdrant_models.PayloadSchemaType.KEYWORD),
                    ("is_public", qdrant_models.PayloadSchemaType.BOOL),
                ]:
                    try:
                        self.client.create_payload_index(
                            collection_name=self.collection_name,
                            field_name=field,
                            field_schema=schema,
                        )
                    except Exception as idx_err:
                        # "already exists" errors are expected and safe to ignore
                        if "already exists" in str(idx_err).lower():
                            pass
                        else:
                            index_failures.append(f"{field}: {idx_err}")
                if index_failures:
                    logger.warning(f"Some Qdrant indexes failed (non-fatal): {index_failures}")
                logger.info(f"Created Qdrant collection '{self.collection_name}'")
            else:
                logger.info(f"Qdrant collection '{self.collection_name}' already exists")

            self._collection_ready = True
            return True
        except Exception as e:
            logger.error(f"Failed to ensure Qdrant collection: {e}")
            return False

    # ------------------------------------------------------------------
    # Template text representation
    # ------------------------------------------------------------------

    def build_template_text(self, template: Dict[str, Any]) -> str:
        """Build a rich text representation of a template for embedding.

        Includes name, category, description, and field names+descriptions so
        that embeddings capture *what the template extracts*, not just its title.
        """
        parts: List[str] = []

        name = template.get("name", "")
        if name:
            parts.append(name)

        category = template.get("category", "")
        if category:
            parts.append(f"Category: {category}")

        description = template.get("description", "")
        if description:
            parts.append(description)

        smart_variables = template.get("smart_variables", [])
        if smart_variables and isinstance(smart_variables, list):
            field_parts: List[str] = []
            for var in smart_variables:
                field_name = var.get("name", var.get("id", ""))
                field_desc = var.get("description", "")
                field_type = var.get("type", "text")
                if field_name:
                    entry = f"{field_name} ({field_type})"
                    if field_desc:
                        entry += f": {field_desc}"
                    field_parts.append(entry)
            if field_parts:
                parts.append("Fields: " + ", ".join(field_parts))

        return " | ".join(parts) if parts else ""

    # ------------------------------------------------------------------
    # Index / remove
    # ------------------------------------------------------------------

    async def index_template(self, template: Dict[str, Any]) -> bool:
        """Generate an embedding for *template* and upsert it into Qdrant.

        Uses ``int(template_id)`` as the Qdrant point ID so that subsequent
        calls for the same template overwrite the previous embedding.
        """
        if not self.available:
            return False

        template_id = template.get("id")
        if template_id is None:
            logger.warning("Cannot index template without an id")
            return False

        if self.embedding_service.provider is None:
            logger.warning("Embedding provider not configured — skipping template indexing")
            return False

        try:
            await self.ensure_collection_exists()

            text = self.build_template_text(template)
            if not text:
                logger.warning(f"Empty text representation for template {template_id}")
                return False

            embedding = await self.embedding_service.generate_single_embedding(text)
            if not embedding:
                logger.warning(f"Failed to generate embedding for template {template_id}")
                return False

            point = PointStruct(
                id=int(template_id),
                vector=embedding,
                payload={
                    "template_id": int(template_id),
                    "name": template.get("name", ""),
                    "category": (template.get("category", "") or "").lower(),
                    "description": template.get("description", ""),
                    "field_count": len(template.get("smart_variables", [])),
                    "is_public": template.get("is_public", False),
                },
            )

            self.client.upsert(
                collection_name=self.collection_name,
                points=[point],
                wait=True,
            )
            logger.info(f"Indexed template {template_id} ('{template.get('name')}') in Qdrant")
            return True

        except Exception as e:
            logger.error(f"Failed to index template {template_id}: {e}")
            return False

    async def remove_template(self, template_id: int) -> bool:
        """Remove a template embedding from Qdrant."""
        if not self.available or not self.client:
            return False
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=qdrant_models.PointIdsList(points=[int(template_id)]),
            )
            logger.info(f"Removed template {template_id} from Qdrant")
            return True
        except Exception as e:
            logger.error(f"Failed to remove template {template_id}: {e}")
            return False

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    async def search_similar_templates(
        self,
        document_embedding: List[float],
        limit: int = 5,
        category_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Search Qdrant for templates most similar to the document embedding.

        Returns results in the same dict format as
        ``TemplateMatchingService.find_matching_templates()`` so they can be
        used as a drop-in replacement.
        """
        if not self.available or not self.client:
            return []

        try:
            await self.ensure_collection_exists()

            start = time.time()

            query_filter = None
            if category_filter:
                query_filter = Filter(
                    must=[
                        FieldCondition(
                            key="category",
                            match=MatchValue(value=category_filter.lower()),
                        )
                    ]
                )

            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=document_embedding,
                query_filter=query_filter,
                limit=limit,
                with_payload=True,
            )

            elapsed_ms = (time.time() - start) * 1000

            if not results:
                # Retry without category filter for broader matching
                if category_filter:
                    results = self.client.search(
                        collection_name=self.collection_name,
                        query_vector=document_embedding,
                        limit=limit,
                        with_payload=True,
                    )
                    elapsed_ms = (time.time() - start) * 1000

            suggestions: List[Dict[str, Any]] = []
            for hit in results:
                payload = hit.payload or {}
                suggestions.append({
                    "template_id": payload.get("template_id"),
                    "template_name": payload.get("name", ""),
                    "match_score": round(float(hit.score), 3),
                    "category": payload.get("category", ""),
                    "field_count": payload.get("field_count", 0),
                    "description": payload.get("description", ""),
                    "usage_count": 0,  # not stored in Qdrant
                    "match_source": "vector_search",
                })

            logger.info(
                f"Template vector search returned {len(suggestions)} matches in {elapsed_ms:.0f}ms"
                + (f" (category={category_filter})" if category_filter else "")
            )
            return suggestions

        except Exception as e:
            logger.error(f"Template vector search failed: {e}")
            return []

    # ------------------------------------------------------------------
    # Bulk sync
    # ------------------------------------------------------------------

    async def sync_all_templates(self) -> int:
        """Load all templates from Supabase and index them into Qdrant.

        Intended to run once at service startup so that the Qdrant collection
        is warm before the first ``/decide-template`` request.
        """
        if not self.available:
            logger.warning("Qdrant not available — skipping template sync")
            return 0

        if self.embedding_service.provider is None:
            logger.warning("Embedding provider not configured — skipping template sync")
            return 0

        if not db_config.is_configured or not db_config.client:
            logger.warning("Database not configured — skipping template sync")
            return 0

        try:
            await self.ensure_collection_exists()

            result = db_config.client.table("smart_templates").select(
                "id, name, category, description, smart_variables, is_public"
            ).order("id").execute()

            templates = result.data or []
            if not templates:
                logger.info("No templates found in database to sync")
                return 0

            # Check what's already indexed
            collection_info = self.client.get_collection(self.collection_name)
            existing_count = collection_info.points_count or 0

            synced = 0
            for template in templates:
                ok = await self.index_template(template)
                if ok:
                    synced += 1

            logger.info(
                f"Template sync complete: {synced}/{len(templates)} indexed "
                f"(was {existing_count} points before sync)"
            )
            return synced

        except Exception as e:
            logger.error(f"Template sync failed: {e}")
            return 0


# Global instance
template_vector_service = TemplateVectorService()
