"""
Regression Test: Environment Variables & Service Connectivity

Verifies that SendGrid and PostHog environment variables are properly configured
and that the services can be reached from the document-processor backend.

This test was created after a production incident where SendGrid env vars
were missing from the CI/CD build, causing all email delivery to silently fail.

Run with:
    cd document-processor && python -m pytest tests/test_env_services_regression.py -v
"""

import os
import pytest
import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8090")


class TestSendGridConfiguration:
    """Verify SendGrid is properly configured and reachable."""

    def test_sendgrid_api_key_is_set(self):
        """SENDGRID_API_KEY must be set in the environment."""
        api_key = os.getenv("SENDGRID_API_KEY", "")
        assert api_key, (
            "SENDGRID_API_KEY environment variable is not set. "
            "Email delivery will be broken. "
            "Set it in root .env and ensure docker-compose passes it to the container."
        )
        assert api_key.startswith("SG."), (
            f"SENDGRID_API_KEY does not start with 'SG.' — got '{api_key[:5]}...'. "
            "This does not look like a valid SendGrid API key."
        )

    def test_sendgrid_from_email_is_set_in_container(self):
        """SENDGRID_FROM_EMAIL must be available via the running service.

        docker-compose.yml provides a default (nick@fetchtext.io), so we
        verify via the health endpoint rather than local env vars.
        """
        response = httpx.get(f"{BACKEND_URL}/api/email/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data["from_email"], (
            "from_email is empty in health response. "
            "SENDGRID_FROM_EMAIL is not set in the document-processor container."
        )
        assert "@" in data["from_email"], (
            f"from_email '{data['from_email']}' is not a valid email"
        )

    def test_app_url_is_set_in_container(self):
        """APP_URL must be available via the running service for email links."""
        response = httpx.get(f"{BACKEND_URL}/api/email/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data["app_url"], (
            "app_url is empty in health response. "
            "APP_URL environment variable is not set in the document-processor container. "
            "Email invitation links will be broken."
        )
        assert data["app_url"].startswith("http"), (
            f"app_url '{data['app_url']}' does not start with http"
        )


class TestEmailHealthEndpoint:
    """Verify the email health endpoint reports correct configuration status."""

    def test_email_health_returns_configured(self):
        """GET /api/email/health must report configured=true."""
        response = httpx.get(f"{BACKEND_URL}/api/email/health", timeout=10)
        assert response.status_code == 200, (
            f"Email health endpoint returned {response.status_code}: {response.text}"
        )
        data = response.json()
        assert data["configured"] is True, (
            f"Email health reports configured=false. "
            f"SendGrid API key is missing in the document-processor container. "
            f"Response: {data}"
        )
        assert data["from_email"], "from_email is empty in health response"
        assert data["app_url"], (
            f"app_url is empty in health response — email links will be broken. "
            f"Set APP_URL environment variable."
        )

    def test_email_send_rejects_without_required_fields(self):
        """POST /api/email/send-invitation with missing fields should return 422."""
        response = httpx.post(
            f"{BACKEND_URL}/api/email/send-invitation",
            json={"to_email": "test@example.com"},
            timeout=10,
        )
        # FastAPI returns 422 for missing required fields
        assert response.status_code == 422, (
            f"Expected 422 for incomplete request, got {response.status_code}"
        )


class TestSendGridConnectivity:
    """Verify SendGrid API is reachable and the key is valid."""

    def test_sendgrid_api_key_is_valid(self):
        """Verify the SendGrid API key can authenticate against the API."""
        api_key = os.getenv("SENDGRID_API_KEY", "")
        if not api_key:
            pytest.fail("SENDGRID_API_KEY not set — cannot test connectivity")

        # Call SendGrid's API key validation endpoint
        # GET /v3/scopes returns the key's permissions if valid
        response = httpx.get(
            "https://api.sendgrid.com/v3/scopes",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=15,
        )
        assert response.status_code == 200, (
            f"SendGrid API returned {response.status_code}. "
            f"The API key may be invalid or revoked. "
            f"Response: {response.text[:200]}"
        )
        data = response.json()
        scopes = data.get("scopes", [])
        assert "mail.send" in scopes, (
            f"SendGrid API key is valid but missing 'mail.send' permission. "
            f"Available scopes: {scopes[:10]}..."
        )


class TestBackendHealthEndpoint:
    """Verify the document-processor backend is running and healthy."""

    def test_backend_health(self):
        """GET /health must return 200."""
        response = httpx.get(f"{BACKEND_URL}/health", timeout=10)
        assert response.status_code == 200, (
            f"Backend health check failed with {response.status_code}: {response.text}. "
            f"Is the document-processor container running?"
        )
