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
        meta_url = f"{self.base_url}/drives/{drive_id}/items/{item_id}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            meta_resp = await client.get(meta_url, headers=self._headers())
            meta_resp.raise_for_status()
            metadata = meta_resp.json()

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
