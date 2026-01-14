"""Tests for two-pass extraction API integration."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock
import json
import sys

# Mock sendgrid before importing the app
sys.modules['sendgrid'] = MagicMock()
sys.modules['sendgrid.helpers'] = MagicMock()
sys.modules['sendgrid.helpers.mail'] = MagicMock()


class TestAPITwoPassExtraction:
    """Test API endpoint uses two-pass extraction."""

    @pytest.fixture
    def client(self):
        from app.main import app
        return TestClient(app)

    def test_extract_endpoint_accepts_two_pass_param(self, client):
        """Extract endpoint should accept use_two_pass parameter."""
        with patch('app.routers.enhanced_documents.two_pass_extractor') as mock_extractor:
            mock_extractor.extract_two_pass = AsyncMock(return_value={
                "extraction_method": "two_pass_intelligent",
                "extracted_values": {"vendor_name": {"value": "Test Corp", "confidence": 0.95}},
                "total_fields_requested": 1,
                "fields_extracted": 1,
                "confidence_threshold": 0.6,
                "success_rate": 1.0,
                "processing_time_ms": 100
            })

            response = client.post(
                "/api/enhanced-documents/extract-with-text",
                params={
                    "text_content": "Sample invoice text from Test Corp",
                    "template_data": json.dumps({"smart_variables": [{"name": "vendor_name", "type": "text"}]}),
                    "confidence_threshold": "0.6",
                    "use_two_pass": "true"
                }
            )

            # Should not return 422 (validation error) for the parameter
            assert response.status_code != 422, f"Got validation error: {response.text}"

    def test_extract_uses_two_pass_when_enabled(self, client):
        """Should use two-pass extractor when use_two_pass=true."""
        with patch('app.routers.enhanced_documents.two_pass_extractor') as mock_two_pass:
            mock_two_pass.extract_two_pass = AsyncMock(return_value={
                "extraction_method": "two_pass_intelligent",
                "extracted_values": {"vendor_name": {"value": "Acme", "confidence": 0.9}},
                "total_fields_requested": 1,
                "fields_extracted": 1,
                "confidence_threshold": 0.6,
                "success_rate": 1.0,
                "processing_time_ms": 50
            })

            client.post(
                "/api/enhanced-documents/extract-with-text",
                params={
                    "text_content": "Invoice from Acme Corp",
                    "template_data": json.dumps({"smart_variables": [{"name": "vendor_name", "type": "text"}]}),
                    "use_two_pass": "true"
                }
            )

            # Verify two-pass extractor was called
            mock_two_pass.extract_two_pass.assert_called_once()

    def test_extract_uses_standard_when_two_pass_disabled(self, client):
        """Should use standard extractor when use_two_pass=false."""
        with patch('app.routers.enhanced_documents.smart_field_extractor') as mock_standard:
            mock_standard.extract_fields_intelligently = AsyncMock(return_value={
                "extraction_method": "intelligent",
                "extracted_values": {"vendor_name": {"value": "Test", "confidence": 0.8}},
                "total_fields_requested": 1,
                "fields_extracted": 1
            })

            client.post(
                "/api/enhanced-documents/extract-with-text",
                params={
                    "text_content": "Invoice text",
                    "template_data": json.dumps({"smart_variables": [{"name": "vendor_name", "type": "text"}]}),
                    "use_two_pass": "false"
                }
            )

            # Verify standard extractor was called
            mock_standard.extract_fields_intelligently.assert_called_once()

    def test_extract_defaults_to_standard_when_two_pass_not_specified(self, client):
        """Should use standard extractor when use_two_pass is not specified (default)."""
        with patch('app.routers.enhanced_documents.smart_field_extractor') as mock_standard:
            mock_standard.extract_fields_intelligently = AsyncMock(return_value={
                "extraction_method": "intelligent",
                "extracted_values": {"vendor_name": {"value": "Default Corp", "confidence": 0.85}},
                "total_fields_requested": 1,
                "fields_extracted": 1
            })

            client.post(
                "/api/enhanced-documents/extract-with-text",
                params={
                    "text_content": "Invoice text from Default Corp",
                    "template_data": json.dumps({"smart_variables": [{"name": "vendor_name", "type": "text"}]})
                }
            )

            # Verify standard extractor was called (default behavior)
            mock_standard.extract_fields_intelligently.assert_called_once()

    def test_two_pass_response_includes_pass_stats(self, client):
        """Response from two-pass extraction should include pass statistics."""
        with patch('app.routers.enhanced_documents.two_pass_extractor') as mock_extractor:
            mock_extractor.extract_two_pass = AsyncMock(return_value={
                "extraction_method": "two_pass_intelligent",
                "extracted_values": {
                    "vendor_name": {"value": "Test Corp", "confidence": 0.95, "extraction_pass": 1},
                    "invoice_number": {"value": "INV-001", "confidence": 0.88, "extraction_pass": 2}
                },
                "total_fields_requested": 2,
                "fields_extracted": 2,
                "confidence_threshold": 0.6,
                "success_rate": 1.0,
                "processing_time_ms": 150,
                "pass_stats": {
                    "pass1_high_confidence": 1,
                    "pass2_refined": 1
                }
            })

            response = client.post(
                "/api/enhanced-documents/extract-with-text",
                params={
                    "text_content": "Invoice INV-001 from Test Corp",
                    "template_data": json.dumps({
                        "smart_variables": [
                            {"name": "vendor_name", "type": "text"},
                            {"name": "invoice_number", "type": "text"}
                        ]
                    }),
                    "use_two_pass": "true"
                }
            )

            assert response.status_code == 200
            data = response.json()
            extracted_data = data.get("extracted_data", {})

            # Verify pass_stats is included
            assert "pass_stats" in extracted_data
            assert extracted_data["pass_stats"]["pass1_high_confidence"] == 1
            assert extracted_data["pass_stats"]["pass2_refined"] == 1


class TestTwoPassAPIWithRealExtractor:
    """
    Tests with real two-pass extractor (integration-style).
    These tests verify the actual integration, not just mocks.
    """

    @pytest.fixture
    def client(self):
        from app.main import app
        return TestClient(app)

    def test_two_pass_param_is_recognized_by_endpoint(self, client):
        """Verify the endpoint accepts use_two_pass without 422 error."""
        # This test will pass only if the parameter is defined in the endpoint
        response = client.post(
            "/api/enhanced-documents/extract-with-text",
            params={
                "text_content": "Test document content",
                "template_data": json.dumps({"smart_variables": [{"name": "test_field", "type": "text"}]}),
                "use_two_pass": "true"
            }
        )

        # The key assertion: we should NOT get a 422 validation error for the parameter
        # Even if the extraction itself fails for other reasons, the parameter should be accepted
        assert response.status_code != 422, (
            f"Expected parameter to be recognized, but got 422 validation error: {response.text}"
        )


class TestSmartTemplateEndpointTwoPass:
    """Test that extract-with-smart-template endpoint also supports two-pass."""

    @pytest.fixture
    def client(self):
        from app.main import app
        return TestClient(app)

    def test_smart_template_endpoint_accepts_two_pass_param(self, client):
        """Smart template endpoint should accept use_two_pass parameter."""
        # Create a simple text file for upload
        from io import BytesIO

        test_content = b"Invoice from Test Corp\nTotal: $1,234.56"
        file_content = BytesIO(test_content)

        with patch('app.routers.enhanced_documents.two_pass_extractor') as mock_extractor:
            mock_extractor.extract_two_pass = AsyncMock(return_value={
                "extraction_method": "two_pass_intelligent",
                "extracted_values": {"vendor": {"value": "Test Corp", "confidence": 0.9}},
                "total_fields_requested": 1,
                "fields_extracted": 1,
                "success_rate": 1.0,
                "processing_time_ms": 100
            })

            response = client.post(
                "/api/enhanced-documents/extract-with-smart-template",
                files={"file": ("test.txt", file_content, "text/plain")},
                data={
                    "template_data": json.dumps({"smart_variables": [{"name": "vendor", "type": "text"}]}),
                    "use_two_pass": "true",
                    "provider": "azure"
                }
            )

            # Should not return 422 validation error
            assert response.status_code != 422, f"Got validation error: {response.text}"

    def test_smart_template_calls_two_pass_when_enabled(self, client):
        """Smart template should use two-pass extractor when use_two_pass=true."""
        from io import BytesIO

        test_content = b"Contract between Acme Corp and Beta Inc"
        file_content = BytesIO(test_content)

        with patch('app.routers.enhanced_documents.two_pass_extractor') as mock_two_pass:
            mock_two_pass.extract_two_pass = AsyncMock(return_value={
                "extraction_method": "two_pass_intelligent",
                "extracted_values": {"vendor": {"value": "Acme Corp", "confidence": 0.95}},
                "total_fields_requested": 1,
                "fields_extracted": 1,
                "success_rate": 1.0,
                "processing_time_ms": 120
            })

            response = client.post(
                "/api/enhanced-documents/extract-with-smart-template",
                files={"file": ("contract.txt", file_content, "text/plain")},
                data={
                    "template_data": json.dumps({"smart_variables": [{"name": "vendor", "type": "text"}]}),
                    "use_two_pass": "true"
                }
            )

            # Verify two-pass extractor was called
            mock_two_pass.extract_two_pass.assert_called_once()
            assert response.status_code == 200
