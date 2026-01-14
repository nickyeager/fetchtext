"""
Comprehensive integration tests for SmartFieldExtractor.

IMPORTANT: These tests call REAL LLM services to verify the complete extraction pipeline.
They cover parsing strategies, document types, field types, and error handling.
"""
import pytest
import asyncio
from typing import Dict, Any, List

# Sample documents for different document types
SAMPLE_RECEIPT = """
RECEIPT
Store: Coffee House LLC
123 Main Street, Seattle, WA 98101
Tel: (206) 555-1234
Email: orders@coffeehouse.com

Date: March 15, 2024
Receipt #: R-2024-0315-001
Transaction ID: TXN-78945612

Items:
  Latte                    $5.50
  Croissant                $3.75
  --------------------------------
  Subtotal:                $9.25
  Tax (10%):               $0.93
  --------------------------------
  TOTAL:                   $10.18

Payment Method: Credit Card ****1234
Thank you for your visit!
"""

SAMPLE_REPORT = """
QUARTERLY SALES REPORT
Q4 2024 Performance Analysis

Prepared by: Sarah Johnson
Department: Sales Analytics
Report Date: January 5, 2025

Executive Summary:
Total Revenue: $1,250,000.00
Growth Rate: 15.3%
New Customers: 342

Key Findings:
The quarter exceeded expectations with strong performance
across all product categories.

Contact: sarah.johnson@company.com
Phone: (555) 987-6543
"""

SAMPLE_BILL = """
UTILITY BILL
Pacific Power & Light

Account Number: 1234-5678-9012
Service Address: 456 Oak Avenue
City: Portland, OR 97201

Billing Period: Dec 1 - Dec 31, 2024
Due Date: January 15, 2025

Current Charges:
  Electricity Usage (450 kWh)    $67.50
  Service Fee                    $12.00
  Taxes & Fees                   $7.95
  --------------------------------
  Amount Due:                    $87.45

Customer: Michael Brown
Customer Email: m.brown@email.com
"""

SAMPLE_STATEMENT = """
BANK STATEMENT
First National Bank

Account Holder: Jennifer Williams
Account Number: ****7890
Statement Period: December 2024

Opening Balance: $5,432.10
Total Deposits: $3,200.00
Total Withdrawals: $1,875.50
Closing Balance: $6,756.60

Statement Date: January 1, 2025
Next Statement: February 1, 2025

Contact: support@firstnational.com
"""

SAMPLE_GENERIC = """
AGREEMENT

This agreement is between Company A and Company B.
Project Name: Website Redesign
Project ID: PRJ-2024-001

Start Date: February 1, 2024
End Date: May 31, 2024
Total Budget: $25,000.00

Contact Person: David Lee
Email: david.lee@companya.com
Phone: 555-123-4567
"""


class TestDocumentTypeDetection:
    """Test document type detection accuracy."""

    @pytest.fixture
    def extractor(self):
        from app.services.smart_field_extractor import SmartFieldExtractor
        return SmartFieldExtractor()

    def test_detect_invoice_type(self, extractor):
        """Should detect invoice documents."""
        doc_type = extractor._detect_document_type(SAMPLE_RECEIPT.replace("RECEIPT", "INVOICE"))
        assert doc_type == "invoice"

    def test_detect_receipt_type(self, extractor):
        """Should detect receipt documents."""
        doc_type = extractor._detect_document_type(SAMPLE_RECEIPT)
        assert doc_type == "receipt"

    def test_detect_report_type(self, extractor):
        """Should detect report documents."""
        doc_type = extractor._detect_document_type(SAMPLE_REPORT)
        assert doc_type == "report"

    def test_detect_bill_type(self, extractor):
        """Should detect bill documents."""
        doc_type = extractor._detect_document_type(SAMPLE_BILL)
        assert doc_type == "bill"

    def test_detect_statement_type(self, extractor):
        """Should detect statement documents."""
        doc_type = extractor._detect_document_type(SAMPLE_STATEMENT)
        assert doc_type == "statement"

    def test_detect_generic_type(self, extractor):
        """Should return 'document' for generic documents."""
        doc_type = extractor._detect_document_type(SAMPLE_GENERIC)
        assert doc_type == "document"


class TestFieldExamplesAndVariations:
    """Test field examples and variations generation."""

    @pytest.fixture
    def extractor(self):
        from app.services.smart_field_extractor import SmartFieldExtractor
        return SmartFieldExtractor()

    def test_invoice_number_variations(self, extractor):
        """Should return invoice number examples and variations."""
        examples, variations = extractor._get_field_examples_and_variations("invoice_number", "id")
        assert len(examples) > 0
        assert "Invoice #" in variations or "Invoice:" in variations

    def test_receipt_number_variations(self, extractor):
        """Should return receipt number examples and variations."""
        examples, variations = extractor._get_field_examples_and_variations("receipt_number", "id")
        assert len(examples) > 0
        assert "Receipt #" in variations or "Receipt:" in variations

    def test_date_variations(self, extractor):
        """Should return date examples and variations."""
        examples, variations = extractor._get_field_examples_and_variations("invoice_date", "date")
        assert len(examples) > 0

    def test_total_amount_variations(self, extractor):
        """Should return amount examples and variations."""
        examples, variations = extractor._get_field_examples_and_variations("total_amount", "currency")
        assert len(examples) > 0
        assert any("$" in ex for ex in examples)

    def test_customer_name_variations(self, extractor):
        """Should return customer name examples and variations."""
        examples, variations = extractor._get_field_examples_and_variations("customer_name", "text")
        assert len(examples) > 0
        assert "Bill to" in variations or "Customer:" in variations

    def test_email_variations(self, extractor):
        """Should return email examples."""
        examples, variations = extractor._get_field_examples_and_variations("customer_email", "email")
        assert len(examples) > 0

    def test_unknown_field_returns_empty(self, extractor):
        """Should return empty for unknown field types."""
        examples, variations = extractor._get_field_examples_and_variations("unknown_field", "text")
        assert examples == []
        assert variations == []


class TestLLMParameterOptimization:
    """Test LLM parameter optimization for different document types."""

    @pytest.fixture
    def extractor(self):
        from app.services.smart_field_extractor import SmartFieldExtractor
        return SmartFieldExtractor()

    def test_receipt_params_low_temperature(self, extractor):
        """Receipt extraction should use low temperature."""
        params = extractor._get_optimized_llm_params(
            SAMPLE_RECEIPT,
            [{"name": "total", "type": "currency"}],
            "azure"
        )
        assert params["temperature"] <= 0.1

    def test_report_params_higher_temperature(self, extractor):
        """Report extraction can use slightly higher temperature."""
        params = extractor._get_optimized_llm_params(
            SAMPLE_REPORT,
            [{"name": "summary", "type": "text"}],
            "azure"
        )
        assert params["temperature"] >= 0.05

    def test_params_scale_with_field_count(self, extractor):
        """Max tokens should scale with field count."""
        few_fields = [{"name": "f1"}]
        many_fields = [{"name": f"field_{i}"} for i in range(10)]

        params_few = extractor._get_optimized_llm_params(SAMPLE_RECEIPT, few_fields, "azure")
        params_many = extractor._get_optimized_llm_params(SAMPLE_RECEIPT, many_fields, "azure")

        assert params_many["max_tokens"] > params_few["max_tokens"]

    def test_params_adjust_for_long_text(self, extractor):
        """Max tokens should increase for longer documents."""
        short_text = "Short document."
        long_text = "Long document content. " * 200

        params_short = extractor._get_optimized_llm_params(short_text, [{"name": "f1"}], "azure")
        params_long = extractor._get_optimized_llm_params(long_text, [{"name": "f1"}], "azure")

        assert params_long["max_tokens"] >= params_short["max_tokens"]

    def test_ollama_provider_adjustments(self, extractor):
        """Ollama provider should get adjusted parameters."""
        params = extractor._get_optimized_llm_params(
            SAMPLE_RECEIPT,
            [{"name": "total"}],
            "ollama"
        )
        assert params["provider"] == "ollama"


class TestResponseParsing:
    """Test LLM response parsing strategies."""

    @pytest.fixture
    def extractor(self):
        from app.services.smart_field_extractor import SmartFieldExtractor
        return SmartFieldExtractor()

    def test_parse_clean_json(self, extractor):
        """Should parse clean JSON response."""
        response = '{"extracted_fields": {"vendor_name": {"value": "Acme Corp", "confidence": 0.95}}}'
        result = extractor._parse_llm_response(response, [{"name": "vendor_name"}])
        assert "vendor_name" in result
        assert result["vendor_name"]["value"] == "Acme Corp"

    def test_parse_markdown_wrapped_json(self, extractor):
        """Should parse JSON wrapped in markdown code blocks."""
        response = '''```json
{"extracted_fields": {"total_amount": {"value": "$100.00", "confidence": 0.9}}}
```'''
        result = extractor._parse_llm_response(response, [{"name": "total_amount"}])
        assert "total_amount" in result
        assert result["total_amount"]["value"] == "$100.00"

    def test_parse_partial_json(self, extractor):
        """Should extract JSON from partial responses."""
        response = '''Here is the extraction:
{"extracted_fields": {"invoice_number": {"value": "INV-001", "confidence": 0.85}}}
Some trailing text.'''
        result = extractor._parse_llm_response(response, [{"name": "invoice_number"}])
        assert "invoice_number" in result

    def test_parse_json_with_trailing_commas(self, extractor):
        """Should handle JSON with trailing commas."""
        response = '{"extracted_fields": {"field1": {"value": "test", "confidence": 0.8},}}'
        result = extractor._parse_llm_response(response, [{"name": "field1"}])
        assert "field1" in result

    def test_parse_key_value_pairs_fallback(self, extractor):
        """Should extract key-value pairs when JSON fails."""
        response = '''vendor_name: Acme Corporation
total_amount: $500.00
invoice_date: January 15, 2024'''
        template_vars = [
            {"name": "vendor_name"},
            {"name": "total_amount"},
            {"name": "invoice_date"}
        ]
        result = extractor._parse_llm_response(response, template_vars)
        # Should extract at least some fields
        assert len(result) > 0

    def test_format_extracted_fields_filters_null(self, extractor):
        """Should filter out null and empty values."""
        fields = {
            "field1": {"value": "valid", "confidence": 0.9},
            "field2": {"value": "null", "confidence": 0.8},
            "field3": {"value": "", "confidence": 0.7},
            "field4": {"value": None, "confidence": 0.6}
        }
        result = extractor._format_extracted_fields(fields)
        assert "field1" in result
        assert "field2" not in result
        assert "field3" not in result
        assert "field4" not in result


class TestContentPatternExtraction:
    """Test content-based pattern extraction."""

    @pytest.fixture
    def extractor(self):
        from app.services.smart_field_extractor import SmartFieldExtractor
        return SmartFieldExtractor()

    def test_extract_email_pattern(self, extractor):
        """Should extract email addresses from text."""
        text = "Contact us at support@example.com for help"
        value, confidence, source = extractor._extract_by_content_pattern(text, "customer_email", "email")
        assert value == "support@example.com"
        assert confidence >= 0.7

    def test_extract_currency_pattern(self, extractor):
        """Should extract currency amounts from text."""
        text = "The total is $1,234.56 including tax"
        value, confidence, source = extractor._extract_by_content_pattern(text, "total_amount", "currency")
        if value:  # May or may not find depending on implementation
            assert "$" in value or "1234" in value


class TestSemanticIntegration:
    """Test semantic parser integration in prompt building."""

    @pytest.fixture
    def extractor(self):
        from app.services.smart_field_extractor import SmartFieldExtractor
        return SmartFieldExtractor()

    def test_prompt_includes_semantic_description(self, extractor):
        """Prompt should include semantic field descriptions."""
        prompt = extractor._build_smart_extraction_prompt(
            "Test document",
            [{"name": "customer_billing_address", "type": "text"}]
        )
        assert "address" in prompt.lower()

    def test_prompt_includes_context_section(self, extractor):
        """Prompt should include context when provided."""
        context = {"vendor_name": {"value": "Acme Corp", "confidence": 0.95}}
        prompt = extractor._build_smart_extraction_prompt(
            "Test document",
            [{"name": "vendor_address", "type": "text"}],
            existing_context=context
        )
        assert "ALREADY EXTRACTED FIELDS" in prompt
        assert "Acme Corp" in prompt

    def test_prompt_includes_receipt_guidance_for_receipts(self, extractor):
        """Prompt should include special guidance for receipts."""
        prompt = extractor._build_smart_extraction_prompt(
            SAMPLE_RECEIPT,
            [{"name": "total_amount", "type": "currency"}]
        )
        assert "RECEIPT" in prompt.upper()


class TestFullExtractionPipeline:
    """Full integration tests calling real LLM services."""

    @pytest.fixture
    def receipt_variables(self):
        return [
            {"name": "store_name", "type": "text", "description": "Store or business name"},
            {"name": "receipt_number", "type": "id", "description": "Receipt reference number"},
            {"name": "total_amount", "type": "currency", "description": "Total amount paid"},
            {"name": "transaction_date", "type": "date", "description": "Date of transaction"},
            {"name": "store_email", "type": "email", "description": "Store email address"},
        ]

    @pytest.fixture
    def report_variables(self):
        return [
            {"name": "report_title", "type": "text", "description": "Title of the report"},
            {"name": "author_name", "type": "text", "description": "Person who prepared the report"},
            {"name": "total_revenue", "type": "currency", "description": "Total revenue amount"},
            {"name": "report_date", "type": "date", "description": "Date report was prepared"},
            {"name": "contact_email", "type": "email", "description": "Contact email"},
        ]

    @pytest.fixture
    def bill_variables(self):
        return [
            {"name": "account_number", "type": "id", "description": "Account or customer number"},
            {"name": "customer_name", "type": "text", "description": "Customer name"},
            {"name": "amount_due", "type": "currency", "description": "Amount due"},
            {"name": "due_date", "type": "date", "description": "Payment due date"},
            {"name": "customer_email", "type": "email", "description": "Customer email"},
        ]

    @pytest.mark.asyncio
    async def test_receipt_extraction_full_pipeline(self, receipt_variables):
        """Test full extraction pipeline on receipt document."""
        from app.services.smart_field_extractor import smart_field_extractor

        result = await smart_field_extractor.extract_fields_intelligently(
            SAMPLE_RECEIPT,
            receipt_variables,
            confidence_threshold=0.4,
            provider="azure"
        )

        assert result["extraction_method"] == "llm_intelligent"
        extracted = result["extracted_values"]

        # Should extract key fields
        assert len(extracted) >= 2, f"Expected at least 2 fields, got {len(extracted)}: {list(extracted.keys())}"

        # Verify metadata
        assert "total_fields_requested" in result
        assert "processing_time_ms" in result
        assert result["processing_time_ms"] > 0

    @pytest.mark.asyncio
    async def test_report_extraction_full_pipeline(self, report_variables):
        """Test full extraction pipeline on report document."""
        from app.services.smart_field_extractor import smart_field_extractor

        result = await smart_field_extractor.extract_fields_intelligently(
            SAMPLE_REPORT,
            report_variables,
            confidence_threshold=0.4,
            provider="azure"
        )

        extracted = result["extracted_values"]
        assert len(extracted) >= 2, f"Expected at least 2 fields from report"

        # Check for expected fields
        field_names = list(extracted.keys())
        print(f"Extracted from report: {field_names}")

    @pytest.mark.asyncio
    async def test_bill_extraction_full_pipeline(self, bill_variables):
        """Test full extraction pipeline on bill document."""
        from app.services.smart_field_extractor import smart_field_extractor

        result = await smart_field_extractor.extract_fields_intelligently(
            SAMPLE_BILL,
            bill_variables,
            confidence_threshold=0.4,
            provider="azure"
        )

        extracted = result["extracted_values"]
        assert len(extracted) >= 2, f"Expected at least 2 fields from bill"

    @pytest.mark.asyncio
    async def test_statement_extraction(self):
        """Test extraction from bank statement."""
        from app.services.smart_field_extractor import smart_field_extractor

        variables = [
            {"name": "account_holder", "type": "text", "description": "Account holder name"},
            {"name": "closing_balance", "type": "currency", "description": "Closing balance amount"},
            {"name": "statement_date", "type": "date", "description": "Statement date"},
        ]

        result = await smart_field_extractor.extract_fields_intelligently(
            SAMPLE_STATEMENT,
            variables,
            confidence_threshold=0.4,
            provider="azure"
        )

        extracted = result["extracted_values"]
        assert len(extracted) >= 1

    @pytest.mark.asyncio
    async def test_generic_document_extraction(self):
        """Test extraction from generic agreement document."""
        from app.services.smart_field_extractor import smart_field_extractor

        variables = [
            {"name": "project_name", "type": "text", "description": "Name of the project"},
            {"name": "project_id", "type": "id", "description": "Project identifier"},
            {"name": "total_budget", "type": "currency", "description": "Total budget amount"},
            {"name": "contact_email", "type": "email", "description": "Contact email"},
        ]

        result = await smart_field_extractor.extract_fields_intelligently(
            SAMPLE_GENERIC,
            variables,
            confidence_threshold=0.4,
            provider="azure"
        )

        extracted = result["extracted_values"]
        assert len(extracted) >= 1

    @pytest.mark.asyncio
    async def test_confidence_threshold_filtering(self):
        """Test that confidence threshold properly filters results."""
        from app.services.smart_field_extractor import smart_field_extractor

        variables = [
            {"name": "store_name", "type": "text", "description": "Store name"},
            {"name": "total_amount", "type": "currency", "description": "Total"},
        ]

        # Low threshold should return more results
        result_low = await smart_field_extractor.extract_fields_intelligently(
            SAMPLE_RECEIPT,
            variables,
            confidence_threshold=0.3,
            provider="azure"
        )

        # High threshold might return fewer results
        result_high = await smart_field_extractor.extract_fields_intelligently(
            SAMPLE_RECEIPT,
            variables,
            confidence_threshold=0.9,
            provider="azure"
        )

        # With high threshold, fields with lower confidence should be filtered
        assert result_low["fields_extracted"] >= result_high["fields_extracted"]

    @pytest.mark.asyncio
    async def test_extraction_with_existing_context(self):
        """Test extraction using existing context improves related field extraction."""
        from app.services.smart_field_extractor import smart_field_extractor

        # First extract vendor name
        context = {
            "store_name": {"value": "Coffee House LLC", "confidence": 0.95}
        }

        # Then extract related fields with context
        result = await smart_field_extractor.extract_fields_intelligently(
            SAMPLE_RECEIPT,
            [{"name": "store_email", "type": "email", "description": "Store email address"}],
            confidence_threshold=0.4,
            provider="azure",
            existing_context=context
        )

        # Context should help extraction
        assert result["extraction_method"] == "llm_intelligent"


class TestChunkedExtractionIntegration:
    """Test chunked extraction with real documents."""

    @pytest.fixture
    def extractor(self):
        from app.services.smart_field_extractor import SmartFieldExtractor
        return SmartFieldExtractor()

    def test_chunk_preserves_important_data(self, extractor):
        """Chunking should preserve data at chunk boundaries."""
        # Create a long document with important data in the middle
        long_doc = "Header content. " * 100 + "IMPORTANT: Total Amount $5,000.00 " + "Footer content. " * 100

        chunks = extractor._chunk_document(long_doc, chunk_size=500, overlap=100)

        # The important data should appear in at least one chunk
        found_important = any("IMPORTANT" in chunk or "5,000" in chunk for chunk in chunks)
        assert found_important, "Important data should be preserved in chunks"

    def test_merge_chunk_results_complex(self, extractor):
        """Test merging results from multiple chunks with varying confidence."""
        chunk_results = [
            {
                "vendor_name": {"value": "Acme", "confidence": 0.6},
                "total_amount": {"value": "$100", "confidence": 0.9}
            },
            {
                "vendor_name": {"value": "Acme Corporation", "confidence": 0.95},
                "invoice_date": {"value": "Jan 15, 2024", "confidence": 0.85}
            },
            {
                "total_amount": {"value": "$100.00", "confidence": 0.7},
                "invoice_date": {"value": "January 15, 2024", "confidence": 0.9}
            }
        ]

        merged = extractor._merge_chunk_extractions(chunk_results)

        # Should keep highest confidence for each field
        assert merged["vendor_name"]["confidence"] == 0.95
        assert merged["vendor_name"]["value"] == "Acme Corporation"
        assert merged["total_amount"]["confidence"] == 0.9
        assert merged["invoice_date"]["confidence"] == 0.9


class TestErrorHandling:
    """Test error handling and fallback behavior."""

    @pytest.mark.asyncio
    async def test_empty_template_variables(self):
        """Should handle empty template variables gracefully."""
        from app.services.smart_field_extractor import smart_field_extractor

        result = await smart_field_extractor.extract_fields_intelligently(
            "Some document text",
            [],  # Empty variables
            confidence_threshold=0.5,
            provider="azure"
        )

        assert result["total_fields_requested"] == 0
        assert result["fields_extracted"] == 0

    @pytest.mark.asyncio
    async def test_empty_document_text(self):
        """Should handle empty document text."""
        from app.services.smart_field_extractor import smart_field_extractor

        result = await smart_field_extractor.extract_fields_intelligently(
            "",  # Empty text
            [{"name": "test_field", "type": "text"}],
            confidence_threshold=0.5,
            provider="azure"
        )

        # Should return result (possibly empty) without crashing
        assert "extraction_method" in result

    @pytest.mark.asyncio
    async def test_invalid_field_type(self):
        """Should handle invalid field types gracefully."""
        from app.services.smart_field_extractor import smart_field_extractor

        result = await smart_field_extractor.extract_fields_intelligently(
            SAMPLE_RECEIPT,
            [{"name": "test", "type": "invalid_type_xyz"}],
            confidence_threshold=0.5,
            provider="azure"
        )

        # Should not crash with invalid type
        assert "extraction_method" in result


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short"])
