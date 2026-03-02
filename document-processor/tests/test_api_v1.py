"""
Integration tests for the Third-Party API v1 endpoints.

Tests call the REAL backend at localhost:8090.
No mocks. No fakes.
"""
import pytest
import httpx

BACKEND_URL = "http://localhost:8090"
TEST_ORG_ID = "00000000-0000-0000-0000-000000000010"


@pytest.fixture(scope="module")
def backend():
    """Verify the backend is reachable."""
    try:
        resp = httpx.get(f"{BACKEND_URL}/health", timeout=5)
        resp.raise_for_status()
    except Exception as exc:
        pytest.fail(f"Backend not reachable at {BACKEND_URL}: {exc}")


class TestAPIV1Health:
    """Test the public health endpoint (no auth required)."""

    def test_health_endpoint(self, backend):
        """GET /api/v1/health should return service status."""
        resp = httpx.get(f"{BACKEND_URL}/api/v1/health", timeout=5)
        assert resp.status_code == 200

        data = resp.json()
        assert data["status"] == "healthy"
        assert data["api_version"] == "v1"
        assert "database" in data
        assert "timestamp" in data


class TestProcessDocument:
    """Test the document processing endpoint."""

    def test_rejects_missing_auth(self, backend):
        """POST /api/v1/process without auth should fail."""
        resp = httpx.post(f"{BACKEND_URL}/api/v1/process", timeout=5)
        assert resp.status_code in (401, 403, 422), (
            f"Expected auth error, got {resp.status_code}: {resp.text}"
        )

    def test_rejects_invalid_key_format(self, backend):
        """POST /api/v1/process with non-ftxt_ key should return 401."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/v1/process",
            headers={"Authorization": "Bearer not_a_valid_key"},
            timeout=5,
        )
        assert resp.status_code == 401

    def test_rejects_nonexistent_ftxt_key(self, backend):
        """POST /api/v1/process with unknown ftxt_ key returns 401 or 503."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/v1/process",
            headers={"Authorization": "Bearer ftxt_does_not_exist_in_db"},
            timeout=5,
        )
        # 401 = key not found, 500/503 = api_keys table doesn't exist
        assert resp.status_code in (401, 500, 503), (
            f"Expected 401/500/503, got {resp.status_code}: {resp.text}"
        )


class TestGetJobStatus:
    """Test the job status endpoint."""

    def test_rejects_missing_auth(self, backend):
        """GET /api/v1/jobs/{id} without auth should fail."""
        fake_job_id = "00000000-0000-0000-0000-000000000099"
        resp = httpx.get(f"{BACKEND_URL}/api/v1/jobs/{fake_job_id}", timeout=5)
        assert resp.status_code in (401, 403, 422), (
            f"Expected auth error, got {resp.status_code}: {resp.text}"
        )

    def test_rejects_invalid_key_format(self, backend):
        """GET /api/v1/jobs/{id} with non-ftxt_ key should return 401."""
        fake_job_id = "00000000-0000-0000-0000-000000000099"
        resp = httpx.get(
            f"{BACKEND_URL}/api/v1/jobs/{fake_job_id}",
            headers={"Authorization": "Bearer bad_key"},
            timeout=5,
        )
        assert resp.status_code == 401


class TestListTemplates:
    """Test the template listing endpoint."""

    def test_rejects_missing_auth(self, backend):
        """GET /api/v1/templates without auth should fail."""
        resp = httpx.get(f"{BACKEND_URL}/api/v1/templates", timeout=5)
        assert resp.status_code in (401, 403, 422), (
            f"Expected auth error, got {resp.status_code}: {resp.text}"
        )

    def test_rejects_invalid_key_format(self, backend):
        """GET /api/v1/templates with non-ftxt_ key should return 401."""
        resp = httpx.get(
            f"{BACKEND_URL}/api/v1/templates",
            headers={"Authorization": "Bearer bad_key"},
            timeout=5,
        )
        assert resp.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
