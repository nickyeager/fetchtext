import asyncio
import aiofiles
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path
import tempfile
import os
from datetime import datetime
import uuid

# Import Docling functionality
try:
    from docling.document_converter import DocumentConverter
    from docling.datamodel.base_models import InputFormat
    DOCLING_AVAILABLE = True
    DOCLING_VERSION = "1.0.0"  # Update with actual version
except ImportError:
    DOCLING_AVAILABLE = False
    DocumentConverter = None
    InputFormat = None
    DOCLING_VERSION = None

from app.models.document import (
    DocumentProcessRequest, 
    ProcessingResult, 
    ProcessingStatus,
    DocumentMetadata, 
    ExtractedContent,
    DocumentType
)

logger = logging.getLogger(__name__)

class DoclingService:
    """Document processing service using Docling"""
    
    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / "docling_temp"
        self.temp_dir.mkdir(exist_ok=True)
        self.supported_formats = ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.txt', '.md']
        
        # Initialize Docling converter if available
        if DOCLING_AVAILABLE:
            try:
                self.converter = DocumentConverter()
                self.use_real_docling = True
                logger.info(f"Docling DocumentConverter initialized successfully (version: {DOCLING_VERSION})")
            except Exception as e:
                logger.error(f"Failed to initialize Docling converter: {e}")
                self.converter = None
                self.use_real_docling = False
        else:
            logger.warning("Docling not available, using mock implementation")
            self.converter = None
            self.use_real_docling = False
        
    async def get_supported_formats(self) -> List[str]:
        """Return list of supported file formats"""
        return self.supported_formats
    
    async def get_service_status(self) -> Dict[str, Any]:
        """Get service status including Docling availability"""
        return {
            "service": "docling",
            "status": "healthy" if self.use_real_docling else "mock",
            "docling_available": DOCLING_AVAILABLE,
            "docling_version": DOCLING_VERSION,
            "use_real_docling": self.use_real_docling,
            "supported_formats": self.supported_formats,
            "temp_dir": str(self.temp_dir)
        }
    
    async def detect_document_type(self, file_path: Path) -> DocumentType:
        """Detect document type from file extension"""
        suffix = file_path.suffix.lower()
        
        type_mapping = {
            '.pdf': DocumentType.PDF,
            '.docx': DocumentType.DOCX,
            '.doc': DocumentType.DOCX,
            '.pptx': DocumentType.PPTX,
            '.ppt': DocumentType.PPTX,
            '.html': DocumentType.HTML,
            '.htm': DocumentType.HTML,
            '.md': DocumentType.MD,
            '.txt': DocumentType.TXT,
            '.png': DocumentType.IMAGE,
            '.jpg': DocumentType.IMAGE,
            '.jpeg': DocumentType.IMAGE,
        }
        
        return type_mapping.get(suffix, DocumentType.UNKNOWN)
    
    async def extract_metadata(self, file_path: Path) -> DocumentMetadata:
        """Extract basic metadata from file"""
        try:
            stat = file_path.stat()
            doc_type = await self.detect_document_type(file_path)
            
            return DocumentMetadata(
                filename=file_path.name,
                file_size=stat.st_size,
                mime_type=self._get_mime_type(file_path),
                document_type=doc_type,
                created_at=datetime.fromtimestamp(stat.st_ctime),
                modified_at=datetime.fromtimestamp(stat.st_mtime),
                title=file_path.stem,  # Basic title from filename
            )
        except Exception as e:
            logger.error(f"Error extracting metadata: {e}")
            raise
    
    def _get_mime_type(self, file_path: Path) -> str:
        """Get MIME type from file extension"""
        suffix = file_path.suffix.lower()
        
        mime_mapping = {
            '.pdf': 'application/pdf',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.doc': 'application/msword',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.html': 'text/html',
            '.txt': 'text/plain',
            '.md': 'text/markdown',
        }
        
        return mime_mapping.get(suffix, 'application/octet-stream')
    
    async def process_document(
        self, 
        file_path: Path, 
        extract_text: bool = True,
        extract_metadata: bool = True,
        extract_structure: bool = False
    ) -> Dict[str, Any]:
        """Process document and extract content using Docling"""
        
        start_time = datetime.utcnow()
        job_id = str(uuid.uuid4())
        
        try:
            logger.info(f"Starting document processing: {file_path.name} (job_id: {job_id})")
            
            # Extract metadata
            metadata = None
            if extract_metadata:
                metadata_obj = await self.extract_metadata(file_path)
                metadata = {
                    "filename": metadata_obj.filename,
                    "file_size": metadata_obj.file_size,
                    "mime_type": metadata_obj.mime_type,
                    "document_type": metadata_obj.document_type.value,
                    "created_at": metadata_obj.created_at.isoformat(),
                    "modified_at": metadata_obj.modified_at.isoformat(),
                    "title": metadata_obj.title,
                }
            
            # Extract content using real Docling or mock implementation
            if self.use_real_docling and self.converter:
                logger.info(f"Using real Docling for processing: {file_path.name}")
                content = await self._real_extract_content(
                    file_path, 
                    extract_text, 
                    extract_structure
                )
            else:
                logger.info(f"Using mock implementation for processing: {file_path.name} (use_real_docling={self.use_real_docling}, converter={self.converter})")
                content = await self._mock_extract_content(
                    file_path, 
                    extract_text, 
                    extract_structure
                )
            
            end_time = datetime.utcnow()
            processing_time = (end_time - start_time).total_seconds()
            
            logger.info(f"Document processing completed: {file_path.name} in {processing_time:.2f}s")
            
            return {
                "job_id": job_id,
                "status": "completed",
                "metadata": metadata,
                "content": content,
                "processing_time": processing_time,
                "created_at": start_time.isoformat(),
                "completed_at": end_time.isoformat(),
                "processing_method": "real_docling" if self.use_real_docling else "mock"
            }
            
        except Exception as e:
            logger.error(f"Error processing document {file_path}: {e}")
            return {
                "job_id": job_id,
                "status": "failed",
                "error_message": str(e),
                "created_at": start_time.isoformat(),
                "completed_at": datetime.utcnow().isoformat(),
                "processing_method": "real_docling" if self.use_real_docling else "mock"
            }
    
    async def _mock_extract_content(
        self, 
        file_path: Path, 
        extract_text: bool,
        extract_structure: bool
    ) -> Dict[str, Any]:
        """Mock content extraction (replace with actual Docling implementation)"""
        
        content = {}
        
        if extract_text:
            # For text files, read content directly
            if file_path.suffix.lower() in ['.txt', '.md']:
                async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                    text_content = await f.read()
                content["text"] = text_content
                content["markdown"] = text_content if file_path.suffix.lower() == '.md' else f"```\n{text_content}\n```"
            else:
                # Mock extracted text for other formats
                text = f"[Mock extracted text from {file_path.name}]\n\nThis is placeholder text that demonstrates the document processing workflow. In the actual implementation, Docling would extract the real content from {file_path.suffix} files."
                content["text"] = text
                content["markdown"] = f"# {file_path.stem}\n\n{text}"
        
        if extract_structure:
            # Don't add fake table data - only real structure if detected
            logger.info("MOCK EXTRACT: Adding empty tables array instead of fake data")
            content["tables"] = []  # Empty array instead of fake tables
            
            content["layout_info"] = {
                "pages": 1,
                "layout_detected": False,  # Changed to False since no real structure detected
                "reading_order": [],
                "note": "No structure data available for this file type"
            }
        
        return content
    
    async def _real_extract_content(
        self, 
        file_path: Path, 
        extract_text: bool = True,
        extract_structure: bool = False
    ) -> Dict[str, Any]:
        """Extract content using real Docling DocumentConverter"""
        
        try:
            logger.info(f"Processing document with real Docling: {file_path}")
            
            # Convert document using Docling
            result = self.converter.convert(str(file_path))
            
            content = {
                "text": "",
                "images": [],
                "tables": [],
                "layout_info": {}
            }
            
            if extract_text:
                # Extract text from Docling result
                content["text"] = result.document.export_to_text()
                logger.info(f"Extracted {len(content['text'])} characters of text")
            
            if extract_structure:
                # Extract structured content from Docling result
                try:
                    # Get document structure
                    content["layout_info"] = {
                        "pages": len(result.document.pages) if hasattr(result.document, 'pages') else 1,
                        "layout_detected": True,
                        "processing_method": "docling"
                    }
                    
                    # Extract tables if available
                    if hasattr(result.document, 'tables') and result.document.tables:
                        content["tables"] = []
                        for table in result.document.tables:
                            table_data = {
                                "caption": getattr(table, 'caption', ''),
                                "data": []
                            }
                            # Convert table to structured format
                            if hasattr(table, 'export_to_dict'):
                                table_dict = table.export_to_dict()
                                table_data["data"] = table_dict.get('data', [])
                            content["tables"].append(table_data)
                    
                    # Extract images if available
                    if hasattr(result.document, 'images') and result.document.images:
                        content["images"] = []
                        for img in result.document.images:
                            img_data = {
                                "caption": getattr(img, 'caption', ''),
                                "path": getattr(img, 'path', ''),
                                "format": getattr(img, 'format', 'unknown')
                            }
                            content["images"].append(img_data)
                            
                except Exception as e:
                    logger.warning(f"Error extracting structure: {e}")
                    content["layout_info"] = {
                        "pages": 1,
                        "layout_detected": False,
                        "error": str(e)
                    }
            
            return content
            
        except Exception as e:
            logger.error(f"Error in real Docling extraction: {e}")
            # Fall back to simple extraction without fake structure data
            logger.info("Falling back to simple extraction without mock structure data")
            return await self._simple_extract_content(file_path, extract_text, extract_structure)

    async def _simple_extract_content(
        self, 
        file_path: Path, 
        extract_text: bool,
        extract_structure: bool
    ) -> Dict[str, Any]:
        """Simple content extraction without fake structure data"""
        
        logger.info("Using _simple_extract_content method (should have no fake tables)")
        content = {}
        
        if extract_text:
            # For text files, read content directly
            if file_path.suffix.lower() in ['.txt', '.md']:
                async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                    text_content = await f.read()
                content["text"] = text_content
                content["markdown"] = text_content if file_path.suffix.lower() == '.md' else f"```\n{text_content}\n```"
            else:
                # For other unsupported formats, provide a simple message
                content["text"] = f"[Content extracted from {file_path.name}]\n\nThis file format is not fully supported by Docling. Only basic text extraction is available."
                content["markdown"] = f"# {file_path.stem}\n\n{content['text']}"
        
        if extract_structure:
            # Only provide minimal structure info without fake data
            content["tables"] = []  # Empty array instead of fake tables
            content["layout_info"] = {
                "pages": 1,
                "layout_detected": False,
                "reading_order": [],
                "note": "Structure extraction not available for this file format"
            }
        
        return content

    async def process_batch(
        self, 
        file_paths: List[Path], 
        extract_text: bool = True,
        extract_metadata: bool = True,
        extract_structure: bool = False
    ) -> List[Dict[str, Any]]:
        """Process multiple documents in parallel"""
        
        logger.info(f"Starting batch processing of {len(file_paths)} documents")
        
        # Process documents concurrently
        tasks = [
            self.process_document(file_path, extract_text, extract_metadata, extract_structure) 
            for file_path in file_paths
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle any exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                # Create failed result for exceptions
                processed_results.append({
                    "job_id": str(uuid.uuid4()),
                    "status": "failed",
                    "error_message": str(result),
                    "created_at": datetime.utcnow().isoformat(),
                    "completed_at": datetime.utcnow().isoformat()
                })
            else:
                processed_results.append(result)
        
        logger.info(f"Batch processing completed: {len(processed_results)} results")
        return processed_results
    
    async def cleanup_temp_files(self, max_age_hours: int = 24):
        """Clean up old temporary files"""
        try:
            import time
            current_time = time.time()
            
            for file_path in self.temp_dir.iterdir():
                if file_path.is_file():
                    file_age = current_time - file_path.stat().st_mtime
                    if file_age > (max_age_hours * 3600):
                        file_path.unlink()
                        logger.info(f"Cleaned up old temp file: {file_path}")
                        
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
    
    async def extract_content_from_file(
        self, 
        file_path: Path,
        extract_text: bool = True,
        extract_metadata: bool = True,
        extract_structure: bool = False
    ) -> Dict[str, Any]:
        """Extract content from a single file - main interface method"""
        result = await self.process_document(
            file_path, 
            extract_text, 
            extract_metadata, 
            extract_structure
        )
        return result
    
    async def get_processing_status(self, job_id: str) -> Dict[str, Any]:
        """Get processing status for a job (mock implementation)"""
        # TODO: Implement real job tracking when needed
        return {
            "job_id": job_id,
            "status": "completed",
            "progress": 100.0,
            "message": "Mock status - job tracking not yet implemented"
        }

# Global service instance
docling_service = DoclingService()
