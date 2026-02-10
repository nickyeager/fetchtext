"""
Validation test for dead code removal.

Verifies that:
1. Removed endpoints return 404/405
2. Remaining endpoints still exist and accept requests
3. The application starts and serves health checks
"""
import os
import pytest
import httpx

BASE_URL = os.getenv("DOCUMENT_PROCESSOR_URL", "http://localhost:8090")


@pytest.fixture(scope="module")
def client():
    """Create a shared httpx client for all tests in this module."""
    with httpx.Client(base_url=BASE_URL, timeout=10) as c:
        yield c


class TestRemovedEndpointsReturn404:
    """Endpoints that were removed should return 404."""

    def test_test_extraction_removed(self, client):
        resp = client.get("/api/enhanced-documents/test-extraction")
        assert resp.status_code in (404, 405), f"Expected 404/405, got {resp.status_code}"

    def test_enhancement_capabilities_removed(self, client):
        resp = client.get("/api/enhanced-documents/enhancement-capabilities")
        assert resp.status_code in (404, 405), f"Expected 404/405, got {resp.status_code}"

    def test_suggest_template_improvements_removed(self, client):
        resp = client.post("/api/enhanced-documents/suggest-template-improvements")
        assert resp.status_code in (404, 405), f"Expected 404/405, got {resp.status_code}"

    def test_extract_structured_data_removed(self, client):
        resp = client.post("/api/enhanced-documents/extract-structured-data")
        assert resp.status_code in (404, 405), f"Expected 404/405, got {resp.status_code}"

    def test_legacy_documents_upload_removed(self, client):
        resp = client.post("/documents/upload")
        assert resp.status_code in (404, 405), f"Expected 404/405, got {resp.status_code}"

    def test_legacy_documents_status_removed(self, client):
        resp = client.get("/documents/status/test-id")
        assert resp.status_code in (404, 405), f"Expected 404/405, got {resp.status_code}"

    def test_legacy_documents_result_removed(self, client):
        resp = client.get("/documents/result/test-id")
        assert resp.status_code in (404, 405), f"Expected 404/405, got {resp.status_code}"

    def test_legacy_documents_batch_removed(self, client):
        resp = client.post("/documents/batch")
        assert resp.status_code in (404, 405), f"Expected 404/405, got {resp.status_code}"


class TestRemainingEndpointsExist:
    """Endpoints that should still exist return a non-404 status code."""

    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_root(self, client):
        resp = client.get("/")
        assert resp.status_code == 200

    def test_evaluate_document_type_exists(self, client):
        # 422 = missing required file param (expected)
        resp = client.post("/api/enhanced-documents/evaluate-document-type")
        assert resp.status_code == 422

    def test_extract_with_template_exists(self, client):
        resp = client.post("/api/enhanced-documents/extract-with-template")
        assert resp.status_code == 422

    def test_extract_with_smart_template_exists(self, client):
        resp = client.post("/api/enhanced-documents/extract-with-smart-template")
        assert resp.status_code == 422

    def test_smart_extract_exists(self, client):
        resp = client.post("/api/enhanced-documents/smart-extract")
        assert resp.status_code == 422

    def test_decide_template_exists(self, client):
        resp = client.post("/api/enhanced-documents/decide-template")
        assert resp.status_code == 422

    def test_batch_process_with_ai_exists(self, client):
        resp = client.post("/api/enhanced-documents/batch-process-with-ai")
        assert resp.status_code == 422

    def test_analyze_document_exists(self, client):
        resp = client.post("/api/enhanced-documents/analyze-document")
        assert resp.status_code == 422

    def test_supported_categories_exists(self, client):
        resp = client.get("/api/enhanced-documents/supported-categories")
        assert resp.status_code == 200

    def test_save_generated_template_exists(self, client):
        resp = client.post("/api/enhanced-documents/save-generated-template")
        assert resp.status_code == 422

    def test_field_positions_exists(self, client):
        resp = client.post("/api/enhanced-documents/field-positions")
        assert resp.status_code == 422

    def test_extract_with_text_exists(self, client):
        resp = client.post("/api/enhanced-documents/extract-with-text")
        assert resp.status_code == 422
