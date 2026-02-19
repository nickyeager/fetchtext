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
        self.supported_formats = ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.txt', '.md', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff']
        
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
            logger.warning("Docling not available - document processing will fail")
            self.converter = None
            self.use_real_docling = False
        
    async def get_supported_formats(self) -> List[str]:
        """Return list of supported file formats"""
        return self.supported_formats
    
    async def get_service_status(self) -> Dict[str, Any]:
        """Get service status including Docling availability"""
        return {
            "service": "docling",
            "status": "healthy" if self.use_real_docling else "docling_unavailable",
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
            '.xlsx': DocumentType.XLSX,
            '.xls': DocumentType.XLSX,
            '.html': DocumentType.HTML,
            '.htm': DocumentType.HTML,
            '.md': DocumentType.MD,
            '.txt': DocumentType.TXT,
            '.png': DocumentType.IMAGE,
            '.jpg': DocumentType.IMAGE,
            '.jpeg': DocumentType.IMAGE,
            '.gif': DocumentType.IMAGE,
            '.webp': DocumentType.IMAGE,
            '.bmp': DocumentType.IMAGE,
            '.tiff': DocumentType.IMAGE,
            '.tif': DocumentType.IMAGE,
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
            '.ppt': 'application/vnd.ms-powerpoint',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.xls': 'application/vnd.ms-excel',
            '.html': 'text/html',
            '.htm': 'text/html',
            '.txt': 'text/plain',
            '.md': 'text/markdown',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.tiff': 'image/tiff',
            '.tif': 'image/tiff',
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
        import time as _time

        start_time = datetime.utcnow()
        t0 = _time.monotonic()
        job_id = str(uuid.uuid4())

        try:
            file_size = file_path.stat().st_size if file_path.exists() else -1
            logger.info(f"[DOCLING_TIMING] process_document START | file={file_path.name} | size={file_size} bytes | job_id={job_id}")

            # Extract metadata
            metadata = None
            if extract_metadata:
                t_meta = _time.monotonic()
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
                logger.info(f"[DOCLING_TIMING] extract_metadata DONE | file={file_path.name} | took={_time.monotonic() - t_meta:.2f}s")

            # Choose processing method based on file type and Docling availability
            file_suffix = file_path.suffix.lower()
            logger.info(f"[DOCLING_TIMING] Routing file | suffix={file_suffix} | use_real_docling={self.use_real_docling} | has_converter={bool(self.converter)}")

            # Text files and unsupported formats use enhanced text processing
            if file_suffix in ['.txt', '.text']:
                logger.info(f"Using enhanced text processing for: {file_path.name}")
                content = await self._enhanced_text_extract_content(
                    file_path,
                    extract_text,
                    extract_structure
                )
            elif self.use_real_docling and self.converter:
                logger.info(f"Using real Docling for processing: {file_path.name}")
                content = await self._real_extract_content(
                    file_path,
                    extract_text,
                    extract_structure
                )
            else:
                raise RuntimeError(f"Docling is not available - cannot process document: {file_path.name}. Real docling: {self.use_real_docling}, Converter: {bool(self.converter)}")

            end_time = datetime.utcnow()
            processing_time = (end_time - start_time).total_seconds()
            total_wall = _time.monotonic() - t0

            logger.info(f"[DOCLING_TIMING] process_document DONE | file={file_path.name} | processing_time={processing_time:.2f}s | wall={total_wall:.2f}s")
            
            return {
                "job_id": job_id,
                "status": "completed",
                "metadata": metadata,
                "content": content,
                "processing_time": processing_time,
                "created_at": start_time.isoformat(),
                "completed_at": end_time.isoformat(),
                "processing_method": "real_docling"
            }
            
        except Exception as e:
            logger.error(f"Error processing document {file_path}: {e}")
            return {
                "job_id": job_id,
                "status": "failed",
                "error_message": str(e),
                "created_at": start_time.isoformat(),
                "completed_at": datetime.utcnow().isoformat(),
                "processing_method": "real_docling"
            }
    
    
    async def _real_extract_content(
        self,
        file_path: Path,
        extract_text: bool = True,
        extract_structure: bool = False
    ) -> Dict[str, Any]:
        """Enhanced content extraction leveraging Docling's DoclingDocument structure"""

        import time as _time

        try:
            file_size = file_path.stat().st_size if file_path.exists() else -1
            logger.info(f"[DOCLING_TIMING] _real_extract_content START | file={file_path.name} | size={file_size} bytes | extract_text={extract_text} | extract_structure={extract_structure}")
            t0 = _time.monotonic()

            # Convert document using Docling.
            # Run in a thread so the synchronous Docling call doesn't block
            # the asyncio event loop (which would prevent SSE keepalives and
            # freeze all other requests for the duration of the conversion).
            logger.info(f"[DOCLING_TIMING] converter.convert() START | file={file_path.name}")
            t_convert_start = _time.monotonic()
            result = await asyncio.to_thread(self.converter.convert, str(file_path))
            t_convert_end = _time.monotonic()
            logger.info(f"[DOCLING_TIMING] converter.convert() DONE | file={file_path.name} | took={t_convert_end - t_convert_start:.2f}s")

            content = {
                "text": "",
                "markdown": "",
                "images": [],
                "tables": [],
                "layout_info": {},
                "document_structure": {},
                "chunks": []
            }

            if extract_text:
                # Extract both text and markdown formats
                logger.info(f"[DOCLING_TIMING] export_to_text() START | file={file_path.name}")
                t_text_start = _time.monotonic()
                content["text"] = result.document.export_to_text()
                t_text_end = _time.monotonic()
                logger.info(f"[DOCLING_TIMING] export_to_text() DONE | file={file_path.name} | took={t_text_end - t_text_start:.2f}s | chars={len(content['text'])}")
                # Try to extract markdown if available
                try:
                    logger.info(f"[DOCLING_TIMING] export_to_markdown() START | file={file_path.name}")
                    t_md_start = _time.monotonic()
                    content["markdown"] = result.document.export_to_markdown()
                    t_md_end = _time.monotonic()
                    logger.info(f"[DOCLING_TIMING] export_to_markdown() DONE | file={file_path.name} | took={t_md_end - t_md_start:.2f}s | chars={len(content['markdown'])}")
                except AttributeError:
                    content["markdown"] = content["text"]  # Fallback to text
                logger.info(f"Extracted {len(content['text'])} characters of text and {len(content['markdown'])} characters of markdown")
            
            if extract_structure:
                # Enhanced structure extraction using DoclingDocument features
                try:
                    # Extract document hierarchy and structure
                    content["document_structure"] = await self._extract_document_hierarchy(result.document)
                    
                    # Enhanced layout information
                    content["layout_info"] = await self._extract_enhanced_layout(result.document)
                    
                    # Extract tables with rich metadata
                    content["tables"] = await self._extract_enhanced_tables(result.document)
                    
                    # Extract images with metadata  
                    content["images"] = await self._extract_enhanced_images(result.document)
                    
                    # Intelligent chunking based on document structure
                    if extract_text and content["text"]:
                        content["chunks"] = await self._create_intelligent_chunks(result.document, content["text"])
                            
                except Exception as e:
                    logger.warning(f"Error extracting structure: {e}")
                    content["layout_info"] = {
                        "pages": 1,
                        "layout_detected": False,
                        "error": str(e)
                    }
            
            t_total = _time.monotonic() - t0
            logger.info(f"[DOCLING_TIMING] _real_extract_content DONE | file={file_path.name} | total={t_total:.2f}s")
            return content

        except Exception as e:
            logger.error(f"Error in real Docling extraction: {e}", exc_info=True)
            raise RuntimeError(f"Document processing failed: {str(e)}")


    async def _enhanced_text_extract_content(
        self,
        file_path: Path,
        extract_text: bool,
        extract_structure: bool
    ) -> Dict[str, Any]:
        """Enhanced text file processing with intelligent chunking and structure analysis"""
        
        try:
            # Read file with encoding detection
            try:
                import chardet
                with open(file_path, 'rb') as f:
                    raw_data = f.read()
                    detected = chardet.detect(raw_data)
                    encoding = detected.get('encoding') or 'utf-8'
            except (ImportError, Exception):
                encoding = 'utf-8'
            
            # Read text content
            with open(file_path, 'r', encoding=encoding, errors='replace') as f:
                text_content = f.read().strip()
            
            content = {
                "text": text_content,
                "markdown": text_content,
                "images": [],
                "tables": [],
                "layout_info": {},
                "document_structure": {},
                "chunks": []
            }
            
            if extract_structure and text_content:
                # Enhanced structure analysis for text files
                content["document_structure"] = await self._analyze_text_file_structure(text_content)
                content["layout_info"] = {
                    "pages": 1,
                    "layout_detected": True,
                    "processing_method": "enhanced_text_analysis",
                    "encoding": encoding,
                    "line_count": len(text_content.splitlines()),
                    "word_count": len(text_content.split()),
                    "character_count": len(text_content)
                }
                
                # Create intelligent chunks for text files
                content["chunks"] = await self._create_semantic_chunks(text_content)
            
            return content
            
        except Exception as e:
            logger.error(f"Error in enhanced text extraction: {e}")
            return {
                "text": "",
                "markdown": "",
                "images": [],
                "tables": [],
                "layout_info": {"error": str(e), "fallback": True},
                "document_structure": {},
                "chunks": []
            }
    
    async def _analyze_text_file_structure(self, content: str) -> Dict[str, Any]:
        """Analyze structure of text files (markdown-like patterns)"""
        
        lines = content.splitlines()
        structure = {
            "headings": [],
            "paragraphs": [],
            "sections": [],
            "body_elements": [],
            "furniture_elements": [],
            "groups": []
        }
        
        current_section = None
        paragraph_text = ""
        
        for i, line in enumerate(lines):
            line = line.strip()
            
            if not line:  # Empty line
                if paragraph_text:
                    structure["body_elements"].append({
                        "type": "paragraph",
                        "content": paragraph_text.strip(),
                        "position": {"line_number": i}
                    })
                    paragraph_text = ""
                continue
            
            # Detect headings
            if line.startswith('#') or self._is_heading_like(line):
                # Save current paragraph
                if paragraph_text:
                    structure["body_elements"].append({
                        "type": "paragraph", 
                        "content": paragraph_text.strip(),
                        "position": {"line_number": i}
                    })
                    paragraph_text = ""
                
                # Add heading
                level = line.count('#') if line.startswith('#') else 1
                structure["headings"].append({
                    "text": line.lstrip('#').strip(),
                    "level": level,
                    "line_number": i + 1
                })
                
                structure["body_elements"].append({
                    "type": "heading",
                    "content": line,
                    "position": {"line_number": i + 1, "level": level}
                })
                
                current_section = line.lstrip('#').strip()
            else:
                # Regular content
                if paragraph_text:
                    paragraph_text += " " + line
                else:
                    paragraph_text = line
        
        # Add final paragraph
        if paragraph_text:
            structure["body_elements"].append({
                "type": "paragraph",
                "content": paragraph_text.strip(), 
                "position": {"line_number": len(lines)}
            })
        
        return structure
    
    def _is_heading_like(self, line: str) -> bool:
        """Detect heading-like patterns in text"""
        line = line.strip()
        
        # Short lines that are all caps
        if line.isupper() and len(line.split()) <= 6 and len(line) > 2:
            return True
        
        # Lines ending with colon (like "Introduction:")
        if line.endswith(':') and len(line.split()) <= 5:
            return True
        
        # Numbered headings (1. Introduction, 2. Methods, etc.)
        import re
        if re.match(r'^\d+[\.\)]\s+[A-Z]', line):
            return True
        
        return False

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

    async def _extract_document_hierarchy(self, doc) -> Dict[str, Any]:
        """Extract document hierarchy and structure using Docling's body/furniture organization"""
        try:
            hierarchy = {
                "body_elements": [],
                "furniture_elements": [],
                "groups": [],
                "reading_order": [],
                "section_structure": []
            }
            
            # Extract main body content if available
            if hasattr(doc, 'body') and doc.body:
                for item in doc.body:
                    element = {
                        "type": item.__class__.__name__ if hasattr(item, '__class__') else 'unknown',
                        "content": str(item) if hasattr(item, '__str__') else '',
                        "position": getattr(item, 'prov', {}) if hasattr(item, 'prov') else {}
                    }
                    hierarchy["body_elements"].append(element)
            
            # Extract furniture (headers, footers, etc.) if available
            if hasattr(doc, 'furniture') and doc.furniture:
                for item in doc.furniture:
                    element = {
                        "type": item.__class__.__name__ if hasattr(item, '__class__') else 'unknown',
                        "content": str(item) if hasattr(item, '__str__') else '',
                        "position": getattr(item, 'prov', {}) if hasattr(item, 'prov') else {}
                    }
                    hierarchy["furniture_elements"].append(element)
            
            # Extract groups if available  
            if hasattr(doc, 'groups') and doc.groups:
                for group in doc.groups:
                    group_info = {
                        "type": group.__class__.__name__ if hasattr(group, '__class__') else 'unknown',
                        "items": [],
                        "metadata": getattr(group, 'prov', {}) if hasattr(group, 'prov') else {}
                    }
                    hierarchy["groups"].append(group_info)
            
            return hierarchy
            
        except Exception as e:
            logger.warning(f"Error extracting document hierarchy: {e}")
            return {"error": str(e), "fallback": True}
    
    async def _extract_enhanced_layout(self, doc) -> Dict[str, Any]:
        """Extract enhanced layout information from DoclingDocument"""
        try:
            layout = {
                "pages": 1,
                "layout_detected": True,
                "processing_method": "docling_enhanced",
                "bounding_boxes": [],
                "page_dimensions": [],
                "content_regions": []
            }
            
            # Extract page information if available
            if hasattr(doc, 'pages') and doc.pages:
                layout["pages"] = len(doc.pages)
                for i, page in enumerate(doc.pages):
                    page_info = {
                        "page_number": i + 1,
                        "width": getattr(page, 'width', 0),
                        "height": getattr(page, 'height', 0),
                        "elements": []
                    }
                    layout["page_dimensions"].append(page_info)
            
            # Extract layout elements with positioning if available
            if hasattr(doc, 'body') and doc.body:
                for item in doc.body:
                    if hasattr(item, 'prov') and item.prov:
                        bbox_info = {
                            "element_type": item.__class__.__name__ if hasattr(item, '__class__') else 'unknown',
                            "bbox": item.prov,
                            "content_preview": str(item)[:100] if hasattr(item, '__str__') else ''
                        }
                        layout["bounding_boxes"].append(bbox_info)
            
            return layout
            
        except Exception as e:
            logger.warning(f"Error extracting enhanced layout: {e}")
            return {
                "pages": 1,
                "layout_detected": False,
                "error": str(e),
                "fallback": True
            }
    
    async def _extract_enhanced_tables(self, doc) -> List[Dict[str, Any]]:
        """Extract tables with enhanced metadata and structure"""
        tables = []
        
        try:
            # Look for table items in the document body
            if hasattr(doc, 'body') and doc.body:
                for item in doc.body:
                    if hasattr(item, '__class__') and 'table' in item.__class__.__name__.lower():
                        table_info = {
                            "type": "table",
                            "caption": getattr(item, 'caption', ''),
                            "position": getattr(item, 'prov', {}),
                            "data": [],
                            "structure": {},
                            "metadata": {
                                "row_count": 0,
                                "col_count": 0,
                                "has_header": False
                            }
                        }
                        
                        # Extract table data if available
                        if hasattr(item, 'export_to_dict'):
                            try:
                                table_dict = item.export_to_dict()
                                table_info["data"] = table_dict.get('data', [])
                                table_info["structure"] = table_dict.get('structure', {})
                            except Exception as e:
                                logger.warning(f"Error exporting table data: {e}")
                        
                        # Calculate metadata
                        if table_info["data"]:
                            table_info["metadata"]["row_count"] = len(table_info["data"])
                            if table_info["data"]:
                                table_info["metadata"]["col_count"] = len(table_info["data"][0]) if isinstance(table_info["data"][0], list) else 0
                        
                        tables.append(table_info)
            
            return tables
            
        except Exception as e:
            logger.warning(f"Error extracting enhanced tables: {e}")
            return []
    
    async def _extract_enhanced_images(self, doc) -> List[Dict[str, Any]]:
        """Extract images with enhanced metadata"""
        images = []
        
        try:
            # Look for picture items in the document body
            if hasattr(doc, 'body') and doc.body:
                for item in doc.body:
                    if hasattr(item, '__class__') and 'picture' in item.__class__.__name__.lower():
                        image_info = {
                            "type": "image",
                            "caption": getattr(item, 'caption', ''),
                            "position": getattr(item, 'prov', {}),
                            "format": getattr(item, 'format', 'unknown'),
                            "path": getattr(item, 'path', ''),
                            "metadata": {
                                "width": getattr(item, 'width', 0),
                                "height": getattr(item, 'height', 0),
                                "alt_text": getattr(item, 'alt_text', ''),
                                "classification": getattr(item, 'classification', 'unknown')
                            }
                        }
                        images.append(image_info)
            
            return images
            
        except Exception as e:
            logger.warning(f"Error extracting enhanced images: {e}")
            return []
    
    async def _create_intelligent_chunks(self, doc, text: str) -> List[Dict[str, Any]]:
        """Enhanced intelligent chunking with multiple strategies for optimal vector processing"""
        chunks = []
        
        try:
            # Strategy 1: Advanced structure-based chunking using document hierarchy
            if hasattr(doc, 'body') and doc.body:
                chunks = await self._create_structure_aware_chunks(doc, text)
            
            # Strategy 2: Semantic chunking for unstructured content
            if not chunks and text:
                chunks = await self._create_advanced_semantic_chunks(text)
            
            # Strategy 3: Fallback to sliding window chunking
            if not chunks and text:
                chunks = await self._create_sliding_window_chunks(text)
            
            # Post-process chunks for optimization
            chunks = await self._optimize_chunks(chunks)
            
            logger.info(f"Created {len(chunks)} intelligent chunks using various strategies")
            return chunks
            
        except Exception as e:
            logger.warning(f"Error creating intelligent chunks: {e}")
            # Final fallback to simple chunking
            return await self._create_simple_chunks(text)
    
    async def _create_structure_aware_chunks(self, doc, text: str) -> List[Dict[str, Any]]:
        """Create chunks that respect document structure and content hierarchy"""
        chunks = []
        
        try:
            current_section = ""
            current_chunk = ""
            chunk_metadata = {
                "section": "",
                "primary_types": [],
                "contains": {"headings": 0, "paragraphs": 0, "tables": 0, "images": 0},
                "page": 1,
                "start_element": 0,
                "end_element": 0
            }
            
            for i, item in enumerate(doc.body):
                item_text = str(item) if hasattr(item, '__str__') else ''
                item_type = item.__class__.__name__ if hasattr(item, '__class__') else 'unknown'
                
                # Update section tracking for headings
                if self._is_heading_type(item_type) and item_text.strip():
                    current_section = item_text.strip()
                
                # Determine if we should create a new chunk
                should_split = self._should_create_structure_chunk(
                    current_chunk, item_text, item_type, chunk_metadata
                )
                
                if should_split and current_chunk.strip():
                    # Finalize current chunk
                    chunk_metadata["end_element"] = i - 1
                    chunks.append({
                        "text": current_chunk.strip(),
                        "chunk_id": len(chunks),
                        "source": "structure_aware",
                        "metadata": chunk_metadata.copy(),
                        "word_count": len(current_chunk.split()),
                        "character_count": len(current_chunk),
                        "section": current_section,
                        "content_types": list(set(chunk_metadata["primary_types"]))
                    })
                    
                    # Start new chunk
                    current_chunk = item_text
                    chunk_metadata = {
                        "section": current_section,
                        "primary_types": [item_type],
                        "contains": {"headings": 0, "paragraphs": 0, "tables": 0, "images": 0},
                        "page": self._extract_page_number(item),
                        "start_element": i,
                        "end_element": i
                    }
                    self._update_content_counts(chunk_metadata, item_type)
                else:
                    # Continue building current chunk
                    if current_chunk:
                        current_chunk += "\n\n" + item_text
                    else:
                        current_chunk = item_text
                        chunk_metadata["start_element"] = i
                    
                    chunk_metadata["primary_types"].append(item_type)
                    self._update_content_counts(chunk_metadata, item_type)
                    chunk_metadata["end_element"] = i
            
            # Add final chunk
            if current_chunk.strip():
                chunks.append({
                    "text": current_chunk.strip(),
                    "chunk_id": len(chunks),
                    "source": "structure_aware",
                    "metadata": chunk_metadata.copy(),
                    "word_count": len(current_chunk.split()),
                    "character_count": len(current_chunk),
                    "section": current_section,
                    "content_types": list(set(chunk_metadata["primary_types"]))
                })
            
            return chunks
            
        except Exception as e:
            logger.warning(f"Error in structure-aware chunking: {e}")
            return []
    
    def _is_heading_type(self, item_type: str) -> bool:
        """Detect if an item is a heading type"""
        return any(heading_term in item_type.lower() 
                  for heading_term in ['heading', 'title', 'header', 'section'])
    
    def _extract_page_number(self, item) -> int:
        """Extract page number from item provenance"""
        try:
            if hasattr(item, 'prov') and item.prov:
                return item.prov.get('page_no', 1)
            return 1
        except:
            return 1
    
    def _update_content_counts(self, metadata: Dict[str, Any], item_type: str):
        """Update content type counts in metadata"""
        item_type_lower = item_type.lower()
        if 'heading' in item_type_lower:
            metadata["contains"]["headings"] += 1
        elif 'paragraph' in item_type_lower or 'text' in item_type_lower:
            metadata["contains"]["paragraphs"] += 1
        elif 'table' in item_type_lower:
            metadata["contains"]["tables"] += 1
        elif 'picture' in item_type_lower or 'image' in item_type_lower:
            metadata["contains"]["images"] += 1
    
    def _should_create_structure_chunk(self, 
                                     current_chunk: str, 
                                     new_item: str, 
                                     item_type: str,
                                     metadata: Dict[str, Any]) -> bool:
        """Enhanced logic for structure-based chunk creation"""
        
        if not current_chunk.strip():
            return False
        
        # 1. Major structural boundaries (always split)
        if self._is_heading_type(item_type):
            return True
        
        # 2. Content type transitions (split for tables, images)
        if item_type.lower() in ['table', 'picture', 'image'] and metadata["primary_types"]:
            last_type = metadata["primary_types"][-1].lower()
            if last_type not in ['table', 'picture', 'image']:
                return True
        
        # 3. Size-based splitting (optimal for embeddings: 200-500 words)
        combined_words = len((current_chunk + " " + new_item).split())
        if combined_words > 450:
            return True
        
        # 4. Semantic coherence (split if content becomes too diverse)
        unique_types = len(set(metadata["primary_types"]))
        if unique_types > 3 and combined_words > 300:
            return True
        
        # 5. Page boundaries (optional split for multi-page documents)
        current_page = metadata.get("page", 1)
        new_page = self._extract_page_number(new_item)
        if new_page > current_page and combined_words > 200:
            return True
        
        return False
    
    def _should_create_new_chunk(self, current_chunk: str, new_item: str, item_type: str) -> bool:
        """Determine if a new chunk should be created based on content and structure"""
        
        # Always create new chunk if current is empty
        if not current_chunk.strip():
            return False
        
        # Create new chunk for major structural elements
        if item_type.lower() in ['heading', 'title', 'section']:
            return True
        
        # Create new chunk if combined size would be too large (optimal for embeddings: 200-500 words)
        combined_words = len((current_chunk + " " + new_item).split())
        if combined_words > 400:
            return True
        
        # Create new chunk for different content types
        current_type = getattr(current_chunk, 'primary_type', 'text')
        if item_type != current_type and item_type.lower() in ['table', 'image', 'list']:
            return True
        
        return False
    
    async def _create_advanced_semantic_chunks(self, text: str) -> List[Dict[str, Any]]:
        """Advanced semantic chunking with sentence boundary detection and topic coherence"""
        chunks = []
        
        try:
            # Step 1: Split into sentences for better boundary detection
            sentences = self._split_into_sentences(text)
            if not sentences:
                return await self._create_simple_chunks(text)
            
            # Step 2: Group sentences into coherent chunks
            current_chunk_sentences = []
            current_word_count = 0
            topic_keywords = set()
            
            for i, sentence in enumerate(sentences):
                sentence_words = sentence.split()
                sentence_word_count = len(sentence_words)
                
                # Extract keywords for topic coherence
                sentence_keywords = self._extract_keywords(sentence)
                
                # Determine if we should start a new chunk
                should_split = self._should_split_semantic_chunk(
                    current_word_count, sentence_word_count,
                    topic_keywords, sentence_keywords,
                    len(current_chunk_sentences)
                )
                
                if should_split and current_chunk_sentences:
                    # Create chunk from accumulated sentences
                    chunk_text = " ".join(current_chunk_sentences).strip()
                    chunks.append({
                        "text": chunk_text,
                        "chunk_id": len(chunks),
                        "source": "advanced_semantic",
                        "metadata": {
                            "sentence_range": f"{i - len(current_chunk_sentences)}-{i-1}",
                            "sentence_count": len(current_chunk_sentences),
                            "topic_keywords": list(topic_keywords)[:10],  # Top 10 keywords
                            "coherence_score": self._calculate_coherence_score(topic_keywords, sentence_keywords)
                        },
                        "word_count": current_word_count,
                        "character_count": len(chunk_text)
                    })
                    
                    # Start new chunk
                    current_chunk_sentences = [sentence]
                    current_word_count = sentence_word_count
                    topic_keywords = sentence_keywords.copy()
                else:
                    # Add sentence to current chunk
                    current_chunk_sentences.append(sentence)
                    current_word_count += sentence_word_count
                    topic_keywords.update(sentence_keywords)
            
            # Add final chunk
            if current_chunk_sentences:
                chunk_text = " ".join(current_chunk_sentences).strip()
                chunks.append({
                    "text": chunk_text,
                    "chunk_id": len(chunks),
                    "source": "advanced_semantic",
                    "metadata": {
                        "sentence_range": f"{len(sentences) - len(current_chunk_sentences)}-{len(sentences)-1}",
                        "sentence_count": len(current_chunk_sentences),
                        "topic_keywords": list(topic_keywords)[:10],
                        "coherence_score": 1.0  # Final chunk gets max coherence
                    },
                    "word_count": current_word_count,
                    "character_count": len(chunk_text)
                })
            
            return chunks
            
        except Exception as e:
            logger.warning(f"Error creating advanced semantic chunks: {e}")
            return await self._create_semantic_chunks(text)
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences using simple heuristics"""
        import re
        
        # Simple sentence splitting (can be enhanced with NLTK/spaCy if needed)
        # Split on common sentence endings followed by whitespace and capital letters
        sentence_pattern = r'(?<=[.!?])\s+(?=[A-Z])'
        sentences = re.split(sentence_pattern, text)
        
        # Clean and filter sentences
        cleaned_sentences = []
        for sentence in sentences:
            sentence = sentence.strip()
            if sentence and len(sentence.split()) >= 3:  # Minimum 3 words per sentence
                cleaned_sentences.append(sentence)
        
        return cleaned_sentences
    
    def _extract_keywords(self, text: str) -> set:
        """Extract important keywords from text for topic coherence"""
        import re
        
        # Simple keyword extraction (can be enhanced with TF-IDF, etc.)
        # Remove common stop words and extract meaningful terms
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 
            'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves'
        }
        
        # Extract words, convert to lowercase, filter stop words
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
        keywords = {word for word in words if word not in stop_words and len(word) > 2}
        
        return keywords
    
    def _should_split_semantic_chunk(self,
                                   current_word_count: int,
                                   new_sentence_words: int,
                                   current_keywords: set,
                                   new_keywords: set,
                                   sentence_count: int) -> bool:
        """Determine if a semantic chunk should be split"""
        
        # Don't split if chunk is too small
        if sentence_count < 2:
            return False
        
        # Split if combined size would be too large
        if current_word_count + new_sentence_words > 450:
            return True
        
        # Split if topic coherence is low (keywords don't overlap much)
        if current_keywords and new_keywords:
            overlap = len(current_keywords.intersection(new_keywords))
            total_unique = len(current_keywords.union(new_keywords))
            coherence = overlap / total_unique if total_unique > 0 else 0
            
            # Split if coherence is low and chunk is reasonably sized
            if coherence < 0.2 and current_word_count > 200:
                return True
        
        # Split if chunk has many sentences (readability)
        if sentence_count >= 8:
            return True
        
        return False
    
    def _calculate_coherence_score(self, keywords1: set, keywords2: set) -> float:
        """Calculate topic coherence score between two keyword sets"""
        if not keywords1 or not keywords2:
            return 0.0
        
        overlap = len(keywords1.intersection(keywords2))
        total = len(keywords1.union(keywords2))
        
        return overlap / total if total > 0 else 0.0
    
    async def _create_sliding_window_chunks(self, text: str, 
                                          chunk_size: int = 350,
                                          overlap_size: int = 50) -> List[Dict[str, Any]]:
        """Create overlapping chunks using sliding window approach"""
        chunks = []
        
        try:
            words = text.split()
            if len(words) <= chunk_size:
                # Text is smaller than chunk size, return as single chunk
                return [{
                    "text": text,
                    "chunk_id": 0,
                    "source": "sliding_window_single",
                    "metadata": {"window_size": len(words), "overlap": 0},
                    "word_count": len(words),
                    "character_count": len(text)
                }]
            
            start = 0
            chunk_id = 0
            
            while start < len(words):
                # Determine end position
                end = min(start + chunk_size, len(words))
                
                # Extract chunk words
                chunk_words = words[start:end]
                chunk_text = " ".join(chunk_words)
                
                chunks.append({
                    "text": chunk_text,
                    "chunk_id": chunk_id,
                    "source": "sliding_window",
                    "metadata": {
                        "window_start": start,
                        "window_end": end,
                        "window_size": len(chunk_words),
                        "overlap": overlap_size if start > 0 else 0,
                        "total_words": len(words)
                    },
                    "word_count": len(chunk_words),
                    "character_count": len(chunk_text)
                })
                
                # Move start position (with overlap)
                if end >= len(words):
                    break
                
                start = end - overlap_size
                chunk_id += 1
            
            return chunks
            
        except Exception as e:
            logger.warning(f"Error creating sliding window chunks: {e}")
            return await self._create_simple_chunks(text)
    
    async def _optimize_chunks(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Post-process chunks for optimization (merge small chunks, split large ones)"""
        if not chunks:
            return chunks
        
        try:
            optimized_chunks = []
            i = 0
            
            while i < len(chunks):
                current_chunk = chunks[i]
                
                # Check if chunk is too small and can be merged with next
                if (current_chunk["word_count"] < 100 and 
                    i + 1 < len(chunks) and 
                    chunks[i + 1]["word_count"] < 350):
                    
                    # Merge with next chunk
                    next_chunk = chunks[i + 1]
                    merged_text = current_chunk["text"] + "\n\n" + next_chunk["text"]
                    
                    merged_chunk = {
                        "text": merged_text,
                        "chunk_id": len(optimized_chunks),
                        "source": f"merged_{current_chunk['source']}",
                        "metadata": {
                            "merged_from": [current_chunk["chunk_id"], next_chunk["chunk_id"]],
                            "original_sources": [current_chunk["source"], next_chunk["source"]],
                            **current_chunk.get("metadata", {})
                        },
                        "word_count": len(merged_text.split()),
                        "character_count": len(merged_text),
                        "section": current_chunk.get("section", ""),
                        "content_types": list(set(
                            current_chunk.get("content_types", []) + 
                            next_chunk.get("content_types", [])
                        ))
                    }
                    
                    optimized_chunks.append(merged_chunk)
                    i += 2  # Skip next chunk as it's been merged
                else:
                    # Check if chunk is too large and should be split
                    if current_chunk["word_count"] > 600:
                        # Split large chunk
                        split_chunks = await self._split_large_chunk(current_chunk)
                        for j, split_chunk in enumerate(split_chunks):
                            split_chunk["chunk_id"] = len(optimized_chunks)
                            optimized_chunks.append(split_chunk)
                    else:
                        # Keep chunk as is, but update chunk_id
                        current_chunk["chunk_id"] = len(optimized_chunks)
                        optimized_chunks.append(current_chunk)
                    i += 1
            
            logger.debug(f"Optimized {len(chunks)} chunks to {len(optimized_chunks)} chunks")
            return optimized_chunks
            
        except Exception as e:
            logger.warning(f"Error optimizing chunks: {e}")
            return chunks
    
    async def _split_large_chunk(self, chunk: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Split a large chunk into smaller pieces"""
        try:
            text = chunk["text"]
            # Try to split by paragraphs first
            paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
            
            if len(paragraphs) > 1:
                # Split by paragraphs
                sub_chunks = []
                current_text = ""
                
                for i, paragraph in enumerate(paragraphs):
                    if len((current_text + " " + paragraph).split()) > 400:
                        if current_text:
                            sub_chunks.append(current_text.strip())
                        current_text = paragraph
                    else:
                        current_text = (current_text + "\n\n" + paragraph).strip()
                
                if current_text:
                    sub_chunks.append(current_text)
            else:
                # Split by words if no paragraphs
                words = text.split()
                chunk_size = len(words) // 2
                sub_chunks = [
                    " ".join(words[:chunk_size]),
                    " ".join(words[chunk_size:])
                ]
            
            # Create chunk objects
            result_chunks = []
            for i, sub_text in enumerate(sub_chunks):
                result_chunks.append({
                    "text": sub_text,
                    "chunk_id": 0,  # Will be set by caller
                    "source": f"split_{chunk['source']}",
                    "metadata": {
                        "split_from": chunk["chunk_id"],
                        "split_part": i + 1,
                        "split_total": len(sub_chunks),
                        **chunk.get("metadata", {})
                    },
                    "word_count": len(sub_text.split()),
                    "character_count": len(sub_text),
                    "section": chunk.get("section", ""),
                    "content_types": chunk.get("content_types", [])
                })
            
            return result_chunks
            
        except Exception as e:
            logger.warning(f"Error splitting large chunk: {e}")
            return [chunk]  # Return original chunk if splitting fails
    
    async def _create_semantic_chunks(self, text: str) -> List[Dict[str, Any]]:
        """Create semantically meaningful chunks based on paragraphs and sentences"""
        chunks = []
        
        try:
            # Split by double newlines (paragraphs)
            paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
            
            current_chunk = ""
            for i, paragraph in enumerate(paragraphs):
                if len((current_chunk + " " + paragraph).split()) > 400:
                    if current_chunk.strip():
                        chunks.append({
                            "text": current_chunk.strip(),
                            "chunk_id": len(chunks),
                            "source": "semantic_paragraphs",
                            "metadata": {"paragraph_range": f"{max(0, i-1)}-{i}"},
                            "word_count": len(current_chunk.split()),
                            "character_count": len(current_chunk)
                        })
                    current_chunk = paragraph
                else:
                    current_chunk = (current_chunk + "\n\n" + paragraph).strip()
            
            # Add final chunk
            if current_chunk.strip():
                chunks.append({
                    "text": current_chunk.strip(),
                    "chunk_id": len(chunks),
                    "source": "semantic_paragraphs",
                    "metadata": {"paragraph_range": f"{len(paragraphs)-1}"},
                    "word_count": len(current_chunk.split()),
                    "character_count": len(current_chunk)
                })
            
            return chunks
            
        except Exception as e:
            logger.warning(f"Error creating semantic chunks: {e}")
            return await self._create_simple_chunks(text)
    
    async def _create_simple_chunks(self, text: str, chunk_size: int = 300) -> List[Dict[str, Any]]:
        """Simple word-based chunking as fallback"""
        chunks = []
        
        try:
            words = text.split()
            for i in range(0, len(words), chunk_size):
                chunk_words = words[i:i + chunk_size]
                chunk_text = " ".join(chunk_words)
                
                chunks.append({
                    "text": chunk_text,
                    "chunk_id": len(chunks),
                    "source": "simple_word_based",
                    "metadata": {"word_range": f"{i}-{min(i + chunk_size, len(words))}"},
                    "word_count": len(chunk_words),
                    "character_count": len(chunk_text)
                })
            
            return chunks
            
        except Exception as e:
            logger.error(f"Error creating simple chunks: {e}")
            return []


    async def find_text_positions(
        self,
        file_path: Path,
        search_texts: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Find positions of specific text strings in a document.

        This method processes a document and finds where specific text strings
        appear, returning position data including bounding boxes when available.

        Args:
            file_path: Path to the document
            search_texts: List of text strings to find

        Returns:
            List of position data for found texts, each containing:
            - text: The search text that was found
            - found_in: Context where the text was found (truncated to 100 chars)
            - page: Page number where found (1-indexed)
            - bbox: Bounding box dict with x, y, width, height (may be None)
            - element_type: Type of document element (e.g., 'TextItem', 'paragraph')
        """
        positions = []

        # Return empty list for empty search
        if not search_texts:
            return positions

        try:
            # Determine file type and processing method
            file_suffix = file_path.suffix.lower()

            # For text files, use enhanced text extraction
            if file_suffix in ['.txt', '.text']:
                return await self._find_text_positions_in_text_file(file_path, search_texts)

            # For PDFs and other formats, use Docling if available
            if not self.use_real_docling or not self.converter:
                logger.warning("Docling not available for position extraction, falling back to text search")
                return await self._find_text_positions_in_text_file(file_path, search_texts)

            # Convert document using Docling.
            # Run in a thread to avoid blocking the event loop.
            result = await asyncio.to_thread(self.converter.convert, str(file_path))
            doc = result.document

            # Build page height lookup for coordinate conversion
            # PDF coordinates have origin at bottom-left, screen coords at top-left
            page_heights: Dict[int, float] = {}
            if hasattr(doc, 'pages') and doc.pages:
                for page_id, page_data in doc.pages.items():
                    if hasattr(page_data, 'size') and page_data.size:
                        page_heights[page_id] = float(page_data.size.height)

            # Extract text with positions from texts list (correct Docling API)
            # doc.texts is a list of text items (TextItem, SectionHeaderItem, etc.)
            if hasattr(doc, 'texts') and doc.texts:
                for item in doc.texts:
                    # Get text content from the item
                    item_text = getattr(item, 'text', '') or ''
                    if not item_text:
                        continue

                    # Check if any search text is in this item (case-insensitive)
                    for search_text in search_texts:
                        if search_text.lower() in item_text.lower():
                            # Extract provenance/position data
                            prov = getattr(item, 'prov', None)
                            bbox_data = None
                            page_num = 1

                            if prov:
                                # Docling prov is a list of provenance entries
                                for p in prov:
                                    # Get page number
                                    if hasattr(p, 'page_no'):
                                        page_num = p.page_no

                                    # Get bounding box
                                    if hasattr(p, 'bbox') and p.bbox:
                                        bbox = p.bbox
                                        # Docling uses l, t, r, b for left, top, right, bottom
                                        # PDF coordinates: origin at bottom-left, y increases upward
                                        # Screen coordinates: origin at top-left, y increases downward
                                        # Convert: screen_y = page_height - pdf_top
                                        page_height = page_heights.get(page_num, 792.0)  # Default to US Letter

                                        x = float(bbox.l) if hasattr(bbox, 'l') else 0
                                        # bbox.t is top (higher y in PDF), bbox.b is bottom (lower y in PDF)
                                        # For screen coords, we want y from top of page
                                        pdf_top = float(max(bbox.t, bbox.b)) if hasattr(bbox, 't') and hasattr(bbox, 'b') else 0
                                        pdf_bottom = float(min(bbox.t, bbox.b)) if hasattr(bbox, 't') and hasattr(bbox, 'b') else 0
                                        height = abs(pdf_top - pdf_bottom)
                                        # Convert to screen coordinates (flip y-axis)
                                        screen_y = page_height - pdf_top
                                        width = abs(float(bbox.r - bbox.l)) if hasattr(bbox, 'r') and hasattr(bbox, 'l') else 0

                                        bbox_data = {
                                            "x": x,
                                            "y": screen_y,
                                            "width": width,
                                            "height": height,
                                            "page_height": page_height,  # Include for debugging
                                        }
                                    # Use first provenance entry with bbox
                                    if bbox_data:
                                        break

                            positions.append({
                                "text": search_text,
                                "found_in": item_text[:100],
                                "page": page_num,
                                "bbox": bbox_data,
                                "element_type": item.__class__.__name__ if hasattr(item, '__class__') else 'unknown'
                            })

            return positions

        except Exception as e:
            logger.error(f"Error finding text positions: {e}")
            return positions

    async def _find_text_positions_in_text_file(
        self,
        file_path: Path,
        search_texts: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Find text positions in a plain text file.

        For text files, we can still provide position data based on line numbers
        even though we don't have precise bounding boxes.

        Args:
            file_path: Path to the text file
            search_texts: List of text strings to find

        Returns:
            List of position data for found texts
        """
        positions = []

        try:
            # Read file with encoding detection
            try:
                import chardet
                with open(file_path, 'rb') as f:
                    raw_data = f.read()
                    detected = chardet.detect(raw_data)
                    encoding = detected.get('encoding') or 'utf-8'
            except (ImportError, Exception):
                encoding = 'utf-8'

            # Read text content
            with open(file_path, 'r', encoding=encoding, errors='replace') as f:
                lines = f.readlines()

            # Search for each text in each line (case-insensitive)
            for search_text in search_texts:
                search_lower = search_text.lower()
                for line_num, line in enumerate(lines, start=1):
                    if search_lower in line.lower():
                        # Found the text, create position entry
                        positions.append({
                            "text": search_text,
                            "found_in": line.strip()[:100],
                            "page": 1,  # Text files are treated as single page
                            "bbox": None,  # No bbox for text files
                            "element_type": "text_line",
                            "line_number": line_num
                        })

            return positions

        except Exception as e:
            logger.error(f"Error finding text positions in text file: {e}")
            return positions


# Global service instance
docling_service = DoclingService()
