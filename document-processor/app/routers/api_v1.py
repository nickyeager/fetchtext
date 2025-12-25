"""
Third-Party Public API Router (v1)

Provides external API endpoints for document processing and template operations.
All endpoints require API key authentication (Bearer token starting with 'ftxt_').

Endpoints:
- POST /api/v1/process - Process document with template matching/generation
- GET /api/v1/jobs/{job_id} - Get job status and results
- POST /api/v1/templates/generate - Generate template from sample document
"""

import asyncio
import uuid
import logging
import sys
import tempfile
import aiofiles
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks, Query, Form
from fastapi.responses import JSONResponse

from ..middleware.api_auth import api_key_auth
from ..services.webhook_service import webhook_service
from ..services.enhanced_docling_service import enhanced_docling_service
from ..services.document_evaluator import document_evaluator
from ..services.smart_field_extractor import smart_field_extractor
from ..config.database import db_config

# Safe logger initialization
try:
    logger = logging.getLogger(__name__)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
except Exception:
    logging.basicConfig(stream=sys.stdout, level=logging.INFO)
    logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Third-Party API v1"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def save_uploaded_file(upload_file: UploadFile, job_id: str) -> Path:
    """Save uploaded file to temporary location."""
    temp_dir = Path(tempfile.gettempdir()) / "fetchtext_api"
    temp_dir.mkdir(exist_ok=True)

    file_extension = Path(upload_file.filename or "document").suffix
    temp_filename = f"{job_id}{file_extension}"
    temp_path = temp_dir / temp_filename

    async with aiofiles.open(temp_path, 'wb') as f:
        content = await upload_file.read()
        await f.write(content)

    return temp_path


async def cleanup_temp_file(file_path: Path) -> None:
    """Remove temporary file."""
    try:
        if file_path.exists():
            file_path.unlink()
    except Exception as e:
        logger.debug(f"Failed to cleanup temp file: {e}")


# ============================================================================
# BACKGROUND PROCESSING TASKS
# ============================================================================

async def process_document_background(
    job_id: str,
    file_path: Path,
    template_id: Optional[str],
    webhook_url: Optional[str],
    webhook_secret: Optional[str],
    auto_generate_template: bool,
    confidence_threshold: float,
    organization_id: str,
    original_filename: str
) -> None:
    """
    Background task for document processing.

    Flow:
    1. Update job status to 'processing'
    2. If template_id provided, use that template
    3. Otherwise, evaluate document and match/generate template
    4. Extract fields using matched/generated template
    5. Update job with results
    6. Deliver webhook if configured
    7. Cleanup temp file
    """
    try:
        logger.info(f"Starting background processing for job {job_id}")

        # Update status to processing
        if db_config.client:
            db_config.client.table('api_jobs').update({
                'status': 'processing',
                'started_at': datetime.utcnow().isoformat()
            }).eq('id', job_id).execute()

        result_data = {}

        if template_id:
            # Use specified template
            result_data = await _process_with_template(
                file_path=file_path,
                template_id=template_id,
                organization_id=organization_id,
                confidence_threshold=confidence_threshold
            )
        else:
            # Evaluate and match/generate template
            result_data = await _process_with_auto_template(
                file_path=file_path,
                organization_id=organization_id,
                auto_generate_template=auto_generate_template,
                confidence_threshold=confidence_threshold,
                original_filename=original_filename
            )

        # Update job as completed
        processing_time_ms = None
        if db_config.client:
            # Get started_at to calculate processing time
            job_result = db_config.client.table('api_jobs').select(
                'started_at'
            ).eq('id', job_id).single().execute()

            if job_result.data and job_result.data.get('started_at'):
                started_at = datetime.fromisoformat(
                    job_result.data['started_at'].replace('Z', '+00:00')
                )
                processing_time_ms = int(
                    (datetime.utcnow().replace(tzinfo=started_at.tzinfo) - started_at).total_seconds() * 1000
                )

            db_config.client.table('api_jobs').update({
                'status': 'completed',
                'result_data': result_data,
                'completed_at': datetime.utcnow().isoformat(),
                'processing_time_ms': processing_time_ms
            }).eq('id', job_id).execute()

        logger.info(f"Job {job_id} completed successfully")

        # Deliver webhook if configured
        if webhook_url:
            webhook_payload = {
                'job_id': job_id,
                'status': 'completed',
                'result': result_data,
                'processing_time_ms': processing_time_ms,
                'completed_at': datetime.utcnow().isoformat()
            }

            await webhook_service.deliver_webhook(
                job_id=job_id,
                webhook_url=webhook_url,
                payload=webhook_payload,
                webhook_secret=webhook_secret
            )

    except Exception as e:
        logger.error(f"Background processing failed for job {job_id}: {e}", exc_info=True)

        error_message = str(e)

        # Update job as failed
        if db_config.client:
            db_config.client.table('api_jobs').update({
                'status': 'failed',
                'error_message': error_message,
                'completed_at': datetime.utcnow().isoformat()
            }).eq('id', job_id).execute()

        # Deliver error webhook if configured
        if webhook_url:
            await webhook_service.deliver_webhook(
                job_id=job_id,
                webhook_url=webhook_url,
                payload={
                    'job_id': job_id,
                    'status': 'failed',
                    'error': error_message,
                    'completed_at': datetime.utcnow().isoformat()
                },
                webhook_secret=webhook_secret
            )

    finally:
        # Cleanup temp file
        await cleanup_temp_file(file_path)


async def _process_with_template(
    file_path: Path,
    template_id: str,
    organization_id: str,
    confidence_threshold: float
) -> Dict[str, Any]:
    """Process document with a specific template."""
    if not db_config.client:
        raise ValueError("Database not configured")

    # Fetch template
    template_result = db_config.client.table('smart_templates').select(
        'id, name, smart_variables, category'
    ).eq('id', template_id).execute()

    if not template_result.data:
        raise ValueError(f"Template {template_id} not found")

    template = template_result.data[0]

    # Extract document text
    doc_result = await enhanced_docling_service.process_document(
        file_path,
        extract_text=True,
        extract_metadata=True,
        extract_structure=False
    )

    text_content = doc_result.get('content', {}).get('text', '')

    if not text_content:
        raise ValueError("No text could be extracted from document")

    # Extract fields using template
    smart_variables = template.get('smart_variables', [])

    if smart_variables:
        extracted_data = await smart_field_extractor.extract_fields_intelligently(
            text_content,
            smart_variables,
            confidence_threshold,
            provider='azure'
        )
    else:
        extracted_data = {'message': 'Template has no smart variables defined'}

    return {
        'template_id': template_id,
        'template_name': template.get('name'),
        'template_category': template.get('category'),
        'extracted_data': extracted_data,
        'document_preview': text_content[:500] if text_content else None,
        'extraction_method': 'template_provided'
    }


async def _process_with_auto_template(
    file_path: Path,
    organization_id: str,
    auto_generate_template: bool,
    confidence_threshold: float,
    original_filename: str
) -> Dict[str, Any]:
    """Process document with automatic template matching/generation."""
    # Evaluate document type and get template suggestions
    evaluation = await document_evaluator.evaluate_document(
        file_path,
        original_filename,
        '',  # content_type not needed
        quick_scan=True,
        user_id=None  # Use org-level templates
    )

    suggestions = evaluation.get('template_suggestions', [])
    doc_type = evaluation.get('type_evaluation', {}).get('primary_type', 'document')

    # Check for strong template match
    if suggestions and suggestions[0].get('match_score', 0) >= confidence_threshold:
        matched = suggestions[0]
        template_id = matched.get('template_id')

        logger.info(f"Template matched: {matched.get('template_name')} (score: {matched.get('match_score')})")

        # Process with matched template
        result = await _process_with_template(
            file_path=file_path,
            template_id=str(template_id),
            organization_id=organization_id,
            confidence_threshold=confidence_threshold
        )

        result['match_score'] = matched.get('match_score')
        result['extraction_method'] = 'template_matched'
        result['alternatives'] = [
            {'id': s.get('template_id'), 'name': s.get('template_name'), 'score': s.get('match_score')}
            for s in suggestions[1:4]  # Top 3 alternatives
        ]

        return result

    # No strong match - generate template if allowed
    if auto_generate_template:
        logger.info(f"No template match found, generating new template for {doc_type}")

        try:
            from ..services.ai_template_generator import ai_template_generator

            # Analyze document structure
            analysis = await ai_template_generator.analyze_document_structure(file_path)

            # Generate template
            template_name = f"{doc_type.title()} Template (Auto-generated)"
            generated = await ai_template_generator.generate_template_from_analysis(
                analysis, template_name
            )

            # Save template to organization
            if db_config.client and generated:
                saved = db_config.client.table('smart_templates').insert({
                    'name': template_name,
                    'description': f'Auto-generated template for {doc_type} documents',
                    'organization_id': organization_id,
                    'smart_variables': generated.get('variables', []),
                    'category': doc_type,
                    'is_public': False,
                    'created_at': datetime.utcnow().isoformat()
                }).execute()

                if saved.data:
                    template_id = saved.data[0]['id']

                    return {
                        'template_id': template_id,
                        'template_name': template_name,
                        'template_generated': True,
                        'detected_document_type': doc_type,
                        'detected_fields': len(generated.get('variables', [])),
                        'extraction_method': 'template_generated',
                        'message': 'New template generated and saved. Re-process with template_id for field extraction.'
                    }

        except Exception as e:
            logger.error(f"Template generation failed: {e}", exc_info=True)
            raise ValueError(f"Template generation failed: {str(e)}")

    # No match and auto-generate disabled
    return {
        'template_id': None,
        'template_name': None,
        'detected_document_type': doc_type,
        'match_score': suggestions[0].get('match_score') if suggestions else 0,
        'suggestions': [
            {'id': s.get('template_id'), 'name': s.get('template_name'), 'score': s.get('match_score')}
            for s in suggestions[:5]
        ],
        'extraction_method': 'no_match',
        'message': 'No template match found. Enable auto_generate_template or provide a template_id.'
    }


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.post("/process")
async def process_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Document file to process (PDF, DOCX, images)"),
    template_id: Optional[str] = Form(None, description="Specific template ID to use (skips auto-matching)"),
    webhook_url: Optional[str] = Form(None, description="URL to POST results when processing completes"),
    webhook_secret: Optional[str] = Form(None, description="Secret for HMAC webhook signature verification"),
    auto_generate_template: bool = Form(True, description="Auto-generate template if no match found"),
    confidence_threshold: float = Form(0.7, ge=0.0, le=1.0, description="Minimum confidence for extraction"),
    api_context: dict = Depends(api_key_auth.verify_api_key)
):
    """
    Process a document with template matching and field extraction.

    **Authentication**: Bearer token (API Key starting with `ftxt_`)

    **Rate Limits**:
    - 10 uploads per minute (configurable per API key)
    - 60 requests per minute (general)

    **Workflow**:
    1. Upload document (PDF, DOCX, images supported)
    2. If `template_id` provided: use that template for extraction
    3. Otherwise: auto-match to existing template
    4. If no match and `auto_generate_template=true`: generate new template
    5. Extract structured data using matched/generated template
    6. POST results to `webhook_url` when complete (if provided)

    **Returns**: Job ID for tracking (processing is asynchronous)

    **Webhook Payload**:
    ```json
    {
        "job_id": "uuid",
        "status": "completed",
        "result": {
            "template_id": "...",
            "template_name": "...",
            "extracted_data": {...},
            "extraction_method": "template_matched|template_generated|template_provided"
        },
        "processing_time_ms": 1234,
        "completed_at": "2025-01-01T00:00:00Z"
    }
    ```
    """
    # Check rate limit (upload limit)
    await api_key_auth.check_rate_limit(api_context, '/api/v1/process', is_upload=True)

    # Check permission
    if not api_key_auth.has_permission(api_context, 'upload'):
        raise HTTPException(
            status_code=403,
            detail="API key does not have 'upload' permission"
        )

    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Create job ID and record
    job_id = str(uuid.uuid4())

    try:
        if db_config.client:
            db_config.client.table('api_jobs').insert({
                'id': job_id,
                'api_key_id': api_context['api_key_id'],
                'organization_id': api_context['organization_id'],
                'job_type': 'document_process',
                'status': 'pending',
                'input_data': {
                    'filename': file.filename,
                    'template_id': template_id,
                    'auto_generate_template': auto_generate_template,
                    'confidence_threshold': confidence_threshold
                },
                'webhook_url': webhook_url,
                'webhook_secret': webhook_secret
            }).execute()
    except Exception as e:
        logger.error(f"Failed to create job record: {e}")
        raise HTTPException(status_code=500, detail="Failed to create processing job")

    # Save file and schedule background processing
    try:
        file_path = await save_uploaded_file(file, job_id)

        background_tasks.add_task(
            process_document_background,
            job_id=job_id,
            file_path=file_path,
            template_id=template_id,
            webhook_url=webhook_url,
            webhook_secret=webhook_secret,
            auto_generate_template=auto_generate_template,
            confidence_threshold=confidence_threshold,
            organization_id=api_context['organization_id'],
            original_filename=file.filename
        )

    except Exception as e:
        logger.error(f"Failed to save file for processing: {e}")
        # Update job as failed
        if db_config.client:
            db_config.client.table('api_jobs').update({
                'status': 'failed',
                'error_message': str(e)
            }).eq('id', job_id).execute()
        raise HTTPException(status_code=500, detail="Failed to save file for processing")

    logger.info(f"Created processing job {job_id} for {file.filename}")

    return JSONResponse(
        content={
            'job_id': job_id,
            'status': 'pending',
            'message': 'Document processing started',
            'webhook_url': webhook_url,
            'estimated_completion_seconds': 30 if auto_generate_template else 10,
            'created_at': datetime.utcnow().isoformat()
        },
        status_code=202
    )


@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    api_context: dict = Depends(api_key_auth.verify_api_key)
):
    """
    Get the status and results of a processing job.

    **Authentication**: Bearer token (API Key)

    **Returns**:
    - Job status (pending, processing, completed, failed)
    - Result data (if completed)
    - Error message (if failed)
    - Processing metrics
    """
    # Check rate limit
    await api_key_auth.check_rate_limit(api_context, '/api/v1/jobs', is_upload=False)

    if not db_config.client:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        result = db_config.client.table('api_jobs').select(
            'id, job_type, status, input_data, result_data, error_message, '
            'webhook_url, webhook_delivered_at, webhook_attempts, '
            'created_at, started_at, completed_at, processing_time_ms'
        ).eq('id', job_id).eq('organization_id', api_context['organization_id']).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Job not found")

        job = result.data[0]

        response = {
            'job_id': job['id'],
            'status': job['status'],
            'job_type': job['job_type'],
            'created_at': job['created_at'],
            'started_at': job.get('started_at'),
            'completed_at': job.get('completed_at'),
            'processing_time_ms': job.get('processing_time_ms')
        }

        if job['status'] == 'completed':
            response['result'] = job.get('result_data')
        elif job['status'] == 'failed':
            response['error'] = job.get('error_message')

        if job.get('webhook_url'):
            response['webhook'] = {
                'url': job['webhook_url'],
                'delivered': job.get('webhook_delivered_at') is not None,
                'attempts': job.get('webhook_attempts', 0)
            }

        return JSONResponse(content=response)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch job status: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve job status")


@router.get("/templates")
async def list_templates(
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=100, description="Maximum templates to return"),
    api_context: dict = Depends(api_key_auth.verify_api_key)
):
    """
    List available templates for the organization.

    **Authentication**: Bearer token (API Key)

    **Returns**: List of templates with id, name, category, and field count
    """
    # Check rate limit
    await api_key_auth.check_rate_limit(api_context, '/api/v1/templates', is_upload=False)

    if not api_key_auth.has_permission(api_context, 'templates_read'):
        raise HTTPException(
            status_code=403,
            detail="API key does not have 'templates_read' permission"
        )

    if not db_config.client:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        query = db_config.client.table('smart_templates').select(
            'id, name, description, category, smart_variables, is_public, created_at'
        ).or_(
            f"organization_id.eq.{api_context['organization_id']},is_public.eq.true"
        ).order('created_at', desc=True).limit(limit)

        if category:
            query = query.eq('category', category)

        result = query.execute()

        templates = [
            {
                'id': t['id'],
                'name': t['name'],
                'description': t.get('description'),
                'category': t.get('category'),
                'field_count': len(t.get('smart_variables', [])),
                'is_public': t.get('is_public', False),
                'created_at': t['created_at']
            }
            for t in (result.data or [])
        ]

        return JSONResponse(content={
            'templates': templates,
            'count': len(templates)
        })

    except Exception as e:
        logger.error(f"Failed to list templates: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve templates")


@router.get("/health")
async def api_health():
    """
    Health check endpoint for the third-party API.

    No authentication required.
    """
    db_status = "connected" if (db_config.is_configured and db_config.client) else "disconnected"

    return JSONResponse(content={
        'status': 'healthy',
        'api_version': 'v1',
        'database': db_status,
        'timestamp': datetime.utcnow().isoformat()
    })
