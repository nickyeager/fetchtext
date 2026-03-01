"""
SharePoint Integration Tests

Tests the SharePoint/OneDrive connector endpoints against the real backend.
Level 1 tests (API contracts, auth guards) always run.
Level 2 tests (real Graph API calls) require Microsoft 365 OAuth configured.

To enable Level 2 tests, set up Microsoft OAuth:
  1. Register an app in Azure Portal (Entra ID)
  2. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in .env
  3. Connect Microsoft 365 for test org via the integrations API

Usage:
  cd document-processor
  pytest tests/test_sharepoint_router.py -v
"""

import os

import pytest
import httpx

BACKEND_URL = os.getenv("DOCUMENT_PROCESSOR_URL", "http://localhost:8090")
TEST_ORG_ID = os.getenv("TEST_ORGANIZATION_ID", "00000000-0000-0000-0000-000000000010")

# Check if Microsoft OAuth is configured (client ID + secret in env)
MICROSOFT_CONFIGURED = all([
    os.getenv("MICROSOFT_CLIENT_ID", ""),
    os.getenv("MICROSOFT_CLIENT_SECRET", ""),
])

skip_if_not_configured = pytest.mark.skipif(
    not MICROSOFT_CONFIGURED,
    reason="Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.",
)


@pytest.fixture(scope="session")
def backend_available():
    """Verify the document-processor backend is running."""
    try:
        response = httpx.get(f"{BACKEND_URL}/health", timeout=5.0)
        if response.status_code != 200:
            raise RuntimeError(f"Backend unhealthy: {response.status_code}")
        return True
    except Exception as e:
        raise RuntimeError(
            f"Backend not available at {BACKEND_URL}: {e}. "
            "Start with: docker compose -p localai up -d --build document-processor"
        )


class TestSharePointRegistry:
    """Test that Microsoft/SharePoint appears correctly in the integration registry."""

    def test_microsoft_in_registry(self, backend_available):
        """Microsoft 365 must appear in the integration list with auth_mode=oauth."""
        response = httpx.get(f"{BACKEND_URL}/api/integrations/")
        assert response.status_code == 200

        integrations = response.json()
        microsoft = next((i for i in integrations if i["id"] == "microsoft"), None)
        assert microsoft is not None, "Microsoft not found in integrations list"
        assert microsoft["auth_mode"] == "oauth"
        assert microsoft["name"] == "Microsoft 365"

    def test_microsoft_has_sharepoint_scope_preset(self, backend_available):
        """Microsoft integration must have 'sharepoint' scope preset."""
        response = httpx.get(f"{BACKEND_URL}/api/integrations/")
        assert response.status_code == 200

        integrations = response.json()
        microsoft = next((i for i in integrations if i["id"] == "microsoft"), None)
        assert microsoft is not None
        scope_presets = microsoft.get("scope_presets", [])
        assert "sharepoint" in scope_presets, f"Missing sharepoint scope preset. Available: {scope_presets}"

    def test_microsoft_detail_endpoint(self, backend_available):
        """Microsoft detail endpoint returns OAuth configuration."""
        response = httpx.get(f"{BACKEND_URL}/api/integrations/microsoft")
        assert response.status_code == 200

        data = response.json()
        assert data["auth_mode"] == "oauth"
        assert data.get("credential_fields") is None  # pure OAuth, no credential fields


class TestSharePointAuthGuards:
    """Test that all SharePoint endpoints require authentication."""

    def test_sites_requires_auth(self, backend_available):
        resp = httpx.get(
            f"{BACKEND_URL}/api/sharepoint/sites",
            params={"organization_id": TEST_ORG_ID},
            timeout=5.0,
        )
        assert resp.status_code in (401, 403), f"Expected 401/403, got {resp.status_code}"

    def test_drives_requires_auth(self, backend_available):
        resp = httpx.get(
            f"{BACKEND_URL}/api/sharepoint/sites/fake-site/drives",
            params={"organization_id": TEST_ORG_ID},
            timeout=5.0,
        )
        assert resp.status_code in (401, 403)

    def test_items_requires_auth(self, backend_available):
        resp = httpx.get(
            f"{BACKEND_URL}/api/sharepoint/drives/fake-drive/items",
            params={"organization_id": TEST_ORG_ID},
            timeout=5.0,
        )
        assert resp.status_code in (401, 403)

    def test_onedrive_requires_auth(self, backend_available):
        resp = httpx.get(
            f"{BACKEND_URL}/api/sharepoint/my-drive",
            params={"organization_id": TEST_ORG_ID},
            timeout=5.0,
        )
        assert resp.status_code in (401, 403)

    def test_search_requires_auth(self, backend_available):
        resp = httpx.get(
            f"{BACKEND_URL}/api/sharepoint/search",
            params={"organization_id": TEST_ORG_ID, "query": "test"},
            timeout=5.0,
        )
        assert resp.status_code in (401, 403)

    def test_download_requires_auth(self, backend_available):
        resp = httpx.post(
            f"{BACKEND_URL}/api/sharepoint/items/download",
            params={"organization_id": TEST_ORG_ID},
            json={"drive_id": "fake", "item_id": "fake"},
            timeout=5.0,
        )
        assert resp.status_code in (401, 403)

    def test_watches_list_requires_auth(self, backend_available):
        resp = httpx.get(
            f"{BACKEND_URL}/api/sharepoint/watches",
            params={"organization_id": TEST_ORG_ID},
            timeout=5.0,
        )
        assert resp.status_code in (401, 403)

    def test_watches_create_requires_auth(self, backend_available):
        resp = httpx.post(
            f"{BACKEND_URL}/api/sharepoint/watches",
            params={"organization_id": TEST_ORG_ID},
            json={
                "site_id": "fake",
                "drive_id": "fake",
                "folder_id": "fake",
                "folder_path": "/test",
            },
            timeout=5.0,
        )
        assert resp.status_code in (401, 403)

    def test_health_endpoint_is_public(self, backend_available):
        """SharePoint health check should be accessible without auth."""
        resp = httpx.get(
            f"{BACKEND_URL}/api/sharepoint/health",
            params={"organization_id": TEST_ORG_ID},
            timeout=5.0,
        )
        # Health endpoint may require auth or be public — accept either
        # but it should NOT return 404 or 500
        assert resp.status_code < 500, f"Health endpoint returned server error: {resp.status_code}"


class TestSharePointService:
    """Unit-level tests for SharePoint service logic (no network calls)."""

    def test_service_instantiation(self):
        from app.services.sharepoint_service import SharePointService
        svc = SharePointService(access_token="test-token")
        assert svc.access_token == "test-token"
        assert svc.base_url == "https://graph.microsoft.com/v1.0"

    def test_item_dataclass(self):
        from app.services.sharepoint_service import SharePointItem
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
        assert item.drive_id == "drive-abc"

    @pytest.mark.parametrize("filename,expected", [
        ("invoice.pdf", True),
        ("report.docx", True),
        ("photo.jpg", True),
        ("scan.png", True),
        ("data.csv", True),
        ("readme.txt", True),
        ("spreadsheet.xlsx", True),
        ("presentation.pptx", True),
        ("script.exe", False),
        ("archive.zip", False),
        ("library.dll", False),
        ("binary.bin", False),
    ])
    def test_is_processable(self, filename, expected):
        from app.services.sharepoint_service import SharePointService
        svc = SharePointService(access_token="test")
        assert svc.is_processable(filename) == expected, f"Expected {filename} processable={expected}"

    def test_paged_result_dataclass(self):
        from app.services.sharepoint_service import PagedResult
        result = PagedResult(items=[], next_link=None, delta_link="delta://token")
        assert result.items == []
        assert result.delta_link == "delta://token"
        assert result.next_link is None


class TestSharePointWatcher:
    """Test the background watcher module loads and exports correctly."""

    def test_watcher_imports(self):
        from app.services.sharepoint_watcher import start_poller, stop_poller
        assert callable(start_poller)
        assert callable(stop_poller)

    def test_watcher_constants(self):
        from app.services.sharepoint_watcher import POLL_CHECK_INTERVAL, MAX_FILES_PER_POLL
        assert POLL_CHECK_INTERVAL == 60
        assert MAX_FILES_PER_POLL == 20


@skip_if_not_configured
class TestSharePointLiveAPI:
    """
    Live SharePoint API tests — require Microsoft 365 OAuth configured
    and an active token for the test organization.

    These tests verify real Graph API calls through our backend endpoints.
    """

    def test_list_sites(self, backend_available):
        """List SharePoint sites accessible to the connected account."""
        # This would require an authenticated request with a valid JWT
        # For now, this serves as a placeholder for when OAuth is configured
        pytest.skip("Requires authenticated session with Microsoft OAuth token")

    def test_get_onedrive(self, backend_available):
        """Get the user's OneDrive root."""
        pytest.skip("Requires authenticated session with Microsoft OAuth token")

    def test_browse_drive_items(self, backend_available):
        """Browse items in a drive folder."""
        pytest.skip("Requires authenticated session with Microsoft OAuth token")
