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
