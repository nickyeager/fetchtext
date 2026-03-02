"""
Integration tests for two-pass extraction strategy.

Tests call the REAL backend /api/enhanced-documents/extract-with-text endpoint
with use_two_pass=true. Uses real Azure OpenAI for LLM extraction.
No mocks. No fakes.
"""
import json

import pytest
import httpx

BACKEND_URL = "http://localhost:8090"

SAMPLE_INVOICE_TEXT = """
INVOICE

From: Acme Corporation
123 Business Street
New York, NY 10001
Tax ID: 12-3456789

Bill To: John Smith
456 Customer Lane
Chicago, IL 60601

Invoice Number: INV-2024-001
Invoice Date: January 15, 2024
Due Date: February 15, 2024

Description                     Qty    Rate      Amount
-------------------------------------------------------
Consulting Services              40   $150.00   $6,000.00
Software License                  1   $500.00     $500.00
Support & Maintenance             1   $200.00     $200.00
-------------------------------------------------------
                              Subtotal:          $6,700.00
                              Tax (8%):            $536.00
                              Total Due:         $7,236.00

Payment Terms: Net 30
"""

INVOICE_TEMPLATE = {
    "smart_variables": [
        {"name": "vendor_name", "type": "text", "description": "Name of the company issuing the invoice"},
        {"name": "invoice_number", "type": "text", "description": "Unique invoice identifier"},
        {"name": "invoice_date", "type": "date", "description": "Date the invoice was issued"},
        {"name": "total_amount", "type": "currency", "description": "Total amount due on the invoice"},
        {"name": "customer_name", "type": "text", "description": "Name of the person being billed"},
    ]
}


@pytest.fixture(scope="module")
def backend():
    """Verify backend is reachable."""
    try:
        resp = httpx.get(f"{BACKEND_URL}/health", timeout=5)
        resp.raise_for_status()
    except Exception as exc:
        pytest.fail(f"Backend not reachable at {BACKEND_URL}: {exc}")


class TestTwoPassExtraction:
    """Test two-pass extraction via the real backend API."""

    def test_two_pass_extracts_fields_from_invoice(self, backend):
        """Two-pass extraction should extract fields from a clear invoice."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/enhanced-documents/extract-with-text",
            params={
                "text_content": SAMPLE_INVOICE_TEXT,
                "template_data": json.dumps(INVOICE_TEMPLATE),
                "confidence_threshold": 0.5,
                "use_two_pass": True,
            },
            timeout=60,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

        data = resp.json()

        # Should have extraction results
        assert "extracted_values" in data or "extracted_data" in data, (
            f"Response missing extraction results: {list(data.keys())}"
        )

        # Get the extracted values (key may vary by endpoint version)
        extracted = data.get("extracted_values") or data.get("extracted_data", {}).get("extracted_values", {})

        # Should have extracted at least some fields
        assert len(extracted) >= 1, f"Expected at least 1 extracted field, got: {extracted}"

    def test_two_pass_returns_metadata(self, backend):
        """Two-pass extraction should include extraction metadata."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/enhanced-documents/extract-with-text",
            params={
                "text_content": SAMPLE_INVOICE_TEXT,
                "template_data": json.dumps(INVOICE_TEMPLATE),
                "confidence_threshold": 0.5,
                "use_two_pass": True,
            },
            timeout=60,
        )
        assert resp.status_code == 200

        data = resp.json()

        # Check for metadata fields that two-pass extractor returns
        # The response may nest these under extracted_data
        result = data if "extraction_method" in data else data.get("extracted_data", data)

        assert "extraction_method" in result, f"Missing extraction_method in: {list(result.keys())}"
        assert result["extraction_method"] == "two_pass_intelligent"

    def test_single_pass_vs_two_pass_both_work(self, backend):
        """Both single-pass and two-pass should return results."""
        template_json = json.dumps(INVOICE_TEMPLATE)

        # Single pass
        resp_single = httpx.post(
            f"{BACKEND_URL}/api/enhanced-documents/extract-with-text",
            params={
                "text_content": SAMPLE_INVOICE_TEXT,
                "template_data": template_json,
                "confidence_threshold": 0.5,
                "use_two_pass": False,
            },
            timeout=60,
        )
        assert resp_single.status_code == 200, f"Single-pass failed: {resp_single.text}"

        # Two pass
        resp_two = httpx.post(
            f"{BACKEND_URL}/api/enhanced-documents/extract-with-text",
            params={
                "text_content": SAMPLE_INVOICE_TEXT,
                "template_data": template_json,
                "confidence_threshold": 0.5,
                "use_two_pass": True,
            },
            timeout=60,
        )
        assert resp_two.status_code == 200, f"Two-pass failed: {resp_two.text}"

        # Both should return extraction results
        data_single = resp_single.json()
        data_two = resp_two.json()

        single_extracted = (
            data_single.get("extracted_values")
            or data_single.get("extracted_data", {}).get("extracted_values", {})
        )
        two_extracted = (
            data_two.get("extracted_values")
            or data_two.get("extracted_data", {}).get("extracted_values", {})
        )

        assert len(single_extracted) >= 1, f"Single-pass extracted nothing: {data_single}"
        assert len(two_extracted) >= 1, f"Two-pass extracted nothing: {data_two}"


class TestTwoPassExtractionEdgeCases:
    """Edge case tests for two-pass extraction via real API."""

    def test_rejects_empty_template_variables(self, backend):
        """Should reject empty template variables."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/enhanced-documents/extract-with-text",
            params={
                "text_content": "Some text",
                "template_data": json.dumps({"smart_variables": []}),
                "use_two_pass": True,
            },
            timeout=10,
        )
        # Empty variables should be rejected with 400
        assert resp.status_code == 400, (
            f"Expected 400 for empty variables, got {resp.status_code}: {resp.text}"
        )

    def test_rejects_invalid_template_json(self, backend):
        """Should reject invalid JSON in template_data."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/enhanced-documents/extract-with-text",
            params={
                "text_content": "Some text",
                "template_data": "not valid json {{{",
                "use_two_pass": True,
            },
            timeout=10,
        )
        assert resp.status_code == 400

    def test_extracts_with_high_confidence_threshold(self, backend):
        """Extraction with high confidence threshold should still succeed."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/enhanced-documents/extract-with-text",
            params={
                "text_content": SAMPLE_INVOICE_TEXT,
                "template_data": json.dumps(INVOICE_TEMPLATE),
                "confidence_threshold": 0.9,
                "use_two_pass": True,
            },
            timeout=60,
        )
        assert resp.status_code == 200, f"High threshold failed: {resp.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
