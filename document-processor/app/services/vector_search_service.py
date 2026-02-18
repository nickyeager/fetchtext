import asyncio
import logging
import os
import uuid
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
import json
from pathlib import Path

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models
    from qdrant_client.http.models import (
        Distance, 
        VectorParams, 
        PointStruct, 
        Filter, 
        FieldCondition, 
        Range,
        MatchValue,
        ScoredPoint
    )
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False
    QdrantClient = None
    models = None

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    np = None

from app.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

class VectorSearchService:
    """Enhanced vector search service with hybrid capabilities using Qdrant"""
    
    def __init__(self,
                 host: str = None,
                 port: int = None,
                 collection_name: str = "documents"):

        self.host = host or os.getenv("QDRANT_HOST", "qdrant")
        self.port = port or int(os.getenv("QDRANT_PORT", "6333"))
        self.collection_name = collection_name
        self.embedding_service = EmbeddingService()

        # Initialize Qdrant client
        if QDRANT_AVAILABLE:
            try:
                api_key = os.getenv("QDRANT_API_KEY")
                if self.host.startswith("http") or "." in self.host:
                    # External Qdrant (production Container App / HTTPS)
                    url = self.host if self.host.startswith("http") else f"https://{self.host}"
                    self.client = QdrantClient(url=url, api_key=api_key, prefer_grpc=False, timeout=30)
                    logger.info(f"Qdrant client initialized at {url} (external)")
                else:
                    # Docker internal (local dev)
                    self.client = QdrantClient(host=self.host, port=self.port, api_key=api_key, timeout=10)
                    logger.info(f"Qdrant client initialized at {self.host}:{self.port} (docker)")
                self.available = True
            except Exception as e:
                logger.error(f"Failed to initialize Qdrant client: {e}")
                self.client = None
                self.available = False
        else:
            logger.warning("Qdrant client not available - install qdrant-client")
            self.client = None
            self.available = False
    
    async def ensure_collection_exists(self, 
                                     vector_size: int = 1536,
                                     distance: Distance = Distance.COSINE) -> bool:
        """Ensure the collection exists with proper configuration"""
        
        if not self.available or not self.client:
            logger.warning("Qdrant client not available")
            return False
        
        try:
            # Check if collection exists
            collections = self.client.get_collections()
            collection_names = [col.name for col in collections.collections]
            
            if self.collection_name not in collection_names:
                logger.info(f"Creating collection: {self.collection_name}")
                
                # Create collection with basic vector configuration
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=vector_size,
                        distance=distance
                    )
                )
                
                # Create payload indexes for hybrid search filters
                self._create_payload_indexes()
                
                logger.info(f"Collection {self.collection_name} created successfully")
            else:
                logger.info(f"Collection {self.collection_name} already exists")
            
            return True
            
        except Exception as e:
            logger.error(f"Error ensuring collection exists: {e}")
            return False
    
    def _create_payload_indexes(self):
        """Create indexes for hybrid search filtering"""
        
        try:
            # Index for document metadata
            index_configs = [
                ("document_id", models.PayloadSchemaType.KEYWORD),
                ("document_type", models.PayloadSchemaType.KEYWORD), 
                ("source_file", models.PayloadSchemaType.KEYWORD),
                ("chunk_type", models.PayloadSchemaType.KEYWORD),
                ("created_at", models.PayloadSchemaType.DATETIME),
                ("word_count", models.PayloadSchemaType.INTEGER),
                ("character_count", models.PayloadSchemaType.INTEGER),
                ("page_number", models.PayloadSchemaType.INTEGER),
                ("section", models.PayloadSchemaType.KEYWORD),
                ("title", models.PayloadSchemaType.TEXT),
                ("content_hash", models.PayloadSchemaType.KEYWORD)
            ]
            
            for field_name, field_type in index_configs:
                try:
                    self.client.create_payload_index(
                        collection_name=self.collection_name,
                        field_name=field_name,
                        field_schema=field_type
                    )
                    logger.debug(f"Created index for field: {field_name}")
                except Exception as e:
                    # Index might already exist
                    logger.debug(f"Index creation for {field_name} skipped: {e}")
            
        except Exception as e:
            logger.warning(f"Error creating payload indexes: {e}")
    
    async def index_document_chunks(self, 
                                  chunks: List[Dict[str, Any]], 
                                  document_metadata: Dict[str, Any]) -> bool:
        """Index document chunks with enhanced metadata for hybrid search"""
        
        if not self.available or not self.client:
            logger.warning("Qdrant client not available for indexing")
            return False
        
        try:
            # Ensure collection exists
            await self.ensure_collection_exists()
            
            # Generate embeddings for all chunks
            chunk_texts = [chunk["text"] for chunk in chunks]
            embeddings = await self.embedding_service.generate_embeddings(chunk_texts)
            
            if not embeddings or len(embeddings) != len(chunks):
                logger.error("Failed to generate embeddings for chunks")
                return False
            
            # Prepare points for indexing
            points = []
            document_id = document_metadata.get("document_id", str(uuid.uuid4()))
            
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                point_id = str(uuid.uuid4())
                
                # Enhanced payload with hybrid search metadata
                payload = {
                    "document_id": document_id,
                    "chunk_id": chunk.get("chunk_id", i),
                    "text": chunk["text"],
                    "document_type": document_metadata.get("document_type", "unknown"),
                    "source_file": document_metadata.get("filename", ""),
                    "chunk_type": chunk.get("source", "unknown"),
                    "created_at": datetime.utcnow().isoformat(),
                    "word_count": chunk.get("word_count", len(chunk["text"].split())),
                    "character_count": chunk.get("character_count", len(chunk["text"])),
                    "title": document_metadata.get("title", ""),
                    "content_hash": self._generate_content_hash(chunk["text"]),
                    
                    # Chunk-specific metadata
                    "chunk_metadata": chunk.get("metadata", {}),
                    
                    # Document-level metadata
                    "file_size": document_metadata.get("file_size", 0),
                    "mime_type": document_metadata.get("mime_type", ""),
                    "page_number": chunk.get("metadata", {}).get("page", 1),
                    "section": chunk.get("metadata", {}).get("section", ""),
                    
                    # Full-text search support (BM25)
                    "searchable_text": self._prepare_searchable_text(chunk, document_metadata)
                }
                
                point = PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=payload
                )
                points.append(point)
            
            # Batch upsert points
            operation_info = self.client.upsert(
                collection_name=self.collection_name,
                points=points,
                wait=True
            )
            
            logger.info(f"Successfully indexed {len(points)} chunks for document {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error indexing document chunks: {e}")
            return False
    
    def _generate_content_hash(self, text: str) -> str:
        """Generate a hash for content deduplication"""
        import hashlib
        return hashlib.md5(text.encode()).hexdigest()[:16]
    
    def _prepare_searchable_text(self, chunk: Dict[str, Any], document_metadata: Dict[str, Any]) -> str:
        """Prepare text for full-text search with enhanced context"""
        
        text_parts = [
            chunk["text"],
            document_metadata.get("title", ""),
            document_metadata.get("filename", ""),
            chunk.get("metadata", {}).get("section", ""),
            chunk.get("chunk_type", "")
        ]
        
        return " ".join(filter(None, text_parts))
    
    async def hybrid_search(self, 
                          query: str,
                          limit: int = 10,
                          filters: Optional[Dict[str, Any]] = None,
                          vector_weight: float = 0.7,
                          text_weight: float = 0.3,
                          min_score: float = 0.1) -> List[Dict[str, Any]]:
        """Perform hybrid search combining vector similarity and text matching"""
        
        if not self.available or not self.client:
            logger.warning("Qdrant client not available for search")
            return []
        
        try:
            # Step 1: Vector search
            vector_results = await self._vector_search(
                query=query,
                limit=limit * 2,  # Get more candidates
                filters=filters,
                min_score=min_score
            )
            
            # Step 2: Text search (simulate BM25-like scoring)
            text_results = await self._text_search(
                query=query,
                limit=limit * 2,
                filters=filters
            )
            
            # Step 3: Combine and rank results using RRF (Reciprocal Rank Fusion)
            combined_results = self._combine_search_results(
                vector_results=vector_results,
                text_results=text_results,
                vector_weight=vector_weight,
                text_weight=text_weight,
                limit=limit
            )
            
            return combined_results
            
        except Exception as e:
            logger.error(f"Error in hybrid search: {e}")
            return []
    
    async def _vector_search(self, 
                           query: str,
                           limit: int,
                           filters: Optional[Dict[str, Any]] = None,
                           min_score: float = 0.1) -> List[Dict[str, Any]]:
        """Perform vector similarity search"""
        
        try:
            # Generate query embedding
            query_embeddings = await self.embedding_service.generate_embeddings([query])
            if not query_embeddings:
                return []
            
            query_vector = query_embeddings[0]
            
            # Prepare Qdrant filter
            qdrant_filter = self._build_qdrant_filter(filters) if filters else None
            
            # Perform vector search
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=qdrant_filter,
                limit=limit,
                score_threshold=min_score,
                with_payload=True,
                with_vectors=False
            )
            
            # Convert to standard format
            formatted_results = []
            for result in results:
                formatted_results.append({
                    "id": result.id,
                    "score": result.score,
                    "text": result.payload.get("text", ""),
                    "metadata": {
                        "document_id": result.payload.get("document_id"),
                        "source_file": result.payload.get("source_file"),
                        "chunk_type": result.payload.get("chunk_type"),
                        "word_count": result.payload.get("word_count"),
                        "title": result.payload.get("title"),
                        "search_type": "vector"
                    },
                    "payload": result.payload
                })
            
            logger.debug(f"Vector search returned {len(formatted_results)} results")
            return formatted_results
            
        except Exception as e:
            logger.error(f"Error in vector search: {e}")
            return []
    
    async def _text_search(self, 
                         query: str,
                         limit: int,
                         filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Perform text-based search using Qdrant's full-text capabilities"""
        
        try:
            # Build search filter that includes text matching
            query_terms = query.lower().split()
            
            # Create text match conditions
            text_conditions = []
            for term in query_terms:
                text_conditions.append(
                    FieldCondition(
                        key="searchable_text",
                        match=MatchValue(value=term)
                    )
                )
            
            # Combine with user filters
            qdrant_filter = self._build_qdrant_filter(filters) if filters else Filter(must=[])
            if not qdrant_filter.must:
                qdrant_filter.must = []
            
            # Add text search conditions
            if text_conditions:
                qdrant_filter.must.extend(text_conditions)
            
            # Perform scroll search (as text search doesn't have scoring)
            results, _ = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=qdrant_filter,
                limit=limit,
                with_payload=True,
                with_vectors=False
            )
            
            # Calculate text similarity scores
            formatted_results = []
            for point in results:
                text_score = self._calculate_text_similarity(
                    query, 
                    point.payload.get("searchable_text", "")
                )
                
                formatted_results.append({
                    "id": point.id,
                    "score": text_score,
                    "text": point.payload.get("text", ""),
                    "metadata": {
                        "document_id": point.payload.get("document_id"),
                        "source_file": point.payload.get("source_file"),
                        "chunk_type": point.payload.get("chunk_type"),
                        "word_count": point.payload.get("word_count"),
                        "title": point.payload.get("title"),
                        "search_type": "text"
                    },
                    "payload": point.payload
                })
            
            # Sort by text score
            formatted_results.sort(key=lambda x: x["score"], reverse=True)
            
            logger.debug(f"Text search returned {len(formatted_results)} results")
            return formatted_results[:limit]
            
        except Exception as e:
            logger.error(f"Error in text search: {e}")
            return []
    
    def _calculate_text_similarity(self, query: str, text: str) -> float:
        """Calculate simple text similarity score (BM25-like)"""
        
        query_terms = set(query.lower().split())
        text_terms = set(text.lower().split())
        
        if not query_terms or not text_terms:
            return 0.0
        
        # Simple Jaccard similarity with term frequency weighting
        intersection = query_terms.intersection(text_terms)
        union = query_terms.union(text_terms)
        
        if not union:
            return 0.0
        
        # Base similarity
        base_score = len(intersection) / len(union)
        
        # Boost for term frequency
        text_lower = text.lower()
        frequency_boost = sum(text_lower.count(term) for term in intersection) / len(text_terms)
        
        # Combine scores
        return min(base_score + (frequency_boost * 0.1), 1.0)
    
    def _combine_search_results(self,
                              vector_results: List[Dict[str, Any]], 
                              text_results: List[Dict[str, Any]],
                              vector_weight: float,
                              text_weight: float,
                              limit: int) -> List[Dict[str, Any]]:
        """Combine vector and text search results using Reciprocal Rank Fusion"""
        
        # Create lookup by ID for deduplication
        all_results = {}
        
        # Add vector results with weighted scores
        for i, result in enumerate(vector_results):
            result_id = result["id"]
            vector_score = result["score"] * vector_weight
            rrf_score = vector_weight / (60 + i + 1)  # RRF constant = 60
            
            all_results[result_id] = {
                **result,
                "vector_score": result["score"],
                "text_score": 0.0,
                "combined_score": vector_score,
                "rrf_score": rrf_score,
                "found_in": ["vector"]
            }
        
        # Add text results with weighted scores
        for i, result in enumerate(text_results):
            result_id = result["id"]
            text_score = result["score"] * text_weight
            rrf_score = text_weight / (60 + i + 1)
            
            if result_id in all_results:
                # Combine scores for items found in both searches
                existing = all_results[result_id]
                existing["text_score"] = result["score"]
                existing["combined_score"] += text_score
                existing["rrf_score"] += rrf_score
                existing["found_in"].append("text")
                existing["metadata"]["search_type"] = "hybrid"
            else:
                all_results[result_id] = {
                    **result,
                    "vector_score": 0.0,
                    "text_score": result["score"],
                    "combined_score": text_score,
                    "rrf_score": rrf_score,
                    "found_in": ["text"]
                }
        
        # Sort by combined RRF score and return top results
        final_results = list(all_results.values())
        final_results.sort(key=lambda x: x["rrf_score"], reverse=True)
        
        # Clean up the results
        for result in final_results[:limit]:
            result["score"] = result["rrf_score"]  # Use RRF as final score
            result["metadata"]["vector_score"] = result["vector_score"]
            result["metadata"]["text_score"] = result["text_score"]
            result["metadata"]["found_in"] = result["found_in"]
            
            # Remove internal scoring fields
            for key in ["vector_score", "text_score", "combined_score", "rrf_score", "found_in"]:
                result.pop(key, None)
        
        logger.info(f"Combined search returned {len(final_results[:limit])} results")
        return final_results[:limit]
    
    def _build_qdrant_filter(self, filters: Dict[str, Any]) -> Filter:
        """Build Qdrant filter from user-provided filters"""
        
        must_conditions = []
        
        for key, value in filters.items():
            if key == "document_type" and value:
                must_conditions.append(
                    FieldCondition(key="document_type", match=MatchValue(value=value))
                )
            elif key == "document_id" and value:
                must_conditions.append(
                    FieldCondition(key="document_id", match=MatchValue(value=value))
                )
            elif key == "source_file" and value:
                must_conditions.append(
                    FieldCondition(key="source_file", match=MatchValue(value=value))
                )
            elif key == "date_range" and isinstance(value, dict):
                if "start" in value or "end" in value:
                    range_condition = Range()
                    if "start" in value:
                        range_condition.gte = value["start"]
                    if "end" in value:
                        range_condition.lte = value["end"]
                    
                    must_conditions.append(
                        FieldCondition(key="created_at", range=range_condition)
                    )
            elif key == "min_word_count" and isinstance(value, int):
                must_conditions.append(
                    FieldCondition(key="word_count", range=Range(gte=value))
                )
        
        return Filter(must=must_conditions)
    
    async def semantic_search(self, 
                            query: str,
                            limit: int = 10,
                            filters: Optional[Dict[str, Any]] = None,
                            min_score: float = 0.1) -> List[Dict[str, Any]]:
        """Pure semantic vector search"""
        return await self._vector_search(query, limit, filters, min_score)
    
    async def get_document_chunks(self, document_id: str) -> List[Dict[str, Any]]:
        """Retrieve all chunks for a specific document"""
        
        if not self.available or not self.client:
            return []
        
        try:
            filter_condition = Filter(
                must=[
                    FieldCondition(key="document_id", match=MatchValue(value=document_id))
                ]
            )
            
            results, _ = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=filter_condition,
                limit=1000,  # Assume max 1000 chunks per document
                with_payload=True,
                with_vectors=False
            )
            
            chunks = []
            for point in results:
                chunks.append({
                    "id": point.id,
                    "text": point.payload.get("text", ""),
                    "chunk_id": point.payload.get("chunk_id", 0),
                    "chunk_type": point.payload.get("chunk_type", ""),
                    "metadata": point.payload
                })
            
            # Sort by chunk_id
            chunks.sort(key=lambda x: x["chunk_id"])
            return chunks
            
        except Exception as e:
            logger.error(f"Error retrieving document chunks: {e}")
            return []
    
    async def delete_document(self, document_id: str) -> bool:
        """Delete all chunks for a document"""
        
        if not self.available or not self.client:
            return False
        
        try:
            filter_condition = Filter(
                must=[
                    FieldCondition(key="document_id", match=MatchValue(value=document_id))
                ]
            )
            
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=models.FilterSelector(filter=filter_condition)
            )
            
            logger.info(f"Successfully deleted document {document_id} from vector store")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting document from vector store: {e}")
            return False
    
    async def get_collection_info(self) -> Dict[str, Any]:
        """Get information about the collection"""
        
        if not self.available or not self.client:
            return {"error": "Qdrant client not available"}
        
        try:
            info = self.client.get_collection(self.collection_name)
            return {
                "name": self.collection_name,
                "points_count": info.points_count,
                "segments_count": info.segments_count,
                "vector_size": info.config.params.vectors.size,
                "distance": info.config.params.vectors.distance.value,
                "status": info.status.value,
                "optimizer_status": info.optimizer_status,
                "indexed_vectors_count": info.indexed_vectors_count
            }
            
        except Exception as e:
            logger.error(f"Error getting collection info: {e}")
            return {"error": str(e)}


# Global service instance
vector_search_service = VectorSearchService()