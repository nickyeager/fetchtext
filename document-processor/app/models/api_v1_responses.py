"""
Response models for the Third-Party API v1 endpoints.

These models provide type hints and example data for OpenAPI documentation.
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime


# =============================================================================
# PROCESS DOCUMENT RESPONSE
# =============================================================================

class ProcessDocumentResponse(BaseModel):
    """Response when document processing is initiated."""

    job_id: str = Field(
        ...,
        description="Unique identifier for tracking this processing job",
        json_schema_extra={"example": "abc123-def456-ghi789"}
    )
    status: str = Field(
        ...,
        description="Current job status",
        json_schema_extra={"example": "pending"}
    )
    message: str = Field(
        ...,
        description="Human-readable status message",
        json_schema_extra={"example": "Document processing started"}
    )
    webhook_url: Optional[str] = Field(
        None,
        description="URL where results will be POSTed when complete",
        json_schema_extra={"example": "https://your-app.com/webhooks/fetchtext"}
    )
    estimated_completion_seconds: int = Field(
        ...,
        description="Estimated time until processing completes",
        json_schema_extra={"example": 30}
    )
    created_at: str = Field(
        ...,
        description="ISO 8601 timestamp when job was created",
        json_schema_extra={"example": "2025-02-04T12:00:00Z"}
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "job_id": "abc123-def456-ghi789",
                "status": "pending",
                "message": "Document processing started",
                "webhook_url": "https://your-app.com/webhooks/fetchtext",
                "estimated_completion_seconds": 30,
                "created_at": "2025-02-04T12:00:00Z"
            }
        }
    }


# =============================================================================
# EXTRACTED FIELD
# =============================================================================

class ExtractedField(BaseModel):
    """A single extracted field with value and confidence."""

    value: Any = Field(
        ...,
        description="The extracted value",
        json_schema_extra={"example": "Acme Corp"}
    )
    confidence: float = Field(
        ...,
        description="Confidence score (0.0 - 1.0)",
        ge=0.0,
        le=1.0,
        json_schema_extra={"example": 0.95}
    )


# =============================================================================
# JOB RESULT
# =============================================================================

class JobResult(BaseModel):
    """Result data when job completes successfully."""

    template_id: Optional[str] = Field(
        None,
        description="ID of the template used for extraction",
        json_schema_extra={"example": "tpl_invoice_001"}
    )
    template_name: Optional[str] = Field(
        None,
        description="Name of the template used",
        json_schema_extra={"example": "Invoice Template"}
    )
    template_category: Optional[str] = Field(
        None,
        description="Category of the matched template",
        json_schema_extra={"example": "invoice"}
    )
    extracted_data: Dict[str, ExtractedField] = Field(
        default_factory=dict,
        description="Extracted fields with values and confidence scores",
        json_schema_extra={
            "example": {
                "vendor_name": {"value": "Acme Corp", "confidence": 0.95},
                "invoice_number": {"value": "INV-2025-001", "confidence": 0.98},
                "total_amount": {"value": "$1,234.56", "confidence": 0.92},
                "due_date": {"value": "2025-03-01", "confidence": 0.89}
            }
        }
    )
    extraction_method: str = Field(
        ...,
        description="How the template was determined",
        json_schema_extra={"example": "template_matched"}
    )
    match_score: Optional[float] = Field(
        None,
        description="Template match confidence (if auto-matched)",
        json_schema_extra={"example": 0.87}
    )
    document_preview: Optional[str] = Field(
        None,
        description="First 500 characters of extracted text",
        json_schema_extra={"example": "INVOICE\n\nFrom: Acme Corp\nInvoice #: INV-2025-001..."}
    )


# =============================================================================
# JOB STATUS RESPONSE
# =============================================================================

class JobStatusResponse(BaseModel):
    """Response when querying job status."""

    job_id: str = Field(
        ...,
        description="Unique job identifier",
        json_schema_extra={"example": "abc123-def456-ghi789"}
    )
    status: str = Field(
        ...,
        description="Job status: pending, processing, completed, failed",
        json_schema_extra={"example": "completed"}
    )
    result: Optional[JobResult] = Field(
        None,
        description="Extraction results (when status is 'completed')"
    )
    error: Optional[str] = Field(
        None,
        description="Error message (when status is 'failed')",
        json_schema_extra={"example": None}
    )
    processing_time_ms: Optional[int] = Field(
        None,
        description="Total processing time in milliseconds",
        json_schema_extra={"example": 2341}
    )
    created_at: str = Field(
        ...,
        description="When the job was created",
        json_schema_extra={"example": "2025-02-04T12:00:00Z"}
    )
    completed_at: Optional[str] = Field(
        None,
        description="When the job completed (if finished)",
        json_schema_extra={"example": "2025-02-04T12:00:02Z"}
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "job_id": "abc123-def456-ghi789",
                "status": "completed",
                "result": {
                    "template_id": "tpl_invoice_001",
                    "template_name": "Invoice Template",
                    "template_category": "invoice",
                    "extracted_data": {
                        "vendor_name": {"value": "Acme Corp", "confidence": 0.95},
                        "invoice_number": {"value": "INV-2025-001", "confidence": 0.98},
                        "total_amount": {"value": "$1,234.56", "confidence": 0.92},
                        "due_date": {"value": "2025-03-01", "confidence": 0.89}
                    },
                    "extraction_method": "template_matched",
                    "match_score": 0.87,
                    "document_preview": "INVOICE\n\nFrom: Acme Corp\nInvoice #: INV-2025-001..."
                },
                "error": None,
                "processing_time_ms": 2341,
                "created_at": "2025-02-04T12:00:00Z",
                "completed_at": "2025-02-04T12:00:02Z"
            }
        }
    }


# =============================================================================
# TEMPLATE LIST RESPONSE
# =============================================================================

class TemplateInfo(BaseModel):
    """Basic template information."""

    id: str = Field(..., json_schema_extra={"example": "tpl_invoice_001"})
    name: str = Field(..., json_schema_extra={"example": "Invoice Template"})
    category: str = Field(..., json_schema_extra={"example": "invoice"})
    field_count: int = Field(..., json_schema_extra={"example": 8})
    created_at: str = Field(..., json_schema_extra={"example": "2025-01-15T10:30:00Z"})


class TemplateListResponse(BaseModel):
    """Response when listing available templates."""

    templates: List[TemplateInfo] = Field(
        ...,
        description="List of available templates"
    )
    count: int = Field(
        ...,
        description="Number of templates returned",
        json_schema_extra={"example": 15}
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "templates": [
                    {
                        "id": "tpl_invoice_001",
                        "name": "Invoice Template",
                        "category": "invoice",
                        "field_count": 8,
                        "created_at": "2025-01-15T10:30:00Z"
                    },
                    {
                        "id": "tpl_contract_001",
                        "name": "Service Agreement",
                        "category": "contract",
                        "field_count": 12,
                        "created_at": "2025-01-20T14:00:00Z"
                    }
                ],
                "count": 15
            }
        }
    }


# =============================================================================
# HEALTH CHECK RESPONSE
# =============================================================================

class HealthResponse(BaseModel):
    """API health check response."""

    status: str = Field(..., json_schema_extra={"example": "healthy"})
    api_version: str = Field(..., json_schema_extra={"example": "v1"})
    database: str = Field(..., json_schema_extra={"example": "connected"})
    timestamp: str = Field(..., json_schema_extra={"example": "2025-02-04T12:00:00Z"})

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "healthy",
                "api_version": "v1",
                "database": "connected",
                "timestamp": "2025-02-04T12:00:00Z"
            }
        }
    }
