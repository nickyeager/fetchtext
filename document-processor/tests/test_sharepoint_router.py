"""Integration tests for SharePoint router endpoints.
Requires: backend running on localhost:8090, Microsoft 365 OAuth not connected
(tests auth requirements).
"""
import requests
import pytest

BACKEND_URL = "http://localhost:8090"


@pytest.fixture(autouse=True)
def _require_backend():
    """Skip all tests if the backend is not reachable."""
    try:
        resp = requests.get(f"{BACKEND_URL}/health", timeout=5)
        resp.raise_for_status()
    except Exception:
        pytest.skip("Backend not available at localhost:8090")


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
