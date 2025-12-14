import asyncio
import logging
import uuid
from typing import Dict, List, Optional, Any
from pathlib import Path
from datetime import datetime

from app.services.docling_service import DoclingService
from app.services.vector_search_service import VectorSearchService
from app.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

class EnhancedDocumentService:
    """Enhanced document processing service that integrates chunking, embeddings, and vector search"""
    
    def __init__(self):
        self.docling_service = DoclingService()
        self.vector_service = VectorSearchService()
        self.embedding_service = EmbeddingService()
    
    async def process_and_index_document(self, 
                                       file_path: Path,
                                       document_id: Optional[str] = None,
                                       extract_structure: bool = True,
                                       enable_vector_indexing: bool = True) -> Dict[str, Any]:
        """Complete document processing pipeline with vector indexing"""
        
        document_id = document_id or str(uuid.uuid4())
        start_time = datetime.utcnow()
        
        try:
            logger.info(f"Starting enhanced document processing for: {file_path} (ID: {document_id})")
            
            # Step 1: Process document with Docling
            processing_result = await self.docling_service.process_document(
                file_path=file_path,
                extract_text=True,
                extract_metadata=True,
                extract_structure=extract_structure
            )
            
            if processing_result["status"] != "completed":
                logger.error(f"Document processing failed: {processing_result.get('error_message')}")
                return {
                    "document_id": document_id,
                    "status": "failed",
                    "error": processing_result.get("error_message"),
                    "processing_time": (datetime.utcnow() - start_time).total_seconds()
                }
            
            # Extract processed data
            content = processing_result["content"]
            metadata = processing_result["metadata"]
            chunks = content.get("chunks", [])
            
            # Step 2: Enhanced metadata preparation
            enhanced_metadata = {
                "document_id": document_id,
                "filename": metadata["filename"],
                "file_size": metadata["file_size"],
                "document_type": metadata["document_type"],
                "title": metadata.get("title", ""),
                "created_at": metadata["created_at"],
                "modified_at": metadata["modified_at"],
                "processing_method": processing_result["processing_method"],
                "total_chunks": len(chunks),
                "total_words": sum(chunk.get("word_count", 0) for chunk in chunks),
                "total_characters": sum(chunk.get("character_count", 0) for chunk in chunks)
            }
            
            # Step 3: Vector indexing if enabled
            indexing_result = None
            if enable_vector_indexing and chunks and self.vector_service.available:
                try:
                    indexing_success = await self.vector_service.index_document_chunks(
                        chunks=chunks,
                        document_metadata=enhanced_metadata
                    )
                    
                    if indexing_success:
                        indexing_result = {
                            "status": "success",
                            "indexed_chunks": len(chunks),
                            "vector_store": "qdrant"
                        }
                        logger.info(f"Successfully indexed {len(chunks)} chunks for document {document_id}")
                    else:
                        indexing_result = {
                            "status": "failed",
                            "error": "Failed to index chunks in vector store"
                        }
                        logger.warning(f"Failed to index chunks for document {document_id}")
                        
                except Exception as e:
                    indexing_result = {
                        "status": "error",
                        "error": str(e)
                    }
                    logger.error(f"Error during vector indexing: {e}")
            
            end_time = datetime.utcnow()
            total_processing_time = (end_time - start_time).total_seconds()
            
            # Step 4: Prepare comprehensive result
            result = {
                "document_id": document_id,
                "status": "completed",
                "processing_time": total_processing_time,
                "metadata": enhanced_metadata,
                "content": {
                    "text": content.get("text", ""),
                    "markdown": content.get("markdown", ""),
                    "chunks": chunks,
                    "tables": content.get("tables", []),
                    "images": content.get("images", []),
                    "layout_info": content.get("layout_info", {}),
                    "document_structure": content.get("document_structure", {})
                },
                "vector_indexing": indexing_result,
                "chunking_stats": self._calculate_chunking_stats(chunks),
                "created_at": start_time.isoformat(),
                "completed_at": end_time.isoformat()
            }
            
            logger.info(f"Enhanced document processing completed for {document_id} in {total_processing_time:.2f}s")
            return result
            
        except Exception as e:
            logger.error(f"Error in enhanced document processing: {e}")
            return {
                "document_id": document_id,
                "status": "error",
                "error_message": str(e),
                "processing_time": (datetime.utcnow() - start_time).total_seconds(),
                "created_at": start_time.isoformat(),
                "completed_at": datetime.utcnow().isoformat()
            }
    
    def _calculate_chunking_stats(self, chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate statistics about the chunking process"""
        
        if not chunks:
            return {"total_chunks": 0}
        
        # Basic stats
        word_counts = [chunk.get("word_count", 0) for chunk in chunks]
        char_counts = [chunk.get("character_count", 0) for chunk in chunks]
        sources = [chunk.get("source", "unknown") for chunk in chunks]
        
        # Source distribution
        source_counts = {}
        for source in sources:
            source_counts[source] = source_counts.get(source, 0) + 1
        
        return {
            "total_chunks": len(chunks),
            "avg_words_per_chunk": sum(word_counts) / len(word_counts) if word_counts else 0,
            "min_words_per_chunk": min(word_counts) if word_counts else 0,
            "max_words_per_chunk": max(word_counts) if word_counts else 0,
            "avg_chars_per_chunk": sum(char_counts) / len(char_counts) if char_counts else 0,
            "total_words": sum(word_counts),
            "total_characters": sum(char_counts),
            "chunking_methods": source_counts,
            "chunks_with_metadata": len([c for c in chunks if c.get("metadata")])
        }
    
    async def search_documents(self, 
                             query: str,
                             limit: int = 10,
                             filters: Optional[Dict[str, Any]] = None,
                             search_type: str = "hybrid") -> List[Dict[str, Any]]:
        """Search through indexed documents"""
        
        if not self.vector_service.available:
            logger.warning("Vector search service not available")
            return []
        
        try:
            if search_type == "hybrid":
                results = await self.vector_service.hybrid_search(
                    query=query,
                    limit=limit,
                    filters=filters
                )
            elif search_type == "semantic":
                results = await self.vector_service.semantic_search(
                    query=query,
                    limit=limit,
                    filters=filters
                )
            else:
                logger.warning(f"Unknown search type: {search_type}, using hybrid")
                results = await self.vector_service.hybrid_search(
                    query=query,
                    limit=limit,
                    filters=filters
                )
            
            # Enhance results with additional context
            enhanced_results = []
            for result in results:
                enhanced_result = {
                    **result,
                    "search_query": query,
                    "search_type": search_type,
                    "timestamp": datetime.utcnow().isoformat()
                }
                enhanced_results.append(enhanced_result)
            
            logger.info(f"Search completed: {len(enhanced_results)} results for query '{query}'")
            return enhanced_results
            
        except Exception as e:
            logger.error(f"Error in document search: {e}")
            return []
    
    async def get_document_summary(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Get a comprehensive summary of a document"""
        
        try:
            # Get chunks from vector store
            chunks = await self.vector_service.get_document_chunks(document_id)
            
            if not chunks:
                return None
            
            # Calculate summary statistics
            total_words = sum(chunk.get("metadata", {}).get("word_count", 0) for chunk in chunks)
            total_chars = sum(chunk.get("metadata", {}).get("character_count", 0) for chunk in chunks)
            
            # Get sample chunk for metadata
            sample_chunk = chunks[0] if chunks else {}
            sample_metadata = sample_chunk.get("metadata", {})
            
            summary = {
                "document_id": document_id,
                "total_chunks": len(chunks),
                "total_words": total_words,
                "total_characters": total_chars,
                "document_type": sample_metadata.get("document_type", "unknown"),
                "source_file": sample_metadata.get("source_file", ""),
                "title": sample_metadata.get("title", ""),
                "created_at": sample_metadata.get("created_at"),
                "avg_words_per_chunk": total_words / len(chunks) if chunks else 0,
                "chunk_types": list(set(chunk.get("chunk_type", "") for chunk in chunks)),
                "indexed_in_vector_store": True,
                "chunks_preview": chunks[:3]  # First 3 chunks for preview
            }
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting document summary: {e}")
            return None
    
    async def delete_document(self, document_id: str) -> bool:
        """Delete a document and all its associated data"""
        
        try:
            # Delete from vector store
            if self.vector_service.available:
                vector_deleted = await self.vector_service.delete_document(document_id)
                if vector_deleted:
                    logger.info(f"Document {document_id} deleted from vector store")
                else:
                    logger.warning(f"Failed to delete document {document_id} from vector store")
            
            # TODO: Add deletion from other stores (database, file system, etc.)
            
            return True
            
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
            return False
    
    async def get_service_status(self) -> Dict[str, Any]:
        """Get comprehensive status of all enhanced document services"""
        
        try:
            docling_status = await self.docling_service.get_service_status()
            embedding_status = await self.embedding_service.get_service_status()
            
            # Get vector service status
            if self.vector_service.available:
                collection_info = await self.vector_service.get_collection_info()
            else:
                collection_info = {"error": "Qdrant not available"}
            
            return {
                "service": "enhanced_document_processor",
                "status": "healthy",
                "timestamp": datetime.utcnow().isoformat(),
                "components": {
                    "docling_service": docling_status,
                    "embedding_service": embedding_status,
                    "vector_service": {
                        "available": self.vector_service.available,
                        "host": self.vector_service.host,
                        "port": self.vector_service.port,
                        "collection": collection_info
                    }
                },
                "features": {
                    "document_processing": True,
                    "intelligent_chunking": True,
                    "vector_indexing": self.vector_service.available,
                    "hybrid_search": self.vector_service.available,
                    "semantic_search": self.vector_service.available,
                    "embedding_generation": embedding_status.get("provider") is not None
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting service status: {e}")
            return {
                "service": "enhanced_document_processor", 
                "status": "error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }


# Global service instance
enhanced_document_service = EnhancedDocumentService()