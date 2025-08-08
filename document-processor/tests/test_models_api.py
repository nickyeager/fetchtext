"""
Tests for the models API endpoints
"""
import pytest
import asyncio
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from app.main import app
import aiohttp

client = TestClient(app)

# Mock Ollama response data
MOCK_OLLAMA_TAGS_RESPONSE = {
    "models": [
        {
            "name": "qwen2.5:7b-instruct-q4_K_M",
            "size": "4200000000",
            "modified_at": "2024-01-15T10:30:00Z",
            "digest": "sha256:abc123"
        },
        {
            "name": "llama2:7b",
            "size": "3800000000", 
            "modified_at": "2024-01-10T08:15:00Z",
            "digest": "sha256:def456"
        }
    ]
}

class TestModelsAPI:
    """Test the models API endpoints"""

    @patch('aiohttp.ClientSession.get')
    def test_get_available_models_success(self, mock_get):
        """Test successful retrieval of available models"""
        # Mock the aiohttp response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=MOCK_OLLAMA_TAGS_RESPONSE)
        mock_get.return_value.__aenter__.return_value = mock_response

        response = client.get("/models/")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "models" in data
        assert "current_model" in data
        assert len(data["models"]) == 2
        
        # Check first model
        first_model = data["models"][0]
        assert first_model["name"] == "qwen2.5:7b-instruct-q4_K_M"
        assert first_model["size"] == "4200000000"
        assert "digest" in first_model
        assert "modified" in first_model

    @patch('aiohttp.ClientSession.get')
    def test_get_available_models_ollama_unavailable(self, mock_get):
        """Test when Ollama service is unavailable"""
        # Mock Ollama service returning 503
        mock_response = AsyncMock()
        mock_response.status = 503
        mock_get.return_value.__aenter__.return_value = mock_response

        response = client.get("/models/")
        
        assert response.status_code == 503
        data = response.json()
        assert "detail" in data
        assert "Ollama service unavailable" in data["detail"]

    @patch('aiohttp.ClientSession.get')
    def test_get_available_models_connection_error(self, mock_get):
        """Test when there's a connection error to Ollama"""
        # Mock connection error
        mock_get.side_effect = aiohttp.ClientError("Connection failed")

        response = client.get("/models/")
        
        assert response.status_code == 503
        data = response.json()
        assert "detail" in data
        assert "Failed to connect to Ollama service" in data["detail"]

    def test_get_current_model(self):
        """Test getting the current active model"""
        response = client.get("/models/current")
        
        assert response.status_code == 200
        data = response.json()
        assert "current_model" in data
        # Should return the default model
        assert data["current_model"] == "qwen2.5:7b-instruct-q4_K_M"

    @patch('aiohttp.ClientSession.get')
    @patch('aiohttp.ClientSession.post')
    def test_set_active_model_success(self, mock_post, mock_get):
        """Test successfully setting an active model"""
        # Mock the get request for validation
        mock_get_response = AsyncMock()
        mock_get_response.status = 200
        mock_get_response.json = AsyncMock(return_value=MOCK_OLLAMA_TAGS_RESPONSE)
        mock_get.return_value.__aenter__.return_value = mock_get_response

        # Test setting a valid model
        response = client.post("/models/select", json={
            "model_name": "llama2:7b"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["model"] == "llama2:7b"
        assert "Active model set to" in data["message"]

    @patch('aiohttp.ClientSession.get')
    def test_set_active_model_invalid_model(self, mock_get):
        """Test setting an invalid/unavailable model"""
        # Mock the get request for validation
        mock_get_response = AsyncMock()
        mock_get_response.status = 200
        mock_get_response.json = AsyncMock(return_value=MOCK_OLLAMA_TAGS_RESPONSE)
        mock_get.return_value.__aenter__.return_value = mock_get_response

        # Test setting an invalid model
        response = client.post("/models/select", json={
            "model_name": "nonexistent:model"
        })
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "not found in available models" in data["detail"]

    def test_set_active_model_missing_body(self):
        """Test setting model without request body"""
        response = client.post("/models/select", json={})
        
        assert response.status_code == 422  # Validation error

    def test_set_active_model_invalid_json(self):
        """Test setting model with invalid JSON"""
        response = client.post("/models/select", data="invalid json")
        
        assert response.status_code == 422  # Validation error

class TestModelUtilities:
    """Test model utility functions in the service"""

    def test_model_name_formatting(self):
        """Test model name formatting utilities"""
        from app.services.enhanced_docling_service import EnhancedDoclingService
        
        service = EnhancedDoclingService()
        
        # Test that model is set correctly
        assert service.model == "qwen2.5:7b-instruct-q4_K_M"
        
        # Test model changing
        original_model = service.model
        service.model = "llama2:7b"
        assert service.model == "llama2:7b"
        
        # Reset for other tests
        service.model = original_model

if __name__ == "__main__":
    pytest.main([__file__])