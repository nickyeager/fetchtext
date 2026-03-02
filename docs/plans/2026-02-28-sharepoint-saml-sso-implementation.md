# Phase 1: SharePoint/OneDrive + SAML SSO Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add bidirectional SharePoint/OneDrive connector (browse, import, export, watch folders) and generic SAML 2.0 SSO with JIT provisioning — enabling enterprise document source integration and enterprise auth.

**Architecture:** Two parallel workstreams. SharePoint connector: new FastAPI router using Microsoft Graph API via existing OAuthManager, following Google Docs connector pattern. SAML SSO: Supabase Auth's built-in SAML 2.0 with an SSOService abstraction for managed vs self-hosted, plus JIT user provisioning. Both share the existing integration registry, vault, and admin auth middleware.

**Tech Stack:** Python (FastAPI, httpx, Microsoft Graph REST API), PostgreSQL (Supabase), React (TanStack Router, TanStack Query, shadcn/ui), existing OAuthManager + VaultService + admin_auth middleware.

**Design doc:** `docs/plans/2026-02-28-sharepoint-saml-sso-design.md`

---

## Task 1: Database Migration — `sharepoint_watches` Table

**Files:**
- Create: `supabase/migrations/029_sharepoint_watches.sql`

**Step 1: Write the migration SQL**

```sql
-- SharePoint folder watches: auto-import new documents from watched folders
CREATE TABLE IF NOT EXISTS sharepoint_watches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- SharePoint location
    site_id TEXT,                           -- SharePoint site ID (null for OneDrive)
    drive_id TEXT NOT NULL,                 -- Document library / OneDrive drive ID
    folder_id TEXT NOT NULL,                -- Folder item ID to watch
    folder_path TEXT NOT NULL,              -- Human-readable path (e.g. "Documents/Invoices")

    -- Polling config
    poll_interval_minutes INTEGER NOT NULL DEFAULT 15,
    last_polled_at TIMESTAMPTZ,
    last_change_token TEXT,                 -- Microsoft Graph delta token for efficient polling

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sp_watches_org ON sharepoint_watches(organization_id);
CREATE INDEX idx_sp_watches_active ON sharepoint_watches(is_active) WHERE is_active = true;

-- Updated-at trigger (reuse existing function if available)
CREATE OR REPLACE FUNCTION update_sharepoint_watches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sharepoint_watches_updated_at
    BEFORE UPDATE ON sharepoint_watches
    FOR EACH ROW
    EXECUTE FUNCTION update_sharepoint_watches_updated_at();

-- RLS
ALTER TABLE sharepoint_watches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view watches"
    ON sharepoint_watches FOR SELECT TO authenticated
    USING (user_is_org_member(organization_id));

CREATE POLICY "Org members can create watches"
    ON sharepoint_watches FOR INSERT TO authenticated
    WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Org members can update watches"
    ON sharepoint_watches FOR UPDATE TO authenticated
    USING (user_is_org_member(organization_id));

CREATE POLICY "Org members can delete watches"
    ON sharepoint_watches FOR DELETE TO authenticated
    USING (user_is_org_member(organization_id));

CREATE POLICY "Service role full access on watches"
    ON sharepoint_watches FOR ALL TO service_role
    USING (true) WITH CHECK (true);
```

**Step 2: Apply to local Docker Supabase**

Run:
```bash
docker exec supabase-db psql -U postgres -d postgres -f /dev/stdin < supabase/migrations/029_sharepoint_watches.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX`, `CREATE POLICY` (multiple)

**Step 3: Verify**

Run:
```bash
docker exec supabase-db psql -U postgres -d postgres -c "\d sharepoint_watches"
```

Expected: Table with all columns listed.

**Step 4: Apply to production Supabase**

Use Supabase MCP:
```
mcp__supabase__apply_migration(project_id="rawhmcrtzfdhryyfovee", name="029_sharepoint_watches", query="<SQL>")
```

**Step 5: Commit**

```bash
git add supabase/migrations/029_sharepoint_watches.sql
git commit -m "feat: add sharepoint_watches table migration"
```

---

## Task 2: Database Migration — `sso_provider_mappings` Table

**Files:**
- Create: `supabase/migrations/030_sso_provider_mappings.sql`

**Step 1: Write the migration SQL**

```sql
-- SSO provider mappings: maps SAML IdP providers to organizations for JIT provisioning
CREATE TABLE IF NOT EXISTS sso_provider_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- SAML provider info
    sso_provider_id TEXT NOT NULL UNIQUE,    -- Supabase SSO provider ID
    domain TEXT NOT NULL UNIQUE,             -- Email domain (e.g. "acme.com")
    idp_name TEXT NOT NULL DEFAULT '',       -- Display name (e.g. "Acme Corp Okta")
    metadata_url TEXT,                       -- IdP metadata URL (null if XML was uploaded)

    -- JIT provisioning config
    auto_provision BOOLEAN NOT NULL DEFAULT true,
    default_role TEXT NOT NULL DEFAULT 'member',

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sso_mappings_org ON sso_provider_mappings(organization_id);
CREATE INDEX idx_sso_mappings_domain ON sso_provider_mappings(domain);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_sso_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sso_mappings_updated_at
    BEFORE UPDATE ON sso_provider_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_sso_mappings_updated_at();

-- RLS
ALTER TABLE sso_provider_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view SSO mappings"
    ON sso_provider_mappings FOR SELECT TO authenticated
    USING (user_is_org_member(organization_id));

CREATE POLICY "Org admins can manage SSO mappings"
    ON sso_provider_mappings FOR ALL TO authenticated
    USING (user_is_org_member(organization_id))
    WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Service role full access on SSO mappings"
    ON sso_provider_mappings FOR ALL TO service_role
    USING (true) WITH CHECK (true);
```

**Step 2: Apply to local Docker Supabase**

Run:
```bash
docker exec supabase-db psql -U postgres -d postgres -f /dev/stdin < supabase/migrations/030_sso_provider_mappings.sql
```

**Step 3: Verify**

Run:
```bash
docker exec supabase-db psql -U postgres -d postgres -c "\d sso_provider_mappings"
```

**Step 4: Apply to production Supabase**

Use Supabase MCP.

**Step 5: Commit**

```bash
git add supabase/migrations/030_sso_provider_mappings.sql
git commit -m "feat: add sso_provider_mappings table migration"
```

---

## Task 3: SharePoint Service — Microsoft Graph API Client

**Files:**
- Create: `document-processor/app/services/sharepoint_service.py`
- Test: `document-processor/tests/test_sharepoint_service.py`

**Step 1: Write the failing test**

Create `document-processor/tests/test_sharepoint_service.py`:

```python
"""Unit tests for SharePoint service — Graph API client layer."""
import pytest
from app.services.sharepoint_service import SharePointService, SharePointItem


def test_sharepoint_service_instantiates():
    """Service can be created with an access token."""
    svc = SharePointService(access_token="test-token")
    assert svc.access_token == "test-token"
    assert svc.base_url == "https://graph.microsoft.com/v1.0"


def test_sharepoint_item_dataclass():
    """SharePointItem holds file metadata."""
    item = SharePointItem(
        id="item-123",
        name="invoice.pdf",
        size=1024,
        mime_type="application/pdf",
        web_url="https://contoso.sharepoint.com/invoice.pdf",
        is_folder=False,
        last_modified="2026-02-28T10:00:00Z",
        drive_id="drive-abc",
    )
    assert item.name == "invoice.pdf"
    assert not item.is_folder


@pytest.mark.parametrize("ext,expected", [
    ("invoice.pdf", True),
    ("report.docx", True),
    ("photo.jpg", True),
    ("readme.txt", True),
    ("script.exe", False),
    ("archive.zip", False),
])
def test_is_processable_file(ext, expected):
    """Only document/image files are considered processable."""
    svc = SharePointService(access_token="test")
    assert svc.is_processable(ext) == expected
```

**Step 2: Run test to verify it fails**

Run: `cd document-processor && python -m pytest tests/test_sharepoint_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.sharepoint_service'`

**Step 3: Write the SharePoint service**

Create `document-processor/app/services/sharepoint_service.py`:

```python
"""
SharePoint / OneDrive service — wraps Microsoft Graph API.

Uses httpx for async HTTP calls to Graph API.
Token management delegated to OAuthManager (caller provides access_token).

Graph API reference: https://learn.microsoft.com/en-us/graph/api/overview

Key endpoints used:
  GET /sites                              — search/list sites
  GET /sites/{site-id}/drives             — list document libraries
  GET /drives/{drive-id}/items/{item-id}/children — list folder contents
  GET /drives/{drive-id}/items/{item-id}/content  — download file
  PUT /drives/{drive-id}/items/{parent-id}:/{filename}:/content — upload file
  GET /drives/{drive-id}/root/delta       — change tracking for watch folders
"""
import asyncio
import logging
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"

# File extensions FetchText can process
PROCESSABLE_EXTENSIONS = {
    ".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt",
    ".txt", ".csv", ".rtf", ".odt", ".ods", ".odp",
    ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp",
    ".html", ".htm", ".xml", ".json", ".md",
}


@dataclass
class SharePointItem:
    """Represents a file or folder from SharePoint/OneDrive."""
    id: str
    name: str
    size: int = 0
    mime_type: str = ""
    web_url: str = ""
    is_folder: bool = False
    last_modified: str = ""
    drive_id: str = ""
    parent_path: str = ""
    download_url: str = ""


@dataclass
class SharePointSite:
    """Represents a SharePoint site."""
    id: str
    name: str
    display_name: str = ""
    web_url: str = ""


@dataclass
class SharePointDrive:
    """Represents a document library (drive)."""
    id: str
    name: str
    drive_type: str = ""  # "documentLibrary", "personal"
    web_url: str = ""
    total_size: int = 0
    used_size: int = 0


@dataclass
class PagedResult:
    """Paginated result from Graph API."""
    items: list = field(default_factory=list)
    next_link: Optional[str] = None
    delta_link: Optional[str] = None


class SharePointService:
    """Async client for Microsoft Graph API (SharePoint + OneDrive)."""

    def __init__(self, access_token: str, timeout: float = 30.0):
        self.access_token = access_token
        self.base_url = GRAPH_BASE
        self.timeout = timeout

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }

    def is_processable(self, filename: str) -> bool:
        """Check if a file extension is processable by FetchText."""
        ext = Path(filename).suffix.lower()
        return ext in PROCESSABLE_EXTENSIONS

    # ── Sites ──────────────────────────────────────────────

    async def list_sites(self, search: Optional[str] = None) -> List[SharePointSite]:
        """List accessible SharePoint sites. Optionally filter by search term."""
        url = f"{self.base_url}/sites"
        params = {}
        if search:
            params["search"] = search
        else:
            # List sites the user has access to
            url = f"{self.base_url}/sites?search=*"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self._headers(), params=params)
            resp.raise_for_status()
            data = resp.json()

        return [
            SharePointSite(
                id=site["id"],
                name=site.get("name", ""),
                display_name=site.get("displayName", ""),
                web_url=site.get("webUrl", ""),
            )
            for site in data.get("value", [])
        ]

    # ── Drives (Document Libraries) ───────────────────────

    async def list_drives(self, site_id: str) -> List[SharePointDrive]:
        """List document libraries for a SharePoint site."""
        url = f"{self.base_url}/sites/{site_id}/drives"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self._headers())
            resp.raise_for_status()
            data = resp.json()

        return [
            SharePointDrive(
                id=drive["id"],
                name=drive.get("name", ""),
                drive_type=drive.get("driveType", ""),
                web_url=drive.get("webUrl", ""),
                total_size=drive.get("quota", {}).get("total", 0),
                used_size=drive.get("quota", {}).get("used", 0),
            )
            for drive in data.get("value", [])
        ]

    async def get_my_drive(self) -> SharePointDrive:
        """Get the current user's OneDrive."""
        url = f"{self.base_url}/me/drive"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self._headers())
            resp.raise_for_status()
            data = resp.json()

        return SharePointDrive(
            id=data["id"],
            name=data.get("name", "OneDrive"),
            drive_type=data.get("driveType", "personal"),
            web_url=data.get("webUrl", ""),
        )

    # ── Items (Files & Folders) ───────────────────────────

    async def list_items(
        self,
        drive_id: str,
        folder_id: str = "root",
        page_size: int = 50,
        next_link: Optional[str] = None,
    ) -> PagedResult:
        """List children of a folder in a drive."""
        if next_link:
            url = next_link
        else:
            url = f"{self.base_url}/drives/{drive_id}/items/{folder_id}/children"

        params = {"$top": str(page_size)} if not next_link else {}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self._headers(), params=params)
            resp.raise_for_status()
            data = resp.json()

        items = [
            SharePointItem(
                id=item["id"],
                name=item.get("name", ""),
                size=item.get("size", 0),
                mime_type=item.get("file", {}).get("mimeType", ""),
                web_url=item.get("webUrl", ""),
                is_folder="folder" in item,
                last_modified=item.get("lastModifiedDateTime", ""),
                drive_id=drive_id,
                parent_path=item.get("parentReference", {}).get("path", ""),
                download_url=item.get("@microsoft.graph.downloadUrl", ""),
            )
            for item in data.get("value", [])
        ]

        return PagedResult(
            items=items,
            next_link=data.get("@odata.nextLink"),
        )

    async def search_items(
        self,
        drive_id: str,
        query: str,
        page_size: int = 25,
    ) -> List[SharePointItem]:
        """Search for files in a drive."""
        url = f"{self.base_url}/drives/{drive_id}/root/search(q='{query}')"
        params = {"$top": str(page_size)}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self._headers(), params=params)
            resp.raise_for_status()
            data = resp.json()

        return [
            SharePointItem(
                id=item["id"],
                name=item.get("name", ""),
                size=item.get("size", 0),
                mime_type=item.get("file", {}).get("mimeType", ""),
                web_url=item.get("webUrl", ""),
                is_folder="folder" in item,
                last_modified=item.get("lastModifiedDateTime", ""),
                drive_id=drive_id,
            )
            for item in data.get("value", [])
        ]

    # ── Download ──────────────────────────────────────────

    async def download_file(self, drive_id: str, item_id: str) -> Tuple[bytes, Dict[str, Any]]:
        """Download a file's content and return (bytes, metadata)."""
        # Get metadata first
        meta_url = f"{self.base_url}/drives/{drive_id}/items/{item_id}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            meta_resp = await client.get(meta_url, headers=self._headers())
            meta_resp.raise_for_status()
            metadata = meta_resp.json()

        # Download content
        content_url = f"{meta_url}/content"
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            dl_resp = await client.get(content_url, headers=self._headers())
            dl_resp.raise_for_status()

        return dl_resp.content, {
            "name": metadata.get("name", ""),
            "size": metadata.get("size", 0),
            "mime_type": metadata.get("file", {}).get("mimeType", ""),
            "last_modified": metadata.get("lastModifiedDateTime", ""),
            "web_url": metadata.get("webUrl", ""),
        }

    async def download_to_temp(self, drive_id: str, item_id: str) -> Tuple[str, Dict[str, Any]]:
        """Download a file to a temp directory and return (file_path, metadata)."""
        content, metadata = await self.download_file(drive_id, item_id)
        filename = metadata.get("name", "download")

        temp_dir = tempfile.mkdtemp(prefix="fetchtext_sp_")
        temp_path = Path(temp_dir) / filename
        temp_path.write_bytes(content)

        return str(temp_path), metadata

    # ── Upload ────────────────────────────────────────────

    async def upload_file(
        self,
        drive_id: str,
        parent_folder_id: str,
        filename: str,
        content: bytes,
        content_type: str = "application/octet-stream",
    ) -> SharePointItem:
        """Upload a file to a SharePoint folder (simple upload, <4MB)."""
        url = (
            f"{self.base_url}/drives/{drive_id}/items/"
            f"{parent_folder_id}:/{filename}:/content"
        )
        headers = {
            **self._headers(),
            "Content-Type": content_type,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.put(url, headers=headers, content=content)
            resp.raise_for_status()
            data = resp.json()

        return SharePointItem(
            id=data["id"],
            name=data.get("name", filename),
            size=data.get("size", len(content)),
            mime_type=data.get("file", {}).get("mimeType", ""),
            web_url=data.get("webUrl", ""),
            is_folder=False,
            last_modified=data.get("lastModifiedDateTime", ""),
            drive_id=drive_id,
        )

    # ── Delta (Change Tracking for Watch Folders) ─────────

    async def get_delta(
        self,
        drive_id: str,
        folder_id: str = "root",
        delta_link: Optional[str] = None,
    ) -> PagedResult:
        """Get changed items since last sync using delta query."""
        if delta_link:
            url = delta_link
        else:
            url = f"{self.base_url}/drives/{drive_id}/items/{folder_id}/delta"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, headers=self._headers())
            resp.raise_for_status()
            data = resp.json()

        items = [
            SharePointItem(
                id=item["id"],
                name=item.get("name", ""),
                size=item.get("size", 0),
                mime_type=item.get("file", {}).get("mimeType", ""),
                web_url=item.get("webUrl", ""),
                is_folder="folder" in item,
                last_modified=item.get("lastModifiedDateTime", ""),
                drive_id=drive_id,
            )
            for item in data.get("value", [])
            if "file" in item  # Only include files, not folders
        ]

        return PagedResult(
            items=items,
            next_link=data.get("@odata.nextLink"),
            delta_link=data.get("@odata.deltaLink"),
        )

    # ── Health Check ──────────────────────────────────────

    async def check_health(self) -> Tuple[bool, str]:
        """Verify the access token works by calling /me."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.base_url}/me",
                    headers=self._headers(),
                )
                resp.raise_for_status()
                data = resp.json()
                return True, f"Connected as {data.get('displayName', data.get('userPrincipalName', 'unknown'))}"
        except httpx.HTTPStatusError as e:
            return False, f"Graph API error: {e.response.status_code}"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"
```

**Step 4: Run tests to verify they pass**

Run: `cd document-processor && python -m pytest tests/test_sharepoint_service.py -v`
Expected: 5 passed (3 unit tests + 2 parametrized)

**Step 5: Commit**

```bash
git add document-processor/app/services/sharepoint_service.py document-processor/tests/test_sharepoint_service.py
git commit -m "feat: add SharePoint service with Graph API client"
```

---

## Task 4: SharePoint Router — CRUD + Download/Upload Endpoints

**Files:**
- Create: `document-processor/app/routers/sharepoint.py`
- Modify: `document-processor/app/main.py` (add router import + include)

**Step 1: Write the SharePoint router**

Create `document-processor/app/routers/sharepoint.py`:

```python
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
from ..config.database import get_supabase_client

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

    supabase = get_supabase_client()
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

    supabase = get_supabase_client()
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

    supabase = get_supabase_client()
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

    supabase = get_supabase_client()
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
```

**Step 2: Register the router in main.py**

Modify `document-processor/app/main.py`:
- Add import: `from app.routers import sharepoint` (after webhooks import)
- Add: `app.include_router(sharepoint.router)` (after webhooks router)

**Step 3: Rebuild the container**

Run:
```bash
docker compose -p localai up -d --build document-processor
```

Wait for healthy status, then verify the endpoints appear:

Run:
```bash
curl -s http://localhost:8090/openapi.json | python -m json.tool | grep "/api/sharepoint"
```

Expected: Multiple SharePoint endpoints listed.

**Step 4: Commit**

```bash
git add document-processor/app/routers/sharepoint.py document-processor/app/main.py
git commit -m "feat: add SharePoint router with browse, download, upload, watch endpoints"
```

---

## Task 5: SSO Service — Supabase SAML Management

**Files:**
- Create: `document-processor/app/services/sso_service.py`
- Test: `document-processor/tests/test_sso_service.py`

**Step 1: Write the failing test**

Create `document-processor/tests/test_sso_service.py`:

```python
"""Unit tests for SSO service."""
import pytest
from app.services.sso_service import SSOService, SSOProviderConfig


def test_sso_service_detects_environment():
    """Service detects managed vs self-hosted."""
    svc = SSOService()
    # In test env, no SUPABASE_PROJECT_REF is set
    assert isinstance(svc.is_managed, bool)


def test_sso_provider_config_dataclass():
    """SSOProviderConfig holds IdP configuration."""
    config = SSOProviderConfig(
        domain="acme.com",
        idp_name="Acme Corp Okta",
        metadata_url="https://acme.okta.com/app/xyz/sso/saml/metadata",
    )
    assert config.domain == "acme.com"
    assert config.metadata_url is not None


def test_sso_provider_config_requires_domain():
    """Domain is required."""
    with pytest.raises(TypeError):
        SSOProviderConfig(idp_name="Test")  # Missing domain


def test_acs_url_generation():
    """ACS URL is correctly formed."""
    svc = SSOService()
    url = svc.get_acs_url()
    assert "/auth/v1/sso/saml/acs" in url


def test_metadata_url_generation():
    """SP metadata URL is correctly formed."""
    svc = SSOService()
    url = svc.get_metadata_url()
    assert "/auth/v1/sso/saml/metadata" in url
```

**Step 2: Run test to verify it fails**

Run: `cd document-processor && python -m pytest tests/test_sso_service.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Write the SSO service**

Create `document-processor/app/services/sso_service.py`:

```python
"""
SSO Service — manages SAML 2.0 identity providers via Supabase Auth.

Abstracts the difference between:
  - Managed Supabase (uses Management API / CLI)
  - Self-hosted Supabase (uses GoTrue Admin API directly)

SAML flow is handled entirely by Supabase Auth — this service only
manages provider registration, not the login flow itself.
"""
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

from ..config.database import get_supabase_client

logger = logging.getLogger(__name__)


@dataclass
class SSOProviderConfig:
    """Configuration for registering a SAML IdP."""
    domain: str
    idp_name: str = ""
    metadata_url: Optional[str] = None
    metadata_xml: Optional[str] = None
    attribute_mapping: Optional[Dict[str, str]] = None


@dataclass
class SSOProviderInfo:
    """Info about a registered SSO provider."""
    sso_provider_id: str
    domain: str
    idp_name: str = ""
    organization_id: str = ""
    auto_provision: bool = True
    default_role: str = "member"
    created_at: str = ""


class SSOService:
    """Manages SAML 2.0 SSO providers for FetchText organizations."""

    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL", os.getenv("VITE_SUPABASE_URL", "http://localhost:8000"))
        self.project_ref = os.getenv("SUPABASE_PROJECT_REF", "")
        self.service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    @property
    def is_managed(self) -> bool:
        """True if using managed Supabase (has project ref)."""
        return bool(self.project_ref)

    @property
    def _auth_base_url(self) -> str:
        """Base URL for GoTrue admin API."""
        if self.is_managed:
            return f"https://{self.project_ref}.supabase.co/auth/v1"
        return f"{self.supabase_url}/auth/v1"

    def _admin_headers(self) -> Dict[str, str]:
        """Headers for GoTrue admin API calls."""
        return {
            "Authorization": f"Bearer {self.service_role_key}",
            "apikey": self.service_role_key,
            "Content-Type": "application/json",
        }

    def get_acs_url(self) -> str:
        """Get the SAML Assertion Consumer Service URL."""
        return f"{self._auth_base_url}/sso/saml/acs"

    def get_metadata_url(self) -> str:
        """Get the SP metadata URL for IdP configuration."""
        return f"{self._auth_base_url}/sso/saml/metadata"

    def get_entity_id(self) -> str:
        """Get the SP entity ID."""
        return self.get_metadata_url()

    # ── Provider Management ───────────────────────────────

    async def register_provider(
        self,
        organization_id: str,
        config: SSOProviderConfig,
    ) -> SSOProviderInfo:
        """Register a new SAML IdP with Supabase Auth."""
        body: Dict[str, Any] = {
            "type": "saml",
            "domains": [config.domain],
        }

        if config.metadata_url:
            body["metadata_url"] = config.metadata_url
        elif config.metadata_xml:
            body["metadata_xml"] = config.metadata_xml
        else:
            raise ValueError("Either metadata_url or metadata_xml is required")

        if config.attribute_mapping:
            body["attribute_mapping"] = config.attribute_mapping

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self._auth_base_url}/admin/sso/providers",
                headers=self._admin_headers(),
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()

        sso_provider_id = data.get("id", "")

        # Store mapping in our database
        supabase = get_supabase_client()
        supabase.table("sso_provider_mappings").insert({
            "organization_id": organization_id,
            "sso_provider_id": sso_provider_id,
            "domain": config.domain,
            "idp_name": config.idp_name or config.domain,
            "metadata_url": config.metadata_url,
        }).execute()

        logger.info(f"Registered SAML provider for domain={config.domain} org={organization_id}")

        return SSOProviderInfo(
            sso_provider_id=sso_provider_id,
            domain=config.domain,
            idp_name=config.idp_name,
            organization_id=organization_id,
        )

    async def remove_provider(
        self,
        organization_id: str,
        sso_provider_id: str,
    ) -> bool:
        """Remove a SAML IdP from Supabase Auth."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.delete(
                f"{self._auth_base_url}/admin/sso/providers/{sso_provider_id}",
                headers=self._admin_headers(),
            )
            if resp.status_code not in (200, 204):
                logger.error(f"Failed to remove SSO provider: {resp.status_code} {resp.text}")
                return False

        # Remove mapping from our database
        supabase = get_supabase_client()
        supabase.table("sso_provider_mappings") \
            .delete() \
            .eq("sso_provider_id", sso_provider_id) \
            .eq("organization_id", organization_id) \
            .execute()

        logger.info(f"Removed SAML provider {sso_provider_id} from org {organization_id}")
        return True

    async def list_providers(self) -> List[Dict[str, Any]]:
        """List all registered SSO providers from Supabase Auth."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{self._auth_base_url}/admin/sso/providers",
                headers=self._admin_headers(),
            )
            resp.raise_for_status()
            data = resp.json()

        return data.get("items", [])

    # ── JIT Provisioning ──────────────────────────────────

    async def provision_user(
        self,
        user_id: str,
        sso_provider_id: str,
    ) -> Optional[Dict[str, Any]]:
        """JIT provision: add a new SSO user to their organization."""
        supabase = get_supabase_client()

        # Look up the org mapping for this provider
        mapping_result = supabase.table("sso_provider_mappings") \
            .select("*") \
            .eq("sso_provider_id", sso_provider_id) \
            .single() \
            .execute()

        if not mapping_result.data:
            logger.warning(f"No org mapping for SSO provider {sso_provider_id}")
            return None

        mapping = mapping_result.data
        if not mapping.get("auto_provision"):
            logger.info(f"Auto-provision disabled for SSO provider {sso_provider_id}")
            return None

        organization_id = mapping["organization_id"]
        default_role = mapping.get("default_role", "member")

        # Check if user is already a member
        existing = supabase.table("organization_members") \
            .select("id") \
            .eq("user_id", user_id) \
            .eq("organization_id", organization_id) \
            .execute()

        if existing.data:
            logger.info(f"User {user_id} already member of org {organization_id}")
            return {"organization_id": organization_id, "role": default_role, "already_member": True}

        # Create membership
        supabase.table("organization_members").insert({
            "user_id": user_id,
            "organization_id": organization_id,
            "role": default_role,
        }).execute()

        logger.info(f"JIT provisioned user {user_id} into org {organization_id} as {default_role}")
        return {"organization_id": organization_id, "role": default_role, "already_member": False}

    # ── Status ────────────────────────────────────────────

    async def get_org_sso_status(self, organization_id: str) -> Optional[SSOProviderInfo]:
        """Get SSO configuration status for an organization."""
        supabase = get_supabase_client()

        result = supabase.table("sso_provider_mappings") \
            .select("*") \
            .eq("organization_id", organization_id) \
            .execute()

        if not result.data:
            return None

        mapping = result.data[0]
        return SSOProviderInfo(
            sso_provider_id=mapping["sso_provider_id"],
            domain=mapping["domain"],
            idp_name=mapping.get("idp_name", ""),
            organization_id=organization_id,
            auto_provision=mapping.get("auto_provision", True),
            default_role=mapping.get("default_role", "member"),
            created_at=mapping.get("created_at", ""),
        )

    async def get_domain_mapping(self, domain: str) -> Optional[Dict[str, Any]]:
        """Look up SSO configuration by email domain."""
        supabase = get_supabase_client()

        result = supabase.table("sso_provider_mappings") \
            .select("*") \
            .eq("domain", domain) \
            .execute()

        return result.data[0] if result.data else None


# Singleton
sso_service = SSOService()
```

**Step 4: Run tests to verify they pass**

Run: `cd document-processor && python -m pytest tests/test_sso_service.py -v`
Expected: 5 passed

**Step 5: Commit**

```bash
git add document-processor/app/services/sso_service.py document-processor/tests/test_sso_service.py
git commit -m "feat: add SSO service with SAML provider management and JIT provisioning"
```

---

## Task 6: SSO Router — Configuration Endpoints

**Files:**
- Create: `document-processor/app/routers/sso.py`
- Modify: `document-processor/app/main.py` (add router)

**Step 1: Write the SSO router**

Create `document-processor/app/routers/sso.py`:

```python
"""
SSO router — manages SAML 2.0 identity providers.

Endpoints for configuring, removing, and checking SSO status.
The actual SAML login flow is handled by Supabase Auth (not this router).
"""
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..middleware.admin_auth import admin_auth
from ..services.sso_service import sso_service, SSOProviderConfig

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sso", tags=["sso"])


# ── Pydantic Models ──────────────────────────────────────

class SSOConfigureRequest(BaseModel):
    domain: str
    idp_name: str = ""
    metadata_url: Optional[str] = None
    metadata_xml: Optional[str] = None
    auto_provision: bool = True
    default_role: str = "member"


class SSOStatusResponse(BaseModel):
    configured: bool
    domain: Optional[str] = None
    idp_name: Optional[str] = None
    sso_provider_id: Optional[str] = None
    auto_provision: bool = True
    default_role: str = "member"
    # SP metadata for IdP configuration
    acs_url: str = ""
    metadata_url: str = ""
    entity_id: str = ""


class SSOUpdateRequest(BaseModel):
    idp_name: Optional[str] = None
    metadata_url: Optional[str] = None
    auto_provision: Optional[bool] = None
    default_role: Optional[str] = None


class SSODomainCheckResponse(BaseModel):
    domain: str
    has_sso: bool
    organization_name: Optional[str] = None


class SSOProvisionRequest(BaseModel):
    sso_provider_id: str


# ── Endpoints ─────────────────────────────────────────────

@router.get("/status", response_model=SSOStatusResponse)
async def get_sso_status(
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Check if SSO is configured for the organization."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    info = await sso_service.get_org_sso_status(organization_id)

    return SSOStatusResponse(
        configured=info is not None,
        domain=info.domain if info else None,
        idp_name=info.idp_name if info else None,
        sso_provider_id=info.sso_provider_id if info else None,
        auto_provision=info.auto_provision if info else True,
        default_role=info.default_role if info else "member",
        acs_url=sso_service.get_acs_url(),
        metadata_url=sso_service.get_metadata_url(),
        entity_id=sso_service.get_entity_id(),
    )


@router.post("/configure", response_model=SSOStatusResponse)
async def configure_sso(
    request: SSOConfigureRequest,
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Register a SAML IdP for the organization."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    if not request.metadata_url and not request.metadata_xml:
        raise HTTPException(status_code=400, detail="Either metadata_url or metadata_xml is required")

    config = SSOProviderConfig(
        domain=request.domain,
        idp_name=request.idp_name,
        metadata_url=request.metadata_url,
        metadata_xml=request.metadata_xml,
    )

    try:
        info = await sso_service.register_provider(organization_id, config)
    except Exception as e:
        logger.error(f"Failed to register SSO provider: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to configure SSO: {str(e)}")

    return SSOStatusResponse(
        configured=True,
        domain=info.domain,
        idp_name=info.idp_name,
        sso_provider_id=info.sso_provider_id,
        auto_provision=request.auto_provision,
        default_role=request.default_role,
        acs_url=sso_service.get_acs_url(),
        metadata_url=sso_service.get_metadata_url(),
        entity_id=sso_service.get_entity_id(),
    )


@router.patch("/update")
async def update_sso(
    request: SSOUpdateRequest,
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Update SSO configuration (JIT settings, IdP metadata)."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    from ..config.database import get_supabase_client
    supabase = get_supabase_client()

    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.table("sso_provider_mappings") \
        .update(updates) \
        .eq("organization_id", organization_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="No SSO configuration found")

    return {"status": "updated", "updated_fields": list(updates.keys())}


@router.delete("/remove")
async def remove_sso(
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Remove SSO configuration for the organization."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    info = await sso_service.get_org_sso_status(organization_id)
    if not info:
        raise HTTPException(status_code=404, detail="No SSO configuration found")

    success = await sso_service.remove_provider(organization_id, info.sso_provider_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to remove SSO provider from Supabase Auth")

    return {"status": "removed", "domain": info.domain}


@router.get("/check-domain", response_model=SSODomainCheckResponse)
async def check_domain(
    domain: str = Query(...),
):
    """Check if a domain has SSO configured (public endpoint for login page)."""
    mapping = await sso_service.get_domain_mapping(domain)

    if mapping:
        from ..config.database import get_supabase_client
        supabase = get_supabase_client()
        org = supabase.table("organizations") \
            .select("name") \
            .eq("id", mapping["organization_id"]) \
            .single() \
            .execute()
        org_name = org.data.get("name", "") if org.data else None
    else:
        org_name = None

    return SSODomainCheckResponse(
        domain=domain,
        has_sso=mapping is not None,
        organization_name=org_name,
    )


@router.post("/provision")
async def provision_sso_user(
    request: SSOProvisionRequest,
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """JIT provision: add the current SSO user to their organization."""
    result = await sso_service.provision_user(
        user_id=current_user["user_id"],
        sso_provider_id=request.sso_provider_id,
    )

    if not result:
        raise HTTPException(status_code=404, detail="No organization mapping found for this SSO provider")

    return result
```

**Step 2: Register in main.py**

Add import and include for sso router (same pattern as sharepoint).

**Step 3: Rebuild container and verify endpoints**

Run:
```bash
docker compose -p localai up -d --build document-processor
curl -s http://localhost:8090/openapi.json | python -m json.tool | grep "/api/sso"
```

Expected: SSO endpoints listed.

**Step 4: Commit**

```bash
git add document-processor/app/routers/sso.py document-processor/app/main.py
git commit -m "feat: add SSO router with SAML provider management endpoints"
```

---

## Task 7: Frontend — SharePoint Settings Component

**Files:**
- Create: `localai-admin-dashboard/src/features/settings/integrations/sharepoint-settings.tsx`
- Modify: `localai-admin-dashboard/src/features/settings/integrations/index.tsx` (add component)

**Step 1: Create the SharePoint settings component**

Create `localai-admin-dashboard/src/features/settings/integrations/sharepoint-settings.tsx`:

Follow the exact pattern from `google-drive-settings.tsx`:
- Use `useOrganization()` for `activeOrganization`
- Use `useQuery()` for integration list and status
- Use `useEffect()` for OAuth callback handling
- Render `IntegrationCard` with `id="microsoft"`, `scopePreset="sharepoint"`
- On connect: calls `integrationService.connectIntegration(orgId, 'microsoft', 'sharepoint')`

The key difference from Google Drive: use `id="microsoft"` (matches registry) and `scopePreset="sharepoint"` (requests SharePoint scopes).

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOrganization } from '@/context/organization-context'
import { integrationService, integrationKeys } from '@/lib/services/integration-service'
import { IntegrationCard } from '@/components/integrations/IntegrationCard'

export function SharePointSettings() {
  const { activeOrganization } = useOrganization()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [callbackProcessed, setCallbackProcessed] = useState(false)

  const { data: integrations } = useQuery({
    queryKey: integrationKeys.list(),
    queryFn: () => integrationService.listIntegrations(),
  })

  const { data: microsoftStatus, refetch } = useQuery({
    queryKey: integrationKeys.status(activeOrganization?.id || '', 'microsoft'),
    queryFn: () => integrationService.getIntegrationStatus(activeOrganization!.id, 'microsoft'),
    enabled: !!activeOrganization?.id,
  })

  // Handle OAuth callback
  useEffect(() => {
    if (callbackProcessed) return
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const error = urlParams.get('error')

    if (success === 'true') {
      setCallbackProcessed(true)
      toast.success('Microsoft 365 connected successfully')
      navigate({ to: '/settings/integrations', search: {}, replace: true })
      if (activeOrganization?.id) refetch()
    } else if (error) {
      setCallbackProcessed(true)
      toast.error('Failed to connect Microsoft 365', { description: decodeURIComponent(error) })
      navigate({ to: '/settings/integrations', search: {}, replace: true })
    }
  }, [callbackProcessed, navigate, refetch, activeOrganization?.id])

  if (!activeOrganization) return null

  const microsoftConfig = integrations?.find((i) => i.id === 'microsoft')

  return (
    <IntegrationCard
      id="microsoft"
      name="SharePoint & OneDrive"
      description="Browse, import, and export documents with SharePoint sites and OneDrive. Watch folders for automatic processing."
      icon={<MicrosoftIcon className="h-5 w-5" />}
      status={microsoftStatus?.status || 'disconnected'}
      configured={microsoftConfig?.configured ?? false}
      scopes={microsoftStatus?.scopes}
      metadata={microsoftStatus?.metadata}
      lastError={microsoftStatus?.last_error}
      connectedAt={microsoftStatus?.connected_at}
      tokenExpiresAt={microsoftStatus?.token_expires_at}
      organizationId={activeOrganization.id}
      onConnected={() => {
        queryClient.invalidateQueries({ queryKey: integrationKeys.status(activeOrganization.id, 'microsoft') })
      }}
      onDisconnected={() => {
        queryClient.invalidateQueries({ queryKey: integrationKeys.status(activeOrganization.id, 'microsoft') })
      }}
      scopePreset="sharepoint"
    />
  )
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 23 23" fill="none">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  )
}
```

**Step 2: Add to integrations index**

Modify `localai-admin-dashboard/src/features/settings/integrations/index.tsx`:
- Add import: `import { SharePointSettings } from './sharepoint-settings'`
- Add `<SharePointSettings />` after `<SnowflakeSettings />`

**Step 3: Build frontend**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add localai-admin-dashboard/src/features/settings/integrations/sharepoint-settings.tsx localai-admin-dashboard/src/features/settings/integrations/index.tsx
git commit -m "feat: add SharePoint settings component to integrations page"
```

---

## Task 8: Frontend — SSO Settings Page

**Files:**
- Create: `localai-admin-dashboard/src/features/settings/organization/sso-settings.tsx`
- Create: `localai-admin-dashboard/src/routes/_authenticated/settings/organization.tsx`
- Create: `localai-admin-dashboard/src/lib/services/sso-service.ts`
- Modify: `localai-admin-dashboard/src/features/settings/index.tsx` (add nav item)

**Step 1: Create the SSO service client**

Create `localai-admin-dashboard/src/lib/services/sso-service.ts`:

```typescript
import { supabase } from '@/lib/supabase'

const BACKEND_URL = import.meta.env.VITE_DOCUMENT_PROCESSOR_URL || 'http://localhost:8090'

interface SSOStatus {
  configured: boolean
  domain: string | null
  idp_name: string | null
  sso_provider_id: string | null
  auto_provision: boolean
  default_role: string
  acs_url: string
  metadata_url: string
  entity_id: string
}

interface SSOConfigurePayload {
  domain: string
  idp_name?: string
  metadata_url?: string
  metadata_xml?: string
  auto_provision?: boolean
  default_role?: string
}

interface DomainCheckResult {
  domain: string
  has_sso: boolean
  organization_name: string | null
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

export const ssoService = {
  async getStatus(organizationId: string): Promise<SSOStatus> {
    const headers = await getAuthHeaders()
    const resp = await fetch(
      `${BACKEND_URL}/api/sso/status?organization_id=${organizationId}`,
      { headers },
    )
    if (!resp.ok) throw new Error(`SSO status failed: ${resp.status}`)
    return resp.json()
  },

  async configure(organizationId: string, payload: SSOConfigurePayload): Promise<SSOStatus> {
    const headers = await getAuthHeaders()
    const resp = await fetch(
      `${BACKEND_URL}/api/sso/configure?organization_id=${organizationId}`,
      { method: 'POST', headers, body: JSON.stringify(payload) },
    )
    if (!resp.ok) throw new Error(`SSO configure failed: ${resp.status}`)
    return resp.json()
  },

  async update(organizationId: string, updates: Partial<SSOConfigurePayload>): Promise<void> {
    const headers = await getAuthHeaders()
    const resp = await fetch(
      `${BACKEND_URL}/api/sso/update?organization_id=${organizationId}`,
      { method: 'PATCH', headers, body: JSON.stringify(updates) },
    )
    if (!resp.ok) throw new Error(`SSO update failed: ${resp.status}`)
  },

  async remove(organizationId: string): Promise<void> {
    const headers = await getAuthHeaders()
    const resp = await fetch(
      `${BACKEND_URL}/api/sso/remove?organization_id=${organizationId}`,
      { method: 'DELETE', headers },
    )
    if (!resp.ok) throw new Error(`SSO remove failed: ${resp.status}`)
  },

  async checkDomain(domain: string): Promise<DomainCheckResult> {
    const resp = await fetch(`${BACKEND_URL}/api/sso/check-domain?domain=${domain}`)
    if (!resp.ok) throw new Error(`Domain check failed: ${resp.status}`)
    return resp.json()
  },

  async provision(ssoProviderId: string): Promise<{ organization_id: string; role: string }> {
    const headers = await getAuthHeaders()
    const resp = await fetch(
      `${BACKEND_URL}/api/sso/provision`,
      { method: 'POST', headers, body: JSON.stringify({ sso_provider_id: ssoProviderId }) },
    )
    if (!resp.ok) throw new Error(`SSO provision failed: ${resp.status}`)
    return resp.json()
  },
}
```

**Step 2: Create the SSO settings component**

Create `localai-admin-dashboard/src/features/settings/organization/sso-settings.tsx`:

This component should:
- Show SSO status (configured/not configured)
- Display SP metadata (ACS URL, Entity ID, Metadata URL) for IdP setup
- Form to configure SSO: domain, IdP name, metadata URL or XML upload
- Toggle for auto-provision + default role selector
- Remove SSO button with confirmation

Use shadcn/ui components: Card, Input, Label, Button, Switch, Select, Badge, Alert.
Use `useOrganization()` for org context.
Use `useQuery()` + `useMutation()` from TanStack Query.

**Step 3: Create the route file**

Create `localai-admin-dashboard/src/routes/_authenticated/settings/organization.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import SSOSettings from '@/features/settings/organization/sso-settings'

export const Route = createFileRoute('/_authenticated/settings/organization')({
  component: SSOSettings,
})
```

**Step 4: Add nav item to settings sidebar**

Modify `localai-admin-dashboard/src/features/settings/index.tsx`:
- Add import: `import { IconShieldLock } from '@tabler/icons-react'`
- Add nav item after Webhooks: `{ title: 'SSO', icon: <IconShieldLock size={18} />, href: '/settings/organization' }`

**Step 5: Build frontend**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm build
```

**Step 6: Commit**

```bash
git add localai-admin-dashboard/src/features/settings/organization/ localai-admin-dashboard/src/lib/services/sso-service.ts localai-admin-dashboard/src/routes/_authenticated/settings/organization.tsx localai-admin-dashboard/src/features/settings/index.tsx
git commit -m "feat: add SSO settings page with SAML configuration UI"
```

---

## Task 9: Frontend — Login Page SSO Detection

**Files:**
- Modify: `localai-admin-dashboard/src/features/auth/sign-in/components/user-auth-form.tsx`

**Step 1: Add SSO domain detection to login form**

Modify the login form to:
1. After user types email and leaves the field (onBlur), extract the domain
2. Call `ssoService.checkDomain(domain)`
3. If SSO is configured, show "Sign in with SSO" button instead of password field
4. SSO button calls `supabase.auth.signInWithSSO({ domain })`
5. Keep password login as fallback ("Use password instead" link)

Add to `user-auth-form.tsx`:

```tsx
// After existing imports, add:
import { ssoService } from '@/lib/services/sso-service'
import { supabase } from '@/lib/supabase'

// Inside the component, add state:
const [ssoEnabled, setSsoEnabled] = useState(false)
const [ssoOrgName, setSsoOrgName] = useState<string | null>(null)
const [checkingSso, setCheckingSso] = useState(false)

// Add domain check handler:
const handleEmailBlur = async (email: string) => {
  const domain = email.split('@')[1]
  if (!domain || domain.length < 3) return

  setCheckingSso(true)
  try {
    const result = await ssoService.checkDomain(domain)
    setSsoEnabled(result.has_sso)
    setSsoOrgName(result.organization_name)
  } catch {
    // Silently fail — SSO check is optional
  } finally {
    setCheckingSso(false)
  }
}

// Add SSO login handler:
const handleSsoLogin = async () => {
  const email = form.getValues('email')
  const domain = email.split('@')[1]
  try {
    const { error } = await supabase.auth.signInWithSSO({ domain })
    if (error) toast.error('SSO login failed', { description: error.message })
  } catch (e) {
    toast.error('SSO login failed')
  }
}
```

In the JSX, after the email field add an `onBlur` handler, and conditionally render either the password field or an SSO button:

```tsx
{ssoEnabled ? (
  <div className="space-y-3">
    <Alert>
      <p className="text-sm">
        {ssoOrgName ? `${ssoOrgName} uses` : 'Your organization uses'} Single Sign-On.
      </p>
    </Alert>
    <Button type="button" className="w-full" onClick={handleSsoLogin}>
      Sign in with SSO
    </Button>
    <Button type="button" variant="link" className="w-full text-xs" onClick={() => setSsoEnabled(false)}>
      Use password instead
    </Button>
  </div>
) : (
  // existing password field + submit button
)}
```

**Step 2: Build frontend**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm build
```

**Step 3: Commit**

```bash
git add localai-admin-dashboard/src/features/auth/sign-in/components/user-auth-form.tsx
git commit -m "feat: add SSO domain detection to login page"
```

---

## Task 10: Watch Folder Background Poller

**Files:**
- Create: `document-processor/app/services/sharepoint_watcher.py`
- Modify: `document-processor/app/main.py` (add startup event)

**Step 1: Write the background poller**

Create `document-processor/app/services/sharepoint_watcher.py`:

```python
"""
SharePoint watch folder poller — background task that checks watched folders
for new/modified documents and auto-imports them.

Runs as an asyncio background task started on app startup.
Uses Graph API delta queries for efficient change detection.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from ..config.database import get_supabase_client
from ..services.sharepoint_service import SharePointService
from ..services.integrations.oauth_manager import OAuthManager
from ..services.document_event_bus import document_event_bus

logger = logging.getLogger(__name__)

POLL_CHECK_INTERVAL = 60  # Check all watches every 60 seconds
MAX_FILES_PER_POLL = 20   # Don't process more than 20 files at once


async def _get_active_watches():
    """Fetch all active watches from the database."""
    supabase = get_supabase_client()
    result = supabase.table("sharepoint_watches") \
        .select("*") \
        .eq("is_active", True) \
        .execute()
    return result.data or []


async def _poll_watch(watch: dict) -> None:
    """Poll a single watch for changes."""
    org_id = watch["organization_id"]
    watch_id = watch["id"]

    try:
        token = await OAuthManager.get_access_token(
            organization_id=org_id,
            integration_type="microsoft",
            auto_refresh=True,
        )
        if not token:
            logger.warning(f"[Watcher] No Microsoft token for org {org_id}, skipping watch {watch_id}")
            return

        sp = SharePointService(access_token=token)

        # Use delta query if we have a delta link, otherwise get initial delta
        delta_link = watch.get("last_change_token")
        result = await sp.get_delta(
            drive_id=watch["drive_id"],
            folder_id=watch["folder_id"],
            delta_link=delta_link,
        )

        new_files = [item for item in result.items if sp.is_processable(item.name)]

        if new_files:
            logger.info(f"[Watcher] Found {len(new_files)} new files in watch {watch_id}")

            for file_item in new_files[:MAX_FILES_PER_POLL]:
                try:
                    # Download and emit event (processing happens via event bus)
                    _content, metadata = await sp.download_file(watch["drive_id"], file_item.id)

                    await document_event_bus.emit(
                        event_type="document.uploaded",
                        organization_id=org_id,
                        data={
                            "filename": file_item.name,
                            "source": "sharepoint_watch",
                            "watch_id": watch_id,
                            "drive_id": watch["drive_id"],
                            "item_id": file_item.id,
                            "size": file_item.size,
                        },
                    )
                    logger.info(f"[Watcher] Imported {file_item.name} from watch {watch_id}")
                except Exception as e:
                    logger.error(f"[Watcher] Failed to import {file_item.name}: {e}")

        # Update watch with new delta link and poll timestamp
        supabase = get_supabase_client()
        updates = {
            "last_polled_at": datetime.now(timezone.utc).isoformat(),
            "consecutive_failures": 0,
        }
        if result.delta_link:
            updates["last_change_token"] = result.delta_link

        supabase.table("sharepoint_watches") \
            .update(updates) \
            .eq("id", watch_id) \
            .execute()

    except Exception as e:
        logger.error(f"[Watcher] Poll failed for watch {watch_id}: {e}")

        # Increment failure count
        supabase = get_supabase_client()
        supabase.rpc("increment_watch_failures", {"watch_id_param": watch_id}).execute()


async def poll_loop():
    """Main polling loop — runs forever as a background task."""
    logger.info("[Watcher] SharePoint watch poller started")

    while True:
        try:
            watches = await _get_active_watches()

            now = datetime.now(timezone.utc)
            for watch in watches:
                last_polled = watch.get("last_polled_at")
                interval = watch.get("poll_interval_minutes", 15)

                if last_polled:
                    from dateutil.parser import parse
                    last_dt = parse(last_polled)
                    if last_dt.tzinfo is None:
                        last_dt = last_dt.replace(tzinfo=timezone.utc)
                    elapsed = (now - last_dt).total_seconds() / 60
                    if elapsed < interval:
                        continue

                # Time to poll this watch
                await _poll_watch(watch)

        except Exception as e:
            logger.error(f"[Watcher] Poll loop error: {e}", exc_info=True)

        await asyncio.sleep(POLL_CHECK_INTERVAL)


_poller_task: Optional[asyncio.Task] = None


def start_poller():
    """Start the background poller (call from app startup)."""
    global _poller_task
    _poller_task = asyncio.create_task(poll_loop())
    logger.info("[Watcher] Background poller task created")


def stop_poller():
    """Stop the background poller."""
    global _poller_task
    if _poller_task:
        _poller_task.cancel()
        _poller_task = None
```

**Step 2: Register in main.py startup**

Add to `document-processor/app/main.py`:

```python
from app.services.sharepoint_watcher import start_poller, stop_poller

@app.on_event("startup")
async def startup_sharepoint_watcher():
    start_poller()

@app.on_event("shutdown")
async def shutdown_sharepoint_watcher():
    stop_poller()
```

**Step 3: Rebuild and verify**

Run:
```bash
docker compose -p localai up -d --build document-processor
docker compose -p localai logs document-processor --tail=20 | grep "Watcher"
```

Expected: `[Watcher] SharePoint watch poller started`

**Step 4: Commit**

```bash
git add document-processor/app/services/sharepoint_watcher.py document-processor/app/main.py
git commit -m "feat: add SharePoint watch folder background poller"
```

---

## Task 11: Integration Tests

**Files:**
- Create: `document-processor/tests/test_sharepoint_router.py`
- Create: `document-processor/tests/test_sso_router.py`

**Step 1: Write SharePoint router integration tests**

```python
"""Integration tests for SharePoint router endpoints.
Requires: backend running on localhost:8090, Microsoft 365 OAuth not connected (tests auth requirements).
"""
import requests

BACKEND_URL = "http://localhost:8090"


def test_backend_health():
    resp = requests.get(f"{BACKEND_URL}/health", timeout=5)
    assert resp.status_code == 200


def test_sharepoint_sites_requires_auth():
    resp = requests.get(f"{BACKEND_URL}/api/sharepoint/sites?organization_id=test", timeout=5)
    assert resp.status_code in (401, 403)


def test_sharepoint_drives_requires_auth():
    resp = requests.get(f"{BACKEND_URL}/api/sharepoint/sites/test/drives?organization_id=test", timeout=5)
    assert resp.status_code in (401, 403)


def test_sharepoint_items_requires_auth():
    resp = requests.get(f"{BACKEND_URL}/api/sharepoint/drives/test/items?organization_id=test", timeout=5)
    assert resp.status_code in (401, 403)


def test_sharepoint_watches_requires_auth():
    resp = requests.get(f"{BACKEND_URL}/api/sharepoint/watches?organization_id=test", timeout=5)
    assert resp.status_code in (401, 403)
```

**Step 2: Write SSO router integration tests**

```python
"""Integration tests for SSO router endpoints."""
import requests

BACKEND_URL = "http://localhost:8090"


def test_sso_status_requires_auth():
    resp = requests.get(f"{BACKEND_URL}/api/sso/status?organization_id=test", timeout=5)
    assert resp.status_code in (401, 403)


def test_sso_check_domain_is_public():
    """Domain check is a public endpoint (used by login page)."""
    resp = requests.get(f"{BACKEND_URL}/api/sso/check-domain?domain=nonexistent.com", timeout=5)
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_sso"] is False


def test_sso_configure_requires_auth():
    resp = requests.post(
        f"{BACKEND_URL}/api/sso/configure?organization_id=test",
        json={"domain": "test.com", "metadata_url": "https://example.com/metadata"},
        timeout=5,
    )
    assert resp.status_code in (401, 403)
```

**Step 3: Run tests**

Run:
```bash
cd document-processor && python -m pytest tests/test_sharepoint_router.py tests/test_sso_router.py -v
```

Expected: All pass.

**Step 4: Commit**

```bash
git add document-processor/tests/test_sharepoint_router.py document-processor/tests/test_sso_router.py
git commit -m "test: add SharePoint and SSO router integration tests"
```

---

## Task 12: Playwright E2E Tests

**Files:**
- Create: `localai-admin-dashboard/tests/e2e/settings/sharepoint.pw.spec.ts`
- Create: `localai-admin-dashboard/tests/e2e/settings/sso.pw.spec.ts`

**Step 1: Write SharePoint E2E test**

```typescript
/**
 * E2E Test: SharePoint Integration Settings
 * Tests navigation to integrations page and SharePoint card visibility.
 * Full OAuth flow requires Microsoft 365 dev tenant.
 */
import { test, expect } from '@playwright/test';
import { uiLogin, monitorConsole, assertNoCriticalErrors, createLogger } from '../helpers/auth';
import { getCredentials, detectTarget } from '../helpers/env';

const log = createLogger('SharePoint');

test.describe('SharePoint Integration Settings', () => {
  test('integrations page shows SharePoint card', async ({ page }) => {
    const target = detectTarget(page.url());
    const { email, password } = getCredentials(target);
    await uiLogin(page, email, password, log);
    const errors = monitorConsole(page, log);

    await page.goto('/settings/integrations', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10_000 });

    // SharePoint card should be visible
    await expect(page.getByText('SharePoint & OneDrive')).toBeVisible({ timeout: 5_000 });

    log('SharePoint integration card visible');
    assertNoCriticalErrors(errors);
  });
});
```

**Step 2: Write SSO E2E test**

```typescript
/**
 * E2E Test: SSO Settings Page
 * Tests navigation and SSO configuration UI.
 */
import { test, expect } from '@playwright/test';
import { uiLogin, monitorConsole, assertNoCriticalErrors, createLogger } from '../helpers/auth';
import { getCredentials, detectTarget } from '../helpers/env';

const log = createLogger('SSO');

test.describe('SSO Settings', () => {
  test('navigate to SSO settings page', async ({ page }) => {
    const target = detectTarget(page.url());
    const { email, password } = getCredentials(target);
    await uiLogin(page, email, password, log);
    const errors = monitorConsole(page, log);

    await page.goto('/settings/organization', { waitUntil: 'networkidle' });

    // SSO settings should render
    await expect(page.getByText('Single Sign-On')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('ACS URL')).toBeVisible();

    log('SSO settings page rendered');
    assertNoCriticalErrors(errors);
  });
});
```

**Step 3: Run Playwright tests**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx playwright test tests/e2e/settings/sharepoint.pw.spec.ts tests/e2e/settings/sso.pw.spec.ts --reporter=list
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add localai-admin-dashboard/tests/e2e/settings/sharepoint.pw.spec.ts localai-admin-dashboard/tests/e2e/settings/sso.pw.spec.ts
git commit -m "test: add SharePoint and SSO Playwright E2E tests"
```

---

## Summary

| Task | Component | Type |
|------|-----------|------|
| 1 | `sharepoint_watches` migration | Database |
| 2 | `sso_provider_mappings` migration | Database |
| 3 | SharePoint service (Graph API client) | Backend |
| 4 | SharePoint router (CRUD endpoints) | Backend |
| 5 | SSO service (SAML provider management) | Backend |
| 6 | SSO router (configuration endpoints) | Backend |
| 7 | SharePoint settings component | Frontend |
| 8 | SSO settings page + service client | Frontend |
| 9 | Login page SSO domain detection | Frontend |
| 10 | Watch folder background poller | Backend |
| 11 | Backend integration tests | Testing |
| 12 | Playwright E2E tests | Testing |

**Batch execution recommended:**
- Batch 1: Tasks 1-3 (database + SharePoint service)
- Batch 2: Tasks 4-6 (routers)
- Batch 3: Tasks 7-9 (frontend)
- Batch 4: Tasks 10-12 (poller + tests)
