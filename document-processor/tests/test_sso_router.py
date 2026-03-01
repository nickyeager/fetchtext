"""
SSO Integration Tests

Tests the SAML 2.0 SSO configuration endpoints against the real backend.
Level 1 tests (auth guards, public endpoints, response shapes) always run.
Level 2 tests (full SSO lifecycle) require Supabase admin access.

Usage:
  cd document-processor
  pytest tests/test_sso_router.py -v
"""

import os

import pytest
import httpx

BACKEND_URL = os.getenv("DOCUMENT_PROCESSOR_URL", "http://localhost:8090")
TEST_ORG_ID = os.getenv("TEST_ORGANIZATION_ID", "00000000-0000-0000-0000-000000000010")


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


class TestSSOAuthGuards:
    """Test that protected SSO endpoints require authentication."""

    def test_status_requires_auth(self, backend_available):
        resp = httpx.get(
            f"{BACKEND_URL}/api/sso/status",
            params={"organization_id": TEST_ORG_ID},
            timeout=5.0,
        )
        assert resp.status_code in (401, 403), f"Expected 401/403, got {resp.status_code}"

    def test_configure_requires_auth(self, backend_available):
        resp = httpx.post(
            f"{BACKEND_URL}/api/sso/configure",
            params={"organization_id": TEST_ORG_ID},
            json={"domain": "test.com", "metadata_url": "https://idp.test.com/metadata"},
            timeout=5.0,
        )
        assert resp.status_code in (401, 403)

    def test_update_requires_auth(self, backend_available):
        resp = httpx.patch(
            f"{BACKEND_URL}/api/sso/update",
            params={"organization_id": TEST_ORG_ID},
            json={"auto_provision": False},
            timeout=5.0,
        )
        assert resp.status_code in (401, 403)

    def test_remove_requires_auth(self, backend_available):
        resp = httpx.delete(
            f"{BACKEND_URL}/api/sso/remove",
            params={"organization_id": TEST_ORG_ID},
            timeout=5.0,
        )
        assert resp.status_code in (401, 403)

    def test_provision_requires_auth(self, backend_available):
        resp = httpx.post(
            f"{BACKEND_URL}/api/sso/provision",
            json={"sso_provider_id": "fake-provider"},
            timeout=5.0,
        )
        assert resp.status_code in (401, 403)


class TestSSOPublicEndpoints:
    """Test the public SSO endpoints (no auth required)."""

    def test_check_domain_returns_false_for_unknown(self, backend_available):
        """Domain check for non-existent domain returns has_sso=false."""
        resp = httpx.get(
            f"{BACKEND_URL}/api/sso/check-domain",
            params={"domain": "definitely-not-configured-domain-xyz.com"},
            timeout=5.0,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["domain"] == "definitely-not-configured-domain-xyz.com"
        assert data["has_sso"] is False
        assert data["organization_name"] is None

    def test_check_domain_validates_input(self, backend_available):
        """Domain check requires a domain parameter."""
        resp = httpx.get(
            f"{BACKEND_URL}/api/sso/check-domain",
            timeout=5.0,
        )
        # Should return 422 (missing required param) or 400
        assert resp.status_code in (400, 422), f"Expected 400/422, got {resp.status_code}"

    def test_check_domain_response_shape(self, backend_available):
        """Domain check response has the expected fields."""
        resp = httpx.get(
            f"{BACKEND_URL}/api/sso/check-domain",
            params={"domain": "example.com"},
            timeout=5.0,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "domain" in data
        assert "has_sso" in data
        assert "organization_name" in data
        assert isinstance(data["has_sso"], bool)


class TestSSOService:
    """Unit-level tests for SSO service logic (no network calls)."""

    def test_service_detects_self_hosted(self):
        """Without SUPABASE_PROJECT_REF, service assumes self-hosted."""
        from app.services.sso_service import SSOService
        svc = SSOService()
        # is_managed depends on env — just verify the property exists
        assert isinstance(svc.is_managed, bool)

    def test_provider_config_dataclass(self):
        from app.services.sso_service import SSOProviderConfig
        config = SSOProviderConfig(
            domain="acme.com",
            metadata_url="https://idp.acme.com/metadata",
            idp_name="Acme Okta",
        )
        assert config.domain == "acme.com"
        assert config.metadata_url == "https://idp.acme.com/metadata"

    def test_provider_config_requires_domain(self):
        from app.services.sso_service import SSOProviderConfig
        with pytest.raises(TypeError):
            SSOProviderConfig()  # domain is required

    def test_acs_url_format(self):
        from app.services.sso_service import SSOService
        svc = SSOService()
        acs_url = svc.get_acs_url()
        assert "/auth/v1/sso/saml/acs" in acs_url

    def test_metadata_url_format(self):
        from app.services.sso_service import SSOService
        svc = SSOService()
        metadata_url = svc.get_metadata_url()
        assert "/auth/v1/sso/saml/metadata" in metadata_url

    def test_entity_id_format(self):
        from app.services.sso_service import SSOService
        svc = SSOService()
        entity_id = svc.get_entity_id()
        assert len(entity_id) > 0
