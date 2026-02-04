"""
Integration tests for organization-aware document extraction.

Tests that organization_id is properly passed through the document processing
pipeline to the LLM service for org-specific configuration.

These tests require:
- Document processor running at localhost:8090
- Supabase running with organization_llm_configs table
"""
import pytest
import httpx
import uuid
import json
from typing import Generator


# Test configuration
BASE_URL = "http://localhost:8090"
TIMEOUT = 60.0

# Sample document text for extraction testing
SAMPLE_INVOICE_TEXT = """
INVOICE

Invoice Number: INV-2024-001234
Date: January 15, 2024

Bill To:
John Smith
123 Main Street
New York, NY 10001

From:
Acme Corporation
456 Business Ave
Los Angeles, CA 90001

Items:
- Consulting Services: $2,500.00
- Software License: $750.00

Subtotal: $3,250.00
Tax (8%): $260.00
Total: $3,510.00

Payment Due: February 15, 2024
"""

# Sample template variables for extraction
SAMPLE_TEMPLATE_VARIABLES = [
    {"name": "invoice_number", "type": "text", "description": "Invoice identifier"},
    {"name": "invoice_date", "type": "date", "description": "Date of invoice"},
    {"name": "total_amount", "type": "currency", "description": "Total amount due"},
    {"name": "customer_name", "type": "text", "description": "Customer name"},
    {"name": "vendor_name", "type": "text", "description": "Vendor/company name"},
]


@pytest.fixture
def test_org_id() -> str:
    """Generate a unique test organization ID (valid UUID)"""
    return str(uuid.uuid4())


@pytest.fixture
def real_org_id() -> str:
    """
    Use a real organization ID from the database.
    This is needed because organization_llm_configs has a foreign key to organizations.
    """
    return "3e153efc-9a54-41db-8ad4-4457b9fb05ab"  # Admin's Workspace


@pytest.fixture
def client() -> Generator[httpx.Client, None, None]:
    """HTTP client for API requests"""
    with httpx.Client(base_url=BASE_URL, timeout=TIMEOUT) as client:
        yield client


class TestOrgAwareExtraction:
    """Test that organization_id is passed through extraction endpoints"""

    def test_extract_with_text_accepts_organization_id(self, client: httpx.Client, test_org_id: str):
        """
        The /extract-with-text endpoint should accept organization_id parameter.
        """
        template_data = json.dumps({"smart_variables": SAMPLE_TEMPLATE_VARIABLES})

        params = {
            "text_content": SAMPLE_INVOICE_TEXT,
            "template_data": template_data,
            "confidence_threshold": "0.6",
            "organization_id": test_org_id
        }

        response = client.post(
            "/api/enhanced-documents/extract-with-text",
            params=params
        )

        # Should not fail - org_id parameter should be accepted
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "extracted_data" in data or "status" in data

    def test_extract_with_text_without_organization_id(self, client: httpx.Client):
        """
        The /extract-with-text endpoint should work without organization_id
        (uses system default).
        """
        template_data = json.dumps({"smart_variables": SAMPLE_TEMPLATE_VARIABLES})

        params = {
            "text_content": SAMPLE_INVOICE_TEXT,
            "template_data": template_data,
            "confidence_threshold": "0.6"
            # No organization_id - should use system default
        }

        response = client.post(
            "/api/enhanced-documents/extract-with-text",
            params=params
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "extracted_data" in data or "status" in data

    def test_smart_extract_accepts_organization_id(self, client: httpx.Client, test_org_id: str):
        """
        The /smart-extract endpoint should accept organization_id in request body.
        """
        request_data = {
            "text_content": SAMPLE_INVOICE_TEXT,
            "template_data": {"smart_variables": SAMPLE_TEMPLATE_VARIABLES},
            "confidence_threshold": 0.6,
            "provider": "azure",
            "organization_id": test_org_id
        }

        response = client.post(
            "/api/enhanced-documents/smart-extract",
            json=request_data
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "extracted_values" in data or "extracted_data" in data or "status" in data


class TestOrgConfigIntegration:
    """Test that org-specific LLM configs affect extraction behavior"""

    def test_extraction_with_configured_org(self, client: httpx.Client, real_org_id: str):
        """
        When an organization has a specific LLM config, extraction should use it.
        """
        # First, set up a non_managed tier config for the org
        config_data = {
            "tier": "non_managed",
            "provider_type": "shared",
            "daily_document_limit": 100,
            "monthly_document_limit": 1000
        }

        # Create org config
        config_response = client.put(
            f"/api/models/org-config/{real_org_id}",
            json=config_data
        )

        if config_response.status_code == 503:
            pytest.skip("Database not available for this test")

        # Now perform extraction with that org
        template_data = json.dumps({"smart_variables": SAMPLE_TEMPLATE_VARIABLES})

        params = {
            "text_content": SAMPLE_INVOICE_TEXT,
            "template_data": template_data,
            "confidence_threshold": "0.6",
            "organization_id": real_org_id
        }

        response = client.post(
            "/api/enhanced-documents/extract-with-text",
            params=params
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        # Extraction should succeed
        assert "extracted_data" in data or "status" in data

        # Cleanup: delete the org config
        client.delete(f"/api/models/org-config/{real_org_id}")

    def test_extraction_without_org_config_uses_default(self, client: httpx.Client, test_org_id: str):
        """
        When an organization has no LLM config, extraction should use system default.
        """
        # Use a random org_id that definitely has no config
        template_data = json.dumps({"smart_variables": SAMPLE_TEMPLATE_VARIABLES})

        params = {
            "text_content": SAMPLE_INVOICE_TEXT,
            "template_data": template_data,
            "confidence_threshold": "0.6",
            "organization_id": test_org_id  # Random UUID with no config
        }

        response = client.post(
            "/api/enhanced-documents/extract-with-text",
            params=params
        )

        # Should succeed using system default (Azure OpenAI)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "extracted_data" in data or "status" in data


class TestEndpointOrgIdParameter:
    """Test that all relevant endpoints accept organization_id parameter"""

    def test_evaluate_document_type_accepts_org_id(self, client: httpx.Client, test_org_id: str):
        """
        The /evaluate-document-type endpoint should accept organization_id.
        """
        # Create a simple test file
        files = {"file": ("test.txt", SAMPLE_INVOICE_TEXT.encode(), "text/plain")}
        params = {
            "quick_scan": "true",
            "organization_id": test_org_id
        }

        response = client.post(
            "/api/enhanced-documents/evaluate-document-type",
            files=files,
            params=params
        )

        # Should accept the parameter (may timeout on processing but shouldn't fail on param)
        assert response.status_code in [200, 504], f"Unexpected status: {response.status_code}"

    def test_decide_template_accepts_org_id(self, client: httpx.Client, test_org_id: str):
        """
        The /decide-template endpoint should accept organization_id.
        """
        files = {"file": ("test.txt", SAMPLE_INVOICE_TEXT.encode(), "text/plain")}
        params = {
            "quick_scan": "true",
            "min_match_confidence": "0.7",
            "allow_generation": "true",
            "organization_id": test_org_id
        }

        response = client.post(
            "/api/enhanced-documents/decide-template",
            files=files,
            params=params
        )

        # Should accept the parameter
        assert response.status_code in [200, 504], f"Unexpected status: {response.status_code}"


class TestExtractionQuality:
    """Test that extraction quality is maintained with org-aware processing"""

    def test_extraction_returns_expected_fields(self, client: httpx.Client):
        """
        Extraction should return values for the requested fields.
        """
        template_data = json.dumps({"smart_variables": SAMPLE_TEMPLATE_VARIABLES})

        params = {
            "text_content": SAMPLE_INVOICE_TEXT,
            "template_data": template_data,
            "confidence_threshold": "0.5"  # Lower threshold for testing
        }

        response = client.post(
            "/api/enhanced-documents/extract-with-text",
            params=params
        )

        assert response.status_code == 200

        data = response.json()
        extracted = data.get("extracted_data", {}).get("extracted_values", {})

        # Should have extracted at least some fields
        assert len(extracted) > 0, "Expected at least some extracted fields"

        # Check for expected fields
        field_names = set(extracted.keys())
        expected_fields = {"invoice_number", "total_amount", "customer_name", "vendor_name"}

        # At least some of the expected fields should be extracted
        found_fields = field_names.intersection(expected_fields)
        assert len(found_fields) >= 2, f"Expected at least 2 of {expected_fields}, got {found_fields}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
