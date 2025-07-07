from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from enum import Enum
import uuid
from datetime import datetime

class DocumentType(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    PPTX = "pptx"
    HTML = "html"
    MD = "md"
    TXT = "txt"
    IMAGE = "image"
    UNKNOWN = "unknown"

class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class DocumentProcessRequest(BaseModel):
    """Request model for document processing"""
    extract_text: bool = Field(default=True, description="Extract text content")
    extract_images: bool = Field(default=False, description="Extract embedded images")
    extract_tables: bool = Field(default=True, description="Extract table data")
    extract_metadata: bool = Field(default=True, description="Extract document metadata")
    output_format: str = Field(default="json", description="Output format: json, markdown, html")
    preserve_layout: bool = Field(default=True, description="Preserve document layout information")
    
class DocumentMetadata(BaseModel):
    """Document metadata model"""
    filename: str
    file_size: int
    mime_type: str
    document_type: DocumentType
    page_count: Optional[int] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    author: Optional[str] = None
    title: Optional[str] = None
    subject: Optional[str] = None

class ExtractedContent(BaseModel):
    """Extracted content model"""
    text: Optional[str] = None
    markdown: Optional[str] = None
    html: Optional[str] = None
    images: List[Dict[str, Any]] = Field(default_factory=list)
    tables: List[Dict[str, Any]] = Field(default_factory=list)
    layout_info: Optional[Dict[str, Any]] = None

class ProcessingResult(BaseModel):
    """Processing result model"""
    job_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: ProcessingStatus
    metadata: Optional[DocumentMetadata] = None
    content: Optional[ExtractedContent] = None
    error_message: Optional[str] = None
    processing_time: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

class ProcessingJob(BaseModel):
    """Processing job tracking model"""
    job_id: str
    filename: str
    status: ProcessingStatus
    progress: float = Field(default=0.0, ge=0.0, le=100.0)
    created_at: datetime
    updated_at: datetime
    error_message: Optional[str] = None
    result: Optional[ProcessingResult] = None

class BatchProcessRequest(BaseModel):
    """Batch processing request model"""
    job_ids: List[str]
    common_options: DocumentProcessRequest = Field(default_factory=DocumentProcessRequest)

class HealthStatus(BaseModel):
    """Health check response model"""
    status: str
    service: str
    version: Optional[str] = None
    checks: Optional[Dict[str, bool]] = None
    error: Optional[str] = None

class DocumentProcessingResponse(BaseModel):
    """Response model for document upload/processing"""
    job_id: str
    status: str
    filename: str
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DocumentProcessingStatus(BaseModel):
    """Status model for document processing"""
    job_id: str
    status: str
    progress: float = Field(ge=0.0, le=100.0)
    message: str
    filename: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class BatchProcessingRequest(BaseModel):
    """Request model for batch processing"""
    extract_text: bool = Field(default=True)
    extract_metadata: bool = Field(default=True) 
    extract_structure: bool = Field(default=False)
    output_format: str = Field(default="json")

class BatchProcessingResponse(BaseModel):
    """Response model for batch processing"""
    batch_id: str
    job_ids: List[str]
    total_files: int
    status: str
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
