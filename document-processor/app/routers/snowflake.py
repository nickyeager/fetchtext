"""
Snowflake Router

REST endpoints for browsing Snowflake stages and downloading files.
"""

from fastapi import APIRouter, Query, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import uuid
import os
import tempfile
from pathlib import Path

from ..services.snowflake_service import snowflake_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/snowflake", tags=["snowflake"])

# In-memory job tracking for download status
_download_jobs: Dict[str, Dict[str, Any]] = {}


# =============================================================================
# Request/Response Models
# =============================================================================

class DownloadRequest(BaseModel):
    """Request to download and process a single file from a stage."""
    organization_id: str
    file_path: str
    process_immediately: bool = True
    save_to_database: bool = True


class BatchDownloadRequest(BaseModel):
    """Request to download and process multiple files from a stage."""
    organization_id: str
    files: List[str]
    process_immediately: bool = True


# =============================================================================
# Connection Test
# =============================================================================

@router.get("/test")
async def test_connection(
    organization_id: str = Query(..., description="Organization ID"),
):
    """Test Snowflake connection for an organization."""
    result = await snowflake_service.test_connection(organization_id)
    return result


# =============================================================================
# Browse: Databases, Schemas, Stages
# =============================================================================

@router.get("/databases")
async def list_databases(
    organization_id: str = Query(..., description="Organization ID"),
):
    """List available Snowflake databases."""
    try:
        databases = await snowflake_service.list_databases(organization_id)
        return {"databases": databases}
    except Exception as e:
        logger.exception("Failed to list databases")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schemas")
async def list_schemas(
    organization_id: str = Query(..., description="Organization ID"),
    database: str = Query(..., description="Database name"),
):
    """List schemas in a Snowflake database."""
    try:
        schemas = await snowflake_service.list_schemas(organization_id, database)
        return {"schemas": schemas}
    except Exception as e:
        logger.exception("Failed to list schemas")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stages")
async def list_stages(
    organization_id: str = Query(..., description="Organization ID"),
    database: Optional[str] = Query(None, description="Database name"),
    schema: Optional[str] = Query(None, alias="schema_name", description="Schema name"),
):
    """List stages in a Snowflake schema."""
    try:
        stages = await snowflake_service.list_stages(organization_id, database, schema)
        return {"stages": stages}
    except Exception as e:
        logger.exception("Failed to list stages")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stages/{stage_name}/files")
async def list_stage_files(
    stage_name: str,
    organization_id: str = Query(..., description="Organization ID"),
    path_prefix: Optional[str] = Query(None, description="Path prefix filter"),
    pattern: Optional[str] = Query(None, description="SQL LIKE pattern"),
    file_type_filter: Optional[str] = Query(None, description="Filter: documents, data, or all"),
):
    """List files in a Snowflake stage."""
    try:
        files = await snowflake_service.list_stage_files(
            organization_id=organization_id,
            stage_name=stage_name,
            path_prefix=path_prefix,
            pattern=pattern,
            file_type_filter=file_type_filter,
        )
        return {"files": files, "total": len(files)}
    except Exception as e:
        logger.exception(f"Failed to list files in stage {stage_name}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# File Download and Processing
# =============================================================================

@router.post("/stages/{stage_name}/download")
async def download_and_process_file(
    stage_name: str,
    request: DownloadRequest,
):
    """
    Download a single file from a Snowflake stage and optionally process it.

    Flow:
    1. Get pre-signed URL from Snowflake
    2. Download file to temp directory
    3. Process through Docling (documents) or convert (data files)
    4. Save to documents table if requested
    5. Clean up temp file
    """
    job_id = str(uuid.uuid4())
    _download_jobs[job_id] = {
        "status": "downloading",
        "file_name": Path(request.file_path).name,
        "stage_name": stage_name,
    }

    temp_path = None
    try:
        # 1. Try pre-signed URL first, fall back to GET for internal stages
        try:
            presigned_url = await snowflake_service.get_presigned_url(
                organization_id=request.organization_id,
                stage_name=stage_name,
                file_path=request.file_path,
            )
            temp_path = await snowflake_service.download_file_via_presigned_url(presigned_url)
        except Exception as presign_err:
            logger.warning(f"Pre-signed URL download failed ({presign_err}), falling back to GET command")
            temp_path = await snowflake_service.download_file_via_get(
                organization_id=request.organization_id,
                stage_name=stage_name,
                file_path=request.file_path,
            )

        # 2. Determine file type
        file_name = Path(request.file_path).name
        # Strip .gz suffix since Snowflake auto-compresses
        check_name = file_name
        if check_name.lower().endswith(".gz"):
            check_name = check_name[:-3]
        ext = Path(check_name).suffix.lower()

        _download_jobs[job_id]["status"] = "processing"

        document_data = None

        if request.process_immediately:
            from ..services.snowflake_service import DOCLING_EXTENSIONS, DATA_EXTENSIONS

            if ext in DATA_EXTENSIONS:
                # Convert data file to text
                result = snowflake_service.convert_data_file_to_text(temp_path)
                document_data = {
                    "text": result["text"],
                    "metadata": result["metadata"],
                    "source": "snowflake",
                    "file_name": file_name,
                }
            elif ext in DOCLING_EXTENSIONS:
                # Process through Docling
                try:
                    from ..services.docling_service import docling_service
                    docling_result = await docling_service.process_document(temp_path)
                    document_data = {
                        "text": docling_result.get("text", ""),
                        "metadata": docling_result.get("metadata", {}),
                        "source": "snowflake",
                        "file_name": file_name,
                    }
                except ImportError:
                    logger.warning("DoclingService not available, returning raw download")
                    document_data = {
                        "text": f"(Document downloaded but Docling not available: {file_name})",
                        "source": "snowflake",
                        "file_name": file_name,
                    }
            else:
                document_data = {
                    "text": f"(File type {ext} is not processable)",
                    "source": "snowflake",
                    "file_name": file_name,
                }

        # 4. Save to database if requested
        if request.save_to_database and document_data:
            try:
                from ..config.database import db_config
                if db_config.client:
                    db_config.client.table("documents").insert({
                        "name": file_name,
                        "content": document_data.get("text", ""),
                        "metadata": {
                            "source": "snowflake",
                            "stage_name": stage_name,
                            "file_path": request.file_path,
                            **(document_data.get("metadata", {})),
                        },
                        "status": "processed",
                        "organization_id": request.organization_id,
                    }).execute()
            except Exception as db_err:
                logger.warning(f"Failed to save document to database: {db_err}")

        _download_jobs[job_id]["status"] = "completed"

        return {
            "success": True,
            "job_id": job_id,
            "file_name": file_name,
            "processing_status": "completed" if request.process_immediately else "downloaded",
            "document_data": document_data,
        }

    except Exception as e:
        logger.exception(f"Failed to download/process file from stage {stage_name}")
        _download_jobs[job_id]["status"] = "failed"
        _download_jobs[job_id]["error"] = str(e)
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # 5. Clean up temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except OSError:
                pass


@router.post("/stages/{stage_name}/batch-download")
async def batch_download_files(
    stage_name: str,
    request: BatchDownloadRequest,
    background_tasks: BackgroundTasks,
):
    """
    Download and process multiple files from a Snowflake stage.

    Returns immediately with a batch job ID. Files are processed in background.
    """
    batch_id = str(uuid.uuid4())

    # Initialize job tracking
    _download_jobs[batch_id] = {
        "status": "processing",
        "type": "batch",
        "total": len(request.files),
        "completed": 0,
        "failed": 0,
        "results": [],
    }

    async def process_batch():
        for file_path in request.files:
            file_name = Path(file_path).name
            temp_path = None
            try:
                presigned_url = await snowflake_service.get_presigned_url(
                    organization_id=request.organization_id,
                    stage_name=stage_name,
                    file_path=file_path,
                )
                temp_path = await snowflake_service.download_file_via_presigned_url(presigned_url)

                ext = Path(file_name).suffix.lower()
                document_data = None

                if request.process_immediately:
                    from ..services.snowflake_service import DOCLING_EXTENSIONS, DATA_EXTENSIONS

                    if ext in DATA_EXTENSIONS:
                        result = snowflake_service.convert_data_file_to_text(temp_path)
                        document_data = {"text": result["text"], "metadata": result["metadata"]}
                    elif ext in DOCLING_EXTENSIONS:
                        try:
                            from ..services.docling_service import docling_service
                            docling_result = docling_service.process_document(temp_path)
                            document_data = {
                                "text": docling_result.get("text", ""),
                                "metadata": docling_result.get("metadata", {}),
                            }
                        except ImportError:
                            document_data = {"text": f"(Docling not available: {file_name})"}

                    # Save to database
                    if document_data:
                        try:
                            from ..config.database import db_config
                            if db_config.client:
                                db_config.client.table("documents").insert({
                                    "name": file_name,
                                    "content": document_data.get("text", ""),
                                    "metadata": {
                                        "source": "snowflake",
                                        "stage_name": stage_name,
                                        "file_path": file_path,
                                        **(document_data.get("metadata", {})),
                                    },
                                    "status": "processed",
                                    "organization_id": request.organization_id,
                                }).execute()
                        except Exception as db_err:
                            logger.warning(f"Failed to save {file_name}: {db_err}")

                _download_jobs[batch_id]["completed"] += 1
                _download_jobs[batch_id]["results"].append({
                    "file_name": file_name,
                    "status": "completed",
                })

            except Exception as e:
                logger.warning(f"Failed to process {file_path}: {e}")
                _download_jobs[batch_id]["failed"] += 1
                _download_jobs[batch_id]["results"].append({
                    "file_name": file_name,
                    "status": "failed",
                    "error": str(e),
                })
            finally:
                if temp_path and os.path.exists(temp_path):
                    try:
                        os.unlink(temp_path)
                    except OSError:
                        pass

        _download_jobs[batch_id]["status"] = "completed"

    background_tasks.add_task(process_batch)

    return {
        "success": True,
        "batch_id": batch_id,
        "total_files": len(request.files),
        "status": "processing",
    }


@router.get("/download-status/{job_id}")
async def get_download_status(job_id: str):
    """Get the status of a download job (single or batch)."""
    job = _download_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job_id": job_id, **job}
