from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Query
from fastapi.responses import JSONResponse
from typing import List, Optional
import uuid
import os
import shutil
from pathlib import Path

from app.services.docling_service import DoclingService
from app.models.document import (
    DocumentProcessingResponse,
    DocumentProcessingStatus,
    BatchProcessingRequest,
    BatchProcessingResponse,
    DocumentMetadata
)

router = APIRouter(prefix="/documents", tags=["documents"])

# Initialize the Docling service
docling_service = DoclingService()

# Storage for tracking processing status
processing_status = {}

@router.post("/upload", response_model=DocumentProcessingResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    extract_text: bool = Query(True, description="Extract text content from document"),
    extract_metadata: bool = Query(True, description="Extract document metadata"),
    extract_structure: bool = Query(False, description="Extract document structure/layout")
):
    """
    Upload and process a single document
    """
    # Validate file type
    allowed_extensions = {'.pdf', '.docx', '.pptx', '.html', '.md', '.txt'}
    file_extension = Path(file.filename).suffix.lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file_extension}. Supported types: {', '.join(allowed_extensions)}"
        )
    
    # Generate unique job ID
    job_id = str(uuid.uuid4())
    
    # Create temporary file storage
    temp_dir = Path("temp_uploads")
    temp_dir.mkdir(exist_ok=True)
    
    temp_file_path = temp_dir / f"{job_id}_{file.filename}"
    
    try:
        # Save uploaded file
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Initialize processing status
        processing_status[job_id] = {
            "status": "processing",
            "filename": file.filename,
            "progress": 0,
            "message": "Processing started"
        }
        
        # Start background processing
        background_tasks.add_task(
            process_document_background,
            job_id,
            temp_file_path,
            extract_text,
            extract_metadata,
            extract_structure
        )
        
        return DocumentProcessingResponse(
            job_id=job_id,
            status="processing",
            filename=file.filename,
            message="Document uploaded and processing started"
        )
    
    except Exception as e:
        # Clean up temp file if error occurs
        if temp_file_path.exists():
            temp_file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@router.get("/status/{job_id}", response_model=DocumentProcessingStatus)
async def get_processing_status(job_id: str):
    """
    Get the processing status of a document
    """
    if job_id not in processing_status:
        raise HTTPException(status_code=404, detail="Job ID not found")
    
    status_info = processing_status[job_id]
    
    return DocumentProcessingStatus(
        job_id=job_id,
        status=status_info["status"],
        progress=status_info["progress"],
        message=status_info["message"],
        filename=status_info["filename"],
        result=status_info.get("result"),
        error=status_info.get("error")
    )

@router.get("/result/{job_id}")
async def get_processing_result(job_id: str):
    """
    Get the processing result of a completed document
    """
    if job_id not in processing_status:
        raise HTTPException(status_code=404, detail="Job ID not found")
    
    status_info = processing_status[job_id]
    
    if status_info["status"] != "completed":
        raise HTTPException(
            status_code=400, 
            detail=f"Processing not completed. Current status: {status_info['status']}"
        )
    
    if "result" not in status_info:
        raise HTTPException(status_code=404, detail="Processing result not found")
    
    return status_info["result"]

@router.post("/batch", response_model=BatchProcessingResponse)
async def batch_process_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    extract_text: bool = Query(True),
    extract_metadata: bool = Query(True),
    extract_structure: bool = Query(False)
):
    """
    Process multiple documents in batch
    """
    if len(files) > 10:  # Limit batch size
        raise HTTPException(status_code=400, detail="Maximum 10 files allowed per batch")
    
    batch_id = str(uuid.uuid4())
    job_ids = []
    
    # Create temporary directory for batch
    temp_dir = Path("temp_uploads") / batch_id
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        for i, file in enumerate(files):
            # Validate file type
            allowed_extensions = {'.pdf', '.docx', '.pptx', '.html', '.md', '.txt'}
            file_extension = Path(file.filename).suffix.lower()
            
            if file_extension not in allowed_extensions:
                continue  # Skip unsupported files
            
            # Generate job ID for each file
            job_id = f"{batch_id}_{i}"
            job_ids.append(job_id)
            
            # Save file
            temp_file_path = temp_dir / f"{job_id}_{file.filename}"
            with open(temp_file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Initialize status
            processing_status[job_id] = {
                "status": "queued",
                "filename": file.filename,
                "progress": 0,
                "message": "Queued for processing",
                "batch_id": batch_id
            }
        
        # Start batch processing
        background_tasks.add_task(
            process_batch_background,
            batch_id,
            job_ids,
            temp_dir,
            extract_text,
            extract_metadata,
            extract_structure
        )
        
        return BatchProcessingResponse(
            batch_id=batch_id,
            job_ids=job_ids,
            total_files=len(job_ids),
            status="processing",
            message="Batch processing started"
        )
    
    except Exception as e:
        # Clean up temp directory if error occurs
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        raise HTTPException(status_code=500, detail=f"Error processing batch: {str(e)}")

@router.get("/batch/status/{batch_id}")
async def get_batch_status(batch_id: str):
    """
    Get the status of a batch processing job
    """
    # Find all job IDs for this batch
    batch_jobs = {k: v for k, v in processing_status.items() 
                  if v.get("batch_id") == batch_id}
    
    if not batch_jobs:
        raise HTTPException(status_code=404, detail="Batch ID not found")
    
    # Calculate overall status
    statuses = [job["status"] for job in batch_jobs.values()]
    completed = sum(1 for status in statuses if status == "completed")
    failed = sum(1 for status in statuses if status == "failed")
    processing = sum(1 for status in statuses if status in ["processing", "queued"])
    
    overall_status = "completed" if completed == len(batch_jobs) else \
                    "failed" if failed > 0 and processing == 0 else \
                    "processing"
    
    return {
        "batch_id": batch_id,
        "status": overall_status,
        "total_files": len(batch_jobs),
        "completed": completed,
        "failed": failed,
        "processing": processing,
        "jobs": {job_id: {
            "filename": job["filename"],
            "status": job["status"],
            "progress": job["progress"]
        } for job_id, job in batch_jobs.items()}
    }

@router.delete("/cleanup/{job_id}")
async def cleanup_job(job_id: str):
    """
    Clean up temporary files and remove job from status tracking
    """
    if job_id in processing_status:
        # Remove from status tracking
        job_info = processing_status.pop(job_id)
        
        # Clean up temp files
        temp_dir = Path("temp_uploads")
        for temp_file in temp_dir.glob(f"{job_id}_*"):
            try:
                temp_file.unlink()
            except Exception:
                pass  # File might already be cleaned up
        
        return {"message": f"Job {job_id} cleaned up successfully"}
    else:
        raise HTTPException(status_code=404, detail="Job ID not found")

# Background processing functions
async def process_document_background(
    job_id: str,
    file_path: Path,
    extract_text: bool,
    extract_metadata: bool,
    extract_structure: bool
):
    """
    Background task for processing a single document
    """
    try:
        # Update status
        processing_status[job_id]["status"] = "processing"
        processing_status[job_id]["progress"] = 10
        processing_status[job_id]["message"] = "Starting document processing"
        
        # Process with Docling service
        result = await docling_service.process_document(
            file_path=file_path,
            extract_text=extract_text,
            extract_metadata=extract_metadata,
            extract_structure=extract_structure
        )
        
        # Update progress
        processing_status[job_id]["progress"] = 90
        processing_status[job_id]["message"] = "Finalizing results"
        
        # Store result
        processing_status[job_id]["result"] = result
        processing_status[job_id]["status"] = "completed"
        processing_status[job_id]["progress"] = 100
        processing_status[job_id]["message"] = "Processing completed successfully"
        
    except Exception as e:
        processing_status[job_id]["status"] = "failed"
        processing_status[job_id]["error"] = str(e)
        processing_status[job_id]["message"] = f"Processing failed: {str(e)}"
    
    finally:
        # Clean up temp file
        try:
            if file_path.exists():
                file_path.unlink()
        except Exception:
            pass

async def process_batch_background(
    batch_id: str,
    job_ids: List[str],
    temp_dir: Path,
    extract_text: bool,
    extract_metadata: bool,
    extract_structure: bool
):
    """
    Background task for processing multiple documents
    """
    for job_id in job_ids:
        if job_id not in processing_status:
            continue
        
        try:
            # Find the file for this job
            filename = processing_status[job_id]["filename"]
            file_path = temp_dir / f"{job_id}_{filename}"
            
            if not file_path.exists():
                processing_status[job_id]["status"] = "failed"
                processing_status[job_id]["error"] = "File not found"
                continue
            
            # Process the document
            await process_document_background(
                job_id, file_path, extract_text, extract_metadata, extract_structure
            )
            
        except Exception as e:
            processing_status[job_id]["status"] = "failed"
            processing_status[job_id]["error"] = str(e)
    
    # Clean up batch temp directory
    try:
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
    except Exception:
        pass
