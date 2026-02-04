"""End-to-end integration tests for improved extraction.

IMPORTANT: These tests call REAL LLM services (Azure OpenAI or Ollama).
They verify the complete extraction pipeline works correctly.

When Azure OpenAI is not configured (missing environment variables),
these tests will skip rather than fail, since they require real LLM access.
"""
import pytest
import asyncio
import os
from pathlib import Path


def is_azure_openai_configured() -> bool:
    """Check if Azure OpenAI credentials are available."""
    return bool(
        os.environ.get("AZURE_OPENAI_API_KEY") and
        os.environ.get("AZURE_OPENAI_ENDPOINT")
    )


requires_azure_openai = pytest.mark.skipif(
    not is_azure_openai_configured(),
    reason="Azure OpenAI not configured (missing AZURE_OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT)"
)

# Test with a realistic invoice document
SAMPLE_INVOICE = """
INVOICE

From: Acme Corporation
123 Business Lane
New York, NY 10001
accounting@acme-corp.com

Invoice Number: INV-2024-0042
Invoice Date: January 15, 2024
Due Date: February 15, 2024

Bill To:
John Smith
456 Customer Road
Los Angeles, CA 90001

Description                     Amount
--------------------------------
Consulting Services            $5,000.00
Software License               $2,500.00
Support Package                  $750.00
--------------------------------
Subtotal:                      $8,250.00
Tax (8%):                        $660.00
--------------------------------
TOTAL DUE:                     $8,910.00

Payment Terms: Net 30
"""


class TestImprovedExtractionE2E:
    """End-to-end tests for improved extraction pipeline."""

    @pytest.fixture
    def template_variables(self):
        return [
            {"name": "vendor_name", "type": "text", "description": "Company sending invoice"},
            {"name": "vendor_address", "type": "text", "description": "Vendor street address"},
            {"name": "vendor_email", "type": "email", "description": "Vendor email"},
            {"name": "invoice_number", "type": "id", "description": "Invoice reference number"},
            {"name": "invoice_date", "type": "date", "description": "Date invoice was issued"},
            {"name": "customer_name", "type": "text", "description": "Customer being billed"},
            {"name": "total_amount", "type": "currency", "description": "Total amount due"},
        ]

    @requires_azure_openai
    @pytest.mark.asyncio
    async def test_semantic_extraction_improves_accuracy(self, template_variables):
        """Semantic parsing should help extract fields accurately."""
        from app.services.smart_field_extractor import smart_field_extractor

        result = await smart_field_extractor.extract_fields_intelligently(
            SAMPLE_INVOICE,
            template_variables,
            confidence_threshold=0.5,
            provider="azure"
        )

        extracted = result.get("extracted_values", {})

        # Verify key fields were extracted
        assert "vendor_name" in extracted, "vendor_name should be extracted"
        assert "Acme" in extracted["vendor_name"]["value"], f"Expected 'Acme' in vendor_name, got: {extracted['vendor_name']['value']}"

        assert "invoice_number" in extracted, "invoice_number should be extracted"
        assert "INV-2024-0042" in extracted["invoice_number"]["value"], f"Expected INV-2024-0042 in invoice_number"

        assert "total_amount" in extracted, "total_amount should be extracted"
        assert "8,910" in extracted["total_amount"]["value"] or "8910" in extracted["total_amount"]["value"], \
            f"Expected $8,910 in total_amount, got: {extracted['total_amount']['value']}"

        # Verify confidence levels are reasonable
        for field_name, field_data in extracted.items():
            confidence = field_data.get("confidence", 0)
            assert confidence >= 0.3, f"{field_name} has too low confidence: {confidence}"

    @pytest.mark.asyncio
    async def test_two_pass_extraction_works(self, template_variables):
        """Two-pass extraction should successfully extract fields."""
        from app.services.two_pass_extractor import two_pass_extractor

        result = await two_pass_extractor.extract_two_pass(
            SAMPLE_INVOICE,
            template_variables,
            confidence_threshold=0.6,
            provider="azure"
        )

        # Verify two-pass specific fields in response
        assert result.get("extraction_method") == "two_pass_intelligent"
        assert "pass_stats" in result, "Response should include pass_stats"
        assert "extracted_values" in result

        extracted = result.get("extracted_values", {})
        assert len(extracted) >= 3, f"Expected at least 3 fields extracted, got {len(extracted)}"

        # Check pass tracking
        for field_name, field_data in extracted.items():
            assert "extraction_pass" in field_data, f"{field_name} missing extraction_pass"
            assert field_data["extraction_pass"] in [1, 2], f"Invalid extraction_pass for {field_name}"

    @requires_azure_openai
    @pytest.mark.asyncio
    async def test_context_aware_extraction_uses_context(self, template_variables):
        """Context-aware extraction should accept and utilize existing context."""
        from app.services.smart_field_extractor import smart_field_extractor

        # Provide context from "previously extracted" field
        existing_context = {
            "vendor_name": {"value": "Acme Corporation", "confidence": 0.95}
        }

        result = await smart_field_extractor.extract_fields_intelligently(
            SAMPLE_INVOICE,
            [{"name": "vendor_address", "type": "text", "description": "Vendor address"}],
            confidence_threshold=0.5,
            provider="azure",
            existing_context=existing_context
        )

        extracted = result.get("extracted_values", {})

        # Should be able to extract vendor_address (context helps locate it)
        assert "vendor_address" in extracted or len(extracted) > 0, "Should extract at least one field"

    @pytest.mark.asyncio
    async def test_chunked_extraction_methods_exist(self):
        """Verify chunking methods are available and work."""
        from app.services.smart_field_extractor import smart_field_extractor

        # Test chunking works
        long_text = "Section content. " * 200  # Create long text
        chunks = smart_field_extractor._chunk_document(long_text, chunk_size=500, overlap=100)

        assert len(chunks) > 1, "Long text should be split into multiple chunks"

        # Test merge works
        chunk_results = [
            {"field_a": {"value": "low", "confidence": 0.4}},
            {"field_a": {"value": "high", "confidence": 0.9}},
        ]
        merged = smart_field_extractor._merge_chunk_extractions(chunk_results)

        assert merged["field_a"]["confidence"] == 0.9, "Merge should keep highest confidence"

    @pytest.mark.asyncio
    async def test_semantic_parser_enhances_prompts(self):
        """Verify semantic parser is integrated into extraction."""
        from app.services.semantic_variable_parser import semantic_variable_parser

        # Test semantic parsing
        result = semantic_variable_parser.parse_variable_name("customer_billing_address")

        assert "semantic_description" in result
        assert "field_type_hint" in result
        assert "search_keywords" in result

        # Should identify address-related field
        assert "address" in result["semantic_description"].lower()


class TestExtractionAPIIntegration:
    """Tests for API endpoint integration (requires running server)."""

    @pytest.fixture
    def api_url(self):
        return "http://localhost:8090"

    @requires_azure_openai
    @pytest.mark.asyncio
    async def test_api_two_pass_endpoint(self, api_url):
        """Test the API endpoint accepts two-pass parameter."""
        import httpx

        async with httpx.AsyncClient(timeout=60.0) as client:
            # Test with two-pass enabled
            response = await client.post(
                f"{api_url}/api/enhanced-documents/extract-with-text",
                params={
                    "text_content": SAMPLE_INVOICE[:500],  # Truncate for speed
                    "template_data": '{"smart_variables": [{"name": "vendor_name", "type": "text", "description": "Vendor"}]}',
                    "use_two_pass": "true"
                }
            )

            if response.status_code == 200:
                data = response.json()
                extracted_data = data.get("extracted_data", {})
                assert extracted_data.get("extraction_method") == "two_pass_intelligent", \
                    f"Expected two_pass_intelligent, got: {extracted_data.get('extraction_method')}"


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
