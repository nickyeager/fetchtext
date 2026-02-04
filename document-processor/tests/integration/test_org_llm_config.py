"""
Integration tests for organization-aware LLM configuration.

Tests the complete flow from API endpoints to database operations.
These tests require:
- Document processor running at localhost:8090
- Supabase running with organization_llm_configs table
"""
import pytest
import httpx
import uuid
from typing import Generator

# Test configuration
BASE_URL = "http://localhost:8090"
TIMEOUT = 30.0


@pytest.fixture
def test_org_id() -> str:
    """Generate a unique test organization ID (valid UUID)"""
    return str(uuid.uuid4())


@pytest.fixture
def real_org_id(client: httpx.Client) -> str:
    """
    Get a real organization ID from the database for CRUD tests.
    This is needed because organization_llm_configs has a foreign key to organizations.
    """
    # Use a known test organization from the database
    # In production tests, this would be created/cleaned up properly
    return "3e153efc-9a54-41db-8ad4-4457b9fb05ab"  # Admin's Workspace


@pytest.fixture
def client() -> Generator[httpx.Client, None, None]:
    """HTTP client for API requests"""
    with httpx.Client(base_url=BASE_URL, timeout=TIMEOUT) as client:
        yield client


class TestEffectiveConfigEndpoint:
    """Test GET /models/org-config/{org_id}/effective endpoint"""

    def test_returns_system_default_for_nonexistent_org(self, client: httpx.Client, test_org_id: str):
        """
        When an organization has no custom LLM config,
        the effective config should return system default.
        """
        response = client.get(f"/models/org-config/{test_org_id}/effective")

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()

        # Should return system default
        assert data["source"] == "system_default", f"Expected system_default, got {data['source']}"
        assert data["provider"] == "azure_openai", "Expected azure_openai provider"
        assert data["tier"] == "non_managed", "Expected non_managed tier"
        assert data["organization_id"] == test_org_id
        assert data["has_usage_limits"] == False, "System default should not have usage limits"
        assert data["is_within_limits"] == True

    def test_returns_system_default_without_org_id(self, client: httpx.Client):
        """
        When called without org_id (empty string),
        should return system default config.
        """
        # The endpoint requires org_id in path, so this tests with a placeholder
        response = client.get("/models/org-config/no-org/effective")

        assert response.status_code == 200
        data = response.json()
        assert data["source"] == "system_default"


class TestOrgConfigCRUD:
    """Test CRUD operations for organization LLM configs"""

    def test_create_org_config(self, client: httpx.Client, real_org_id: str):
        """
        Creating an org config should persist and be retrievable.
        """
        # Cleanup any existing config first
        client.delete(f"/models/org-config/{real_org_id}")

        # Create config
        config_data = {
            "tier": "non_managed",
            "provider_type": "shared",
            "daily_document_limit": 20,
            "monthly_document_limit": 500
        }

        response = client.put(
            f"/models/org-config/{real_org_id}",
            json=config_data
        )

        # May return 503 if database not connected (acceptable in some test environments)
        if response.status_code == 503:
            pytest.skip("Database not available for this test")

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert data["tier"] == "non_managed"
        assert data["provider_type"] == "shared"
        assert data["daily_document_limit"] == 20
        assert data["monthly_document_limit"] == 500

        # Cleanup
        client.delete(f"/models/org-config/{real_org_id}")

    def test_update_org_config(self, client: httpx.Client, real_org_id: str):
        """
        Updating an existing org config should persist changes.
        """
        # Cleanup any existing config first
        client.delete(f"/models/org-config/{real_org_id}")

        # Create initial config
        initial_config = {
            "tier": "non_managed",
            "provider_type": "shared",
            "daily_document_limit": 10,
            "monthly_document_limit": 200
        }

        response = client.put(f"/models/org-config/{real_org_id}", json=initial_config)
        if response.status_code == 503:
            pytest.skip("Database not available for this test")

        assert response.status_code == 200

        # Update config
        updated_config = {
            "tier": "professional",
            "provider_type": "byok_azure",
            "daily_document_limit": 1000,
            "monthly_document_limit": 10000
        }

        response = client.put(f"/models/org-config/{real_org_id}", json=updated_config)
        assert response.status_code == 200

        data = response.json()
        assert data["tier"] == "professional"
        assert data["provider_type"] == "byok_azure"
        assert data["daily_document_limit"] == 1000

        # Cleanup
        client.delete(f"/models/org-config/{real_org_id}")

    def test_delete_org_config(self, client: httpx.Client, real_org_id: str):
        """
        Deleting an org config should revert to system default.
        """
        # Create config
        config_data = {
            "tier": "professional",
            "provider_type": "byok_azure"
        }

        response = client.put(f"/models/org-config/{real_org_id}", json=config_data)
        if response.status_code == 503:
            pytest.skip("Database not available for this test")

        assert response.status_code == 200

        # Delete config
        response = client.delete(f"/models/org-config/{real_org_id}")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "success"

        # Verify effective config returns system default
        response = client.get(f"/models/org-config/{real_org_id}/effective")
        assert response.status_code == 200

        data = response.json()
        assert data["source"] == "system_default"

    def test_get_org_config(self, client: httpx.Client, real_org_id: str):
        """
        Getting an org config should return full config details.
        """
        # Create config first
        config_data = {
            "tier": "enterprise",
            "provider_type": "self_hosted",
            "custom_endpoint": "http://custom-ollama:11434"
        }

        response = client.put(f"/models/org-config/{real_org_id}", json=config_data)
        if response.status_code == 503:
            pytest.skip("Database not available for this test")

        assert response.status_code == 200

        # Get config
        response = client.get(f"/models/org-config/{real_org_id}")
        assert response.status_code == 200

        data = response.json()
        assert data["tier"] == "enterprise"
        assert data["provider_type"] == "self_hosted"
        assert data["custom_endpoint"] == "http://custom-ollama:11434"

        # Cleanup
        client.delete(f"/models/org-config/{real_org_id}")


class TestTierValidation:
    """Test tier and provider_type validation"""

    def test_invalid_tier_rejected(self, client: httpx.Client, real_org_id: str):
        """
        Invalid tier values should be rejected with 400.
        """
        config_data = {
            "tier": "invalid_tier",
            "provider_type": "shared"
        }

        response = client.put(f"/models/org-config/{real_org_id}", json=config_data)

        # Skip if database unavailable
        if response.status_code == 503:
            pytest.skip("Database not available for this test")

        assert response.status_code == 400, f"Expected 400 for invalid tier, got {response.status_code}"
        assert "Invalid tier" in response.json().get("detail", "")

    def test_invalid_provider_type_rejected(self, client: httpx.Client, real_org_id: str):
        """
        Invalid provider_type values should be rejected with 400.
        """
        config_data = {
            "tier": "non_managed",
            "provider_type": "invalid_provider"
        }

        response = client.put(f"/models/org-config/{real_org_id}", json=config_data)

        if response.status_code == 503:
            pytest.skip("Database not available for this test")

        assert response.status_code == 400, f"Expected 400 for invalid provider_type, got {response.status_code}"
        assert "Invalid provider_type" in response.json().get("detail", "")

    def test_valid_tiers_accepted(self, client: httpx.Client, real_org_id: str):
        """
        All valid tier values should be accepted.
        """
        valid_tiers = ["free", "non_managed", "professional", "enterprise"]

        for tier in valid_tiers:
            config_data = {
                "tier": tier,
                "provider_type": "shared"
            }

            response = client.put(f"/models/org-config/{real_org_id}", json=config_data)

            if response.status_code == 503:
                pytest.skip("Database not available for this test")

            assert response.status_code == 200, f"Tier '{tier}' should be accepted"

            # Cleanup between tests
            client.delete(f"/models/org-config/{real_org_id}")

    def test_valid_provider_types_accepted(self, client: httpx.Client, real_org_id: str):
        """
        All valid provider_type values should be accepted.
        """
        valid_providers = ["none", "shared", "byok_azure", "byok_openai", "self_hosted"]

        for provider in valid_providers:
            config_data = {
                "tier": "professional",
                "provider_type": provider
            }

            response = client.put(f"/models/org-config/{real_org_id}", json=config_data)

            if response.status_code == 503:
                pytest.skip("Database not available for this test")

            assert response.status_code == 200, f"Provider type '{provider}' should be accepted"

            # Cleanup between tests
            client.delete(f"/models/org-config/{real_org_id}")


class TestUsageLimits:
    """Test usage limit functionality for non_managed tier"""

    def test_non_managed_has_usage_limits(self, client: httpx.Client, real_org_id: str):
        """
        Non-managed tier with shared provider should have usage limits.
        """
        config_data = {
            "tier": "non_managed",
            "provider_type": "shared",
            "daily_document_limit": 10,
            "monthly_document_limit": 200
        }

        response = client.put(f"/models/org-config/{real_org_id}", json=config_data)

        if response.status_code == 503:
            pytest.skip("Database not available for this test")

        assert response.status_code == 200

        # Get effective config
        response = client.get(f"/models/org-config/{real_org_id}/effective")
        assert response.status_code == 200

        data = response.json()
        assert data["has_usage_limits"] == True
        assert data["daily_limit"] == 10
        assert data["monthly_limit"] == 200
        assert data["is_within_limits"] == True

        # Cleanup
        client.delete(f"/models/org-config/{real_org_id}")

    def test_professional_no_usage_limits(self, client: httpx.Client, real_org_id: str):
        """
        Professional tier (BYOK) should not have usage limits.
        """
        config_data = {
            "tier": "professional",
            "provider_type": "byok_azure"
        }

        response = client.put(f"/models/org-config/{real_org_id}", json=config_data)

        if response.status_code == 503:
            pytest.skip("Database not available for this test")

        assert response.status_code == 200

        # Get effective config
        response = client.get(f"/models/org-config/{real_org_id}/effective")
        assert response.status_code == 200

        data = response.json()
        assert data["has_usage_limits"] == False

        # Cleanup
        client.delete(f"/models/org-config/{real_org_id}")


class TestBackwardsCompatibility:
    """Test that existing functionality still works"""

    def test_providers_endpoint_still_works(self, client: httpx.Client):
        """
        The original /models/providers endpoint should still work.
        """
        response = client.get("/models/providers")
        assert response.status_code == 200

        data = response.json()
        assert "providers" in data
        assert "current_provider" in data

    def test_models_endpoint_still_works(self, client: httpx.Client):
        """
        The original /models/ endpoint should still work.
        """
        response = client.get("/models/")
        assert response.status_code == 200

        data = response.json()
        assert "models" in data
        assert "current_model" in data

    def test_test_connection_still_works(self, client: httpx.Client):
        """
        The original /models/test-connection endpoint should still work.
        """
        response = client.post("/models/test-connection")
        assert response.status_code == 200

        data = response.json()
        assert "success" in data
        assert "provider" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
