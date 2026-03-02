"""Tests that upload endpoints require authentication (except analyze-document)."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_analyze_document_does_not_require_auth():
    """The demo endpoint should NOT require a JWT."""
    # Even with no auth header, it should not return 401
    # (it may return 400 for missing file, which is fine)
    response = client.post("/api/enhanced-documents/analyze-document")
    assert response.status_code != 401, "analyze-document should be public"


def test_process_document_stream_requires_auth():
    """The SSE stream endpoint should require a JWT."""
    response = client.post("/api/enhanced-documents/process-document-stream")
    assert response.status_code == 401


def test_save_generated_template_requires_auth():
    """save-generated-template should require a JWT."""
    response = client.post("/api/enhanced-documents/save-generated-template")
    assert response.status_code == 401


def test_batch_process_requires_auth():
    """batch-process-with-ai should require a JWT."""
    response = client.post("/api/enhanced-documents/batch-process-with-ai")
    assert response.status_code == 401


def test_evaluate_document_type_requires_auth():
    """evaluate-document-type should require a JWT."""
    response = client.post("/api/enhanced-documents/evaluate-document-type")
    assert response.status_code == 401


def test_smart_extract_requires_auth():
    """smart-extract should require a JWT."""
    response = client.post("/api/enhanced-documents/smart-extract")
    assert response.status_code == 401
