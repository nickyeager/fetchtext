"""Integration tests for SSO router endpoints."""
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
