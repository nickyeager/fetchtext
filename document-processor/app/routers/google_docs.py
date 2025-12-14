"""
Google Docs API Router
Handles Google Docs integration with user-provided credentials
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
import tempfile
import asyncio
from pathlib import Path
import logging

from ..services.google_drive_service import google_drive_service
from ..services.docling_service import docling_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/google-docs", tags=["google-docs"])

class GoogleCredentials(BaseModel):
    auth_method: str = Field(..., description="Authentication method: 'oauth2' or 'service_account'")
    client_id: Optional[str] = Field(None, description="OAuth2 Client ID")
    client_secret: Optional[str] = Field(None, description="OAuth2 Client Secret")
    service_account_email: Optional[str] = Field(None, description="Service account email")
    service_account_key: Optional[str] = Field(None, description="Service account private key JSON")
    project_id: Optional[str] = Field(None, description="Google Cloud Project ID")

class GoogleDocLoadRequest(BaseModel):
    document_id: str = Field(..., description="Google Docs document ID")
    export_format: str = Field(default="text/plain", description="Export format MIME type")
    google_credentials: GoogleCredentials = Field(..., description="User's Google API credentials")
    process_immediately: bool = Field(default=True, description="Process with AI immediately")
    target_folder: str = Field(default="downloaded_docs", description="Target folder for processed documents")

class GoogleDocLoadResponse(BaseModel):
    success: bool
    message: str
    google_doc_id: str
    document_data: Optional[Dict[str, Any]] = None
    file_data: Optional[Dict[str, Any]] = None
    processed_at: Optional[str] = None
    downloaded_at: Optional[str] = None
    error: Optional[str] = None

class GoogleDocValidationRequest(BaseModel):
    document_id: str = Field(..., description="Google Docs document ID")
    google_credentials: GoogleCredentials = Field(..., description="User's Google API credentials")

class GoogleDocValidationResponse(BaseModel):
    valid: bool
    error: Optional[str] = None
    document_info: Optional[Dict[str, Any]] = None

@router.post("/load-document", response_model=GoogleDocLoadResponse)
async def load_google_document(request: GoogleDocLoadRequest):
    """
    Load and process a Google Doc using user-provided credentials
    """
    try:
        # Validate credentials format
        credentials_dict = request.google_credentials.dict()
        is_valid, validation_error = google_drive_service.validate_credentials_format(credentials_dict)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Invalid credentials: {validation_error}")
        
        # Download the document
        file_content, metadata, download_error = await google_drive_service.download_document(
            document_id=request.document_id,
            export_format=request.export_format,
            credentials=credentials_dict
        )
        
        if download_error:
            return GoogleDocLoadResponse(
                success=False,
                message="Failed to download document",
                google_doc_id=request.document_id,
                error=download_error
            )
        
        # Save the downloaded file temporarily
        with tempfile.NamedTemporaryFile(suffix='.tmp', delete=False) as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name
        
        try:
            response_data = {
                'success': True,
                'message': 'Document downloaded successfully',
                'google_doc_id': request.document_id,
                'file_data': {
                    'file_name': metadata['name'],
                    'mime_type': metadata['mime_type'],
                    'size': metadata['size'],
                    'export_format': request.export_format
                },
                'downloaded_at': metadata.get('modified_time')
            }
            
            # Process with AI if requested
            if request.process_immediately:
                try:
                    # Process the document with Docling
                    processing_result = await docling_service.process_document_with_ai(
                        file_path=temp_file_path,
                        extract_text=True,
                        extract_metadata=True,
                        extract_structure=True,
                        use_ai_enhancement=True
                    )
                    
                    response_data.update({
                        'message': 'Document downloaded and processed successfully',
                        'document_data': processing_result,
                        'processed_at': processing_result.get('processed_at')
                    })
                    
                except Exception as processing_error:
                    logger.error(f"Document processing failed: {processing_error}")
                    response_data.update({
                        'message': 'Document downloaded but processing failed',
                        'error': f"Processing failed: {str(processing_error)}"
                    })
            
            return GoogleDocLoadResponse(**response_data)
            
        finally:
            # Clean up temporary file
            try:
                Path(temp_file_path).unlink()
            except Exception as cleanup_error:
                logger.warning(f"Failed to clean up temp file: {cleanup_error}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in load_google_document: {e}")
        return GoogleDocLoadResponse(
            success=False,
            message="Internal server error",
            google_doc_id=request.document_id,
            error=str(e)
        )

@router.post("/validate-access", response_model=GoogleDocValidationResponse)
async def validate_document_access(request: GoogleDocValidationRequest):
    """
    Validate access to a Google Doc without downloading it
    """
    try:
        # Validate credentials format
        credentials_dict = request.google_credentials.dict()
        is_valid, validation_error = google_drive_service.validate_credentials_format(credentials_dict)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Invalid credentials: {validation_error}")
        
        # Validate document access
        has_access, access_error = await google_drive_service.validate_document_access(
            document_id=request.document_id,
            credentials=credentials_dict
        )
        
        if access_error:
            return GoogleDocValidationResponse(
                valid=False,
                error=access_error
            )
        
        return GoogleDocValidationResponse(
            valid=has_access,
            document_info={
                'document_id': request.document_id,
                'accessible': has_access
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in validate_document_access: {e}")
        return GoogleDocValidationResponse(
            valid=False,
            error=str(e)
        )

@router.post("/batch-load")
async def batch_load_documents(
    documents: List[GoogleDocLoadRequest]
):
    """
    Load multiple Google Docs in batch
    """
    try:
        results = []
        
        # Process documents concurrently with a limit
        semaphore = asyncio.Semaphore(3)  # Limit to 3 concurrent downloads
        
        async def process_document(doc_request):
            async with semaphore:
                return await load_google_document(doc_request)
        
        # Execute batch processing
        tasks = [process_document(doc) for doc in documents]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle any exceptions in results
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append(GoogleDocLoadResponse(
                    success=False,
                    message="Processing failed",
                    google_doc_id=documents[i].document_id,
                    error=str(result)
                ))
            else:
                processed_results.append(result)
        
        return {
            'total_requested': len(documents),
            'total_processed': len(processed_results),
            'successful': len([r for r in processed_results if r.success]),
            'failed': len([r for r in processed_results if not r.success]),
            'results': processed_results
        }
        
    except Exception as e:
        logger.error(f"Batch processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")

@router.get("/supported-formats")
async def get_supported_formats():
    """
    Get list of supported export formats for Google Docs
    """
    try:
        formats = await google_drive_service.get_supported_export_formats()
        return {
            'formats': [
                {
                    'mime_type': mime_type,
                    'description': description,
                    'extension': description.split('(')[-1].rstrip(')') if '(' in description else ''
                }
                for mime_type, description in formats.items()
            ]
        }
    except Exception as e:
        logger.error(f"Failed to get supported formats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get supported formats")

@router.post("/list-folder-documents")
async def list_folder_documents(
    folder_id: str,
    google_credentials: GoogleCredentials,
    page_size: int = 50
):
    """
    List Google Docs in a specific folder
    """
    try:
        # Validate credentials format
        credentials_dict = google_credentials.dict()
        is_valid, validation_error = google_drive_service.validate_credentials_format(credentials_dict)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Invalid credentials: {validation_error}")
        
        # List folder documents
        documents, list_error = await google_drive_service.list_folder_documents(
            folder_id=folder_id,
            credentials=credentials_dict,
            page_size=page_size
        )
        
        if list_error:
            raise HTTPException(status_code=400, detail=list_error)
        
        return {
            'folder_id': folder_id,
            'document_count': len(documents),
            'documents': documents
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list folder documents: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list folder documents: {str(e)}")

@router.get("/health")
async def health_check():
    """
    Health check endpoint for Google Docs integration
    """
    return {
        'status': 'healthy',
        'service': 'google-docs-integration',
        'features': [
            'document_download',
            'access_validation', 
            'batch_processing',
            'folder_listing',
            'oauth2_support',
            'service_account_support'
        ]
    }