"""
SharePoint / OneDrive router — browse, download, upload, and watch folders.

All endpoints require authentication and organization membership.
Uses OAuthManager to retrieve Microsoft 365 access tokens from vault.
"""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..middleware.admin_auth import admin_auth
from ..services.sharepoint_service import (
    SharePointService,
    SharePointItem,
    SharePointSite,
    SharePointDrive,
    PagedResult,
)
from ..services.integrations.oauth_manager import OAuthManager
from ..config.database import db_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sharepoint", tags=["sharepoint"])

INTEGRATION_TYPE = "microsoft"


# ── Helpers ───────────────────────────────────────────────

async def _get_sp_service(organization_id: str) -> SharePointService:
    """Get a SharePointService with a valid access token for the org."""
    token = await OAuthManager.get_access_token(
        organization_id=organization_id,
        integration_type=INTEGRATION_TYPE,
        auto_refresh=True,
    )
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Microsoft 365 not connected. Connect via Settings > Integrations.",
        )
    return SharePointService(access_token=token)


# ── Pydantic Models ──────────────────────────────────────

class SiteResponse(BaseModel):
    id: str
    name: str
    display_name: str = ""
    web_url: str = ""


class DriveResponse(BaseModel):
    id: str
    name: str
    drive_type: str = ""
    web_url: str = ""


class ItemResponse(BaseModel):
    id: str
    name: str
    size: int = 0
    mime_type: str = ""
    web_url: str = ""
    is_folder: bool = False
    last_modified: str = ""
    drive_id: str = ""
    is_processable: bool = False


class ItemsPageResponse(BaseModel):
    items: List[ItemResponse]
    next_link: Optional[str] = None


class DownloadRequest(BaseModel):
    drive_id: str
    item_id: str
    process_with_ai: bool = True


class DownloadResponse(BaseModel):
    filename: str
    size: int
    mime_type: str = ""
    processed: bool = False
    processing_result: Optional[Dict[str, Any]] = None


class UploadRequest(BaseModel):
    drive_id: str
    parent_folder_id: str
    filename: str


class UploadResponse(BaseModel):
    id: str
    name: str
    web_url: str = ""
    size: int = 0


class WatchCreate(BaseModel):
    site_id: Optional[str] = None
    drive_id: str
    folder_id: str
    folder_path: str
    poll_interval_minutes: int = Field(default=15, ge=5, le=1440)


class WatchResponse(BaseModel):
    id: str
    drive_id: str
    folder_id: str
    folder_path: str
    poll_interval_minutes: int
    is_active: bool
    last_polled_at: Optional[str] = None
    consecutive_failures: int = 0


class WatchUpdate(BaseModel):
    poll_interval_minutes: Optional[int] = Field(default=None, ge=5, le=1440)
    is_active: Optional[bool] = None


# ── Site Endpoints ────────────────────────────────────────

@router.get("/sites", response_model=List[SiteResponse])
async def list_sites(
    organization_id: str = Query(...),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """List accessible SharePoint sites."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)
    sp = await _get_sp_service(organization_id)

    sites = await sp.list_sites(search=search)
    return [SiteResponse(id=s.id, name=s.name, display_name=s.display_name, web_url=s.web_url) for s in sites]


@router.get("/sites/{site_id}/drives", response_model=List[DriveResponse])
async def list_site_drives(
    site_id: str,
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """List document libraries in a SharePoint site."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)
    sp = await _get_sp_service(organization_id)

    drives = await sp.list_drives(site_id)
    return [DriveResponse(id=d.id, name=d.name, drive_type=d.drive_type, web_url=d.web_url) for d in drives]


@router.get("/my-drive", response_model=DriveResponse)
async def get_my_onedrive(
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Get the current user's OneDrive."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)
    sp = await _get_sp_service(organization_id)

    drive = await sp.get_my_drive()
    return DriveResponse(id=drive.id, name=drive.name, drive_type=drive.drive_type, web_url=drive.web_url)


# ── Item Endpoints ────────────────────────────────────────

@router.get("/drives/{drive_id}/items", response_model=ItemsPageResponse)
async def list_drive_items(
    drive_id: str,
    organization_id: str = Query(...),
    folder_id: str = Query("root"),
    page_size: int = Query(50, ge=1, le=200),
    next_link: Optional[str] = Query(None),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Browse folder contents in a drive."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)
    sp = await _get_sp_service(organization_id)

    result = await sp.list_items(drive_id, folder_id, page_size, next_link)

    items = [
        ItemResponse(
            id=item.id,
            name=item.name,
            size=item.size,
            mime_type=item.mime_type,
            web_url=item.web_url,
            is_folder=item.is_folder,
            last_modified=item.last_modified,
            drive_id=item.drive_id,
            is_processable=sp.is_processable(item.name) if not item.is_folder else False,
        )
        for item in result.items
    ]

    return ItemsPageResponse(items=items, next_link=result.next_link)


@router.get("/search", response_model=List[ItemResponse])
async def search_files(
    organization_id: str = Query(...),
    drive_id: str = Query(...),
    query: str = Query(..., min_length=1),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Search for files across a drive."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)
    sp = await _get_sp_service(organization_id)

    items = await sp.search_items(drive_id, query)
    return [
        ItemResponse(
            id=item.id,
            name=item.name,
            size=item.size,
            mime_type=item.mime_type,
            web_url=item.web_url,
            is_folder=item.is_folder,
            last_modified=item.last_modified,
            drive_id=item.drive_id,
            is_processable=sp.is_processable(item.name) if not item.is_folder else False,
        )
        for item in items
    ]


# ── Download & Process ────────────────────────────────────

@router.post("/items/download", response_model=DownloadResponse)
async def download_and_process(
    request: DownloadRequest,
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Download a file from SharePoint and optionally process with Docling."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)
    sp = await _get_sp_service(organization_id)

    temp_path = None
    try:
        temp_path, metadata = await sp.download_to_temp(request.drive_id, request.item_id)
        filename = metadata.get("name", "download")

        result = DownloadResponse(
            filename=filename,
            size=metadata.get("size", 0),
            mime_type=metadata.get("mime_type", ""),
        )

        if request.process_with_ai and sp.is_processable(filename):
            from ..services.docling_service import docling_service

            processing_result = await docling_service.process_document_with_ai(
                file_path=temp_path,
                extract_text=True,
                extract_metadata=True,
                extract_structure=True,
                use_ai_enhancement=True,
            )
            result.processed = True
            result.processing_result = processing_result

        return result

    except Exception as e:
        logger.error(f"SharePoint download failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")
    finally:
        if temp_path:
            import shutil
            from pathlib import Path
            parent = Path(temp_path).parent
            if parent.name.startswith("fetchtext_sp_"):
                shutil.rmtree(parent, ignore_errors=True)


# ── Upload ────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    request: UploadRequest,
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Upload a generated document to SharePoint."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)
    sp = await _get_sp_service(organization_id)

    # For now, upload requires the file content in the request
    # This will be extended to accept document IDs from the FetchText system
    raise HTTPException(status_code=501, detail="Upload endpoint — wire to document generation pipeline")


# ── Watch Folders ─────────────────────────────────────────

@router.get("/watches", response_model=List[WatchResponse])
async def list_watches(
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """List active folder watches for the organization."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    supabase = db_config.client
    result = supabase.table("sharepoint_watches") \
        .select("*") \
        .eq("organization_id", organization_id) \
        .order("created_at", desc=True) \
        .execute()

    return [
        WatchResponse(
            id=w["id"],
            drive_id=w["drive_id"],
            folder_id=w["folder_id"],
            folder_path=w["folder_path"],
            poll_interval_minutes=w["poll_interval_minutes"],
            is_active=w["is_active"],
            last_polled_at=w.get("last_polled_at"),
            consecutive_failures=w.get("consecutive_failures", 0),
        )
        for w in result.data
    ]


@router.post("/watches", response_model=WatchResponse, status_code=201)
async def create_watch(
    watch: WatchCreate,
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Create a new folder watch for auto-import."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    supabase = db_config.client
    result = supabase.table("sharepoint_watches").insert({
        "organization_id": organization_id,
        "site_id": watch.site_id,
        "drive_id": watch.drive_id,
        "folder_id": watch.folder_id,
        "folder_path": watch.folder_path,
        "poll_interval_minutes": watch.poll_interval_minutes,
        "created_by": current_user["user_id"],
    }).execute()

    w = result.data[0]
    return WatchResponse(
        id=w["id"],
        drive_id=w["drive_id"],
        folder_id=w["folder_id"],
        folder_path=w["folder_path"],
        poll_interval_minutes=w["poll_interval_minutes"],
        is_active=w["is_active"],
    )


@router.patch("/watches/{watch_id}", response_model=WatchResponse)
async def update_watch(
    watch_id: str,
    update: WatchUpdate,
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Update a watch's config."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    updates = {k: v for k, v in update.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    supabase = db_config.client
    result = supabase.table("sharepoint_watches") \
        .update(updates) \
        .eq("id", watch_id) \
        .eq("organization_id", organization_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Watch not found")

    w = result.data[0]
    return WatchResponse(
        id=w["id"],
        drive_id=w["drive_id"],
        folder_id=w["folder_id"],
        folder_path=w["folder_path"],
        poll_interval_minutes=w["poll_interval_minutes"],
        is_active=w["is_active"],
        last_polled_at=w.get("last_polled_at"),
        consecutive_failures=w.get("consecutive_failures", 0),
    )


@router.delete("/watches/{watch_id}", status_code=204)
async def delete_watch(
    watch_id: str,
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Delete a folder watch."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    supabase = db_config.client
    supabase.table("sharepoint_watches") \
        .delete() \
        .eq("id", watch_id) \
        .eq("organization_id", organization_id) \
        .execute()


# ── Health Check ──────────────────────────────────────────

@router.get("/health")
async def sharepoint_health(
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Verify Microsoft Graph API connectivity."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    try:
        sp = await _get_sp_service(organization_id)
        ok, message = await sp.check_health()
        return {"status": "ok" if ok else "error", "message": message}
    except HTTPException:
        return {"status": "not_connected", "message": "Microsoft 365 not connected"}
