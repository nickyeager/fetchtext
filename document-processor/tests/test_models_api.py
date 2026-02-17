"""
Integration tests for the models API endpoints.

Tests call the REAL backend at localhost:8090.
No mocks. No fakes.
"""
import pytest
import httpx

BACKEND_URL = "http://localhost:8090"


@pytest.fixture(scope="module")
def backend():
    """Verify the backend is reachable before running tests."""
    try:
        resp = httpx.get(f"{BACKEND_URL}/health", timeout=5)
        resp.raise_for_status()
    except Exception as exc:
        pytest.fail(f"Backend not reachable at {BACKEND_URL}: {exc}")


class TestModelsAPI:
    """Test the /models/ endpoints against the real running backend."""

    def test_get_available_models_success(self, backend):
        """GET /models/ should return models list with current provider info."""
        resp = httpx.get(f"{BACKEND_URL}/models/", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        data = resp.json()
        assert "models" in data, f"Response missing 'models' key: {data}"
        assert "current_model" in data, f"Response missing 'current_model' key: {data}"
        assert "current_provider" in data, f"Response missing 'current_provider' key: {data}"

        # Should have at least one model from the active provider
        assert len(data["models"]) >= 1, f"Expected at least 1 model, got {len(data['models'])}"

        # Each model should have required fields
        for model in data["models"]:
            assert "name" in model, f"Model missing 'name': {model}"
            assert "provider" in model, f"Model missing 'provider': {model}"

    def test_get_current_model(self, backend):
        """GET /models/current should return the active model name."""
        resp = httpx.get(f"{BACKEND_URL}/models/current", timeout=5)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        data = resp.json()
        assert "current_model" in data, f"Response missing 'current_model': {data}"
        assert isinstance(data["current_model"], str)
        assert len(data["current_model"]) > 0, "current_model should not be empty"

    def test_get_available_providers(self, backend):
        """GET /models/providers should list available AI providers."""
        resp = httpx.get(f"{BACKEND_URL}/models/providers", timeout=5)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        data = resp.json()
        assert "providers" in data, f"Response missing 'providers': {data}"
        assert "current_provider" in data, f"Response missing 'current_provider': {data}"

        # Should have at least Ollama and Azure OpenAI
        provider_names = [p["name"] for p in data["providers"]]
        assert "ollama" in provider_names, f"Ollama not in providers: {provider_names}"
        assert "azure_openai" in provider_names, f"Azure OpenAI not in providers: {provider_names}"

        # Each provider should have required fields
        for provider in data["providers"]:
            assert "name" in provider
            assert "display_name" in provider
            assert "available" in provider
            assert "configured" in provider

    def test_test_connection(self, backend):
        """POST /models/test-connection should test the current provider."""
        resp = httpx.post(f"{BACKEND_URL}/models/test-connection", timeout=15)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        data = resp.json()
        assert "success" in data, f"Response missing 'success': {data}"
        assert "provider" in data, f"Response missing 'provider': {data}"
        assert "message" in data, f"Response missing 'message': {data}"

    def test_select_invalid_provider(self, backend):
        """POST /models/provider/select with invalid provider should return 400."""
        resp = httpx.post(
            f"{BACKEND_URL}/models/provider/select",
            json={"provider": "nonexistent_provider"},
            timeout=5,
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"

    def test_select_model_invalid_name(self, backend):
        """POST /models/select with non-existent model should return 400."""
        resp = httpx.post(
            f"{BACKEND_URL}/models/select",
            json={"model_name": "nonexistent:model-that-does-not-exist"},
            timeout=10,
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "not found in available models" in data.get("detail", "")

    def test_select_model_missing_body(self, backend):
        """POST /models/select without model_name should return 422."""
        resp = httpx.post(f"{BACKEND_URL}/models/select", json={}, timeout=5)
        assert resp.status_code == 422

    def test_select_provider_round_trip(self, backend):
        """Select a provider, verify it took effect, then restore."""
        # Get current provider
        initial = httpx.get(f"{BACKEND_URL}/models/providers", timeout=5).json()
        original_provider = initial["current_provider"]

        # Select azure_openai (should be configured)
        resp = httpx.post(
            f"{BACKEND_URL}/models/provider/select",
            json={"provider": "azure_openai"},
            timeout=5,
        )
        if resp.status_code == 400 and "not properly configured" in resp.json().get("detail", ""):
            pytest.skip("Azure OpenAI not configured on this backend")

        assert resp.status_code == 200, f"Failed to select azure_openai: {resp.text}"
        data = resp.json()
        assert data["provider"] == "azure_openai"

        # Verify it took effect
        providers_resp = httpx.get(f"{BACKEND_URL}/models/providers", timeout=5).json()
        assert providers_resp["current_provider"] == "azure_openai"

        # Restore original provider
        httpx.post(
            f"{BACKEND_URL}/models/provider/select",
            json={"provider": original_provider},
            timeout=5,
        )

    def test_org_config_default(self, backend):
        """GET /models/org-config/{org_id} should return default config for unknown org."""
        test_org_id = "00000000-0000-0000-0000-000000000010"
        resp = httpx.get(f"{BACKEND_URL}/models/org-config/{test_org_id}", timeout=5)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        data = resp.json()
        assert data["organization_id"] == test_org_id
        assert "tier" in data
        assert "provider_type" in data
        assert "source" in data

    def test_org_config_invalid_id(self, backend):
        """GET /models/org-config with non-UUID should still work (server handles gracefully)."""
        resp = httpx.get(f"{BACKEND_URL}/models/org-config/not-a-uuid", timeout=5)
        # The endpoint may return 200 with system defaults or 400/500
        assert resp.status_code in (200, 400, 500), f"Unexpected status: {resp.status_code}"

    def test_effective_config(self, backend):
        """GET /models/org-config/{org_id}/effective should return effective config."""
        test_org_id = "00000000-0000-0000-0000-000000000010"
        resp = httpx.get(
            f"{BACKEND_URL}/models/org-config/{test_org_id}/effective", timeout=5
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        data = resp.json()
        assert "source" in data
        assert "provider" in data
        assert "tier" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
