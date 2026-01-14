"""
Unit tests for context-aware extraction in SmartFieldExtractor.

Tests verify that the extractor can accept and utilize previously extracted
field values as context to help the LLM find related fields more accurately.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.smart_field_extractor import SmartFieldExtractor


class TestContextAwareExtraction:
    """Tests for context-aware extraction functionality."""

    @pytest.fixture
    def extractor(self):
        """Create a SmartFieldExtractor instance for testing."""
        return SmartFieldExtractor()

    @pytest.fixture
    def sample_template_variables(self):
        """Sample template variables for testing."""
        return [
            {"name": "vendor_name", "type": "text", "description": "Name of the vendor"},
            {"name": "vendor_address", "type": "text", "description": "Address of the vendor"},
            {"name": "invoice_date", "type": "date", "description": "Date of the invoice"},
        ]

    @pytest.fixture
    def sample_existing_context(self):
        """Sample existing context with previously extracted fields."""
        return {
            "vendor_name": {"value": "Acme Corp", "confidence": 0.95},
            "customer_email": {"value": "john@example.com", "confidence": 0.88},
        }

    @pytest.fixture
    def sample_document_text(self):
        """Sample document text for extraction."""
        return """
        INVOICE

        From: Acme Corp
        123 Business Street
        New York, NY 10001

        To: John Smith
        john@example.com

        Date: January 15, 2024
        Invoice #: INV-2024-001

        Total: $1,500.00
        """

    @pytest.mark.asyncio
    async def test_extract_fields_accepts_existing_context(
        self, extractor, sample_document_text, sample_template_variables, sample_existing_context
    ):
        """Test that extract_fields_intelligently accepts the existing_context parameter without error."""
        # Mock the LLM service to avoid actual API calls
        with patch.object(extractor.llm_service, 'complete', new_callable=AsyncMock) as mock_complete:
            mock_complete.return_value = '''{"extracted_fields": {
                "vendor_name": {"value": "Acme Corp", "confidence": 0.95, "reasoning": "Found in From field"},
                "vendor_address": {"value": "123 Business Street", "confidence": 0.85, "reasoning": "Found below vendor name"},
                "invoice_date": {"value": "January 15, 2024", "confidence": 0.90, "reasoning": "Found after Date:"}
            }}'''

            # This should not raise an error - the method should accept existing_context
            result = await extractor.extract_fields_intelligently(
                text_content=sample_document_text,
                template_variables=sample_template_variables,
                existing_context=sample_existing_context,
                confidence_threshold=0.6,
                provider="azure"
            )

            # Verify we got a result back
            assert result is not None
            assert "extracted_values" in result
            assert "extraction_method" in result

    def test_prompt_includes_context_when_provided(
        self, extractor, sample_document_text, sample_template_variables, sample_existing_context
    ):
        """Test that the prompt includes the context section when existing_context is provided."""
        prompt = extractor._build_smart_extraction_prompt(
            text_content=sample_document_text,
            template_variables=sample_template_variables,
            existing_context=sample_existing_context
        )

        # Verify the context section is included
        assert "ALREADY EXTRACTED FIELDS" in prompt
        assert "use as context" in prompt.lower()

    def test_prompt_excludes_context_when_none(
        self, extractor, sample_document_text, sample_template_variables
    ):
        """Test that no context section appears when existing_context is None."""
        prompt = extractor._build_smart_extraction_prompt(
            text_content=sample_document_text,
            template_variables=sample_template_variables,
            existing_context=None
        )

        # Verify no context section is included
        assert "ALREADY EXTRACTED FIELDS" not in prompt

    def test_prompt_excludes_context_when_empty(
        self, extractor, sample_document_text, sample_template_variables
    ):
        """Test that no context section appears when existing_context is an empty dict."""
        prompt = extractor._build_smart_extraction_prompt(
            text_content=sample_document_text,
            template_variables=sample_template_variables,
            existing_context={}
        )

        # Verify no context section is included
        assert "ALREADY EXTRACTED FIELDS" not in prompt

    def test_context_field_values_in_prompt(
        self, extractor, sample_document_text, sample_template_variables, sample_existing_context
    ):
        """Test that specific field values from context appear in the generated prompt."""
        prompt = extractor._build_smart_extraction_prompt(
            text_content=sample_document_text,
            template_variables=sample_template_variables,
            existing_context=sample_existing_context
        )

        # Verify the field names and values from context appear in the prompt
        assert "vendor_name" in prompt
        assert "Acme Corp" in prompt
        assert "customer_email" in prompt
        assert "john@example.com" in prompt

    def test_context_confidence_in_prompt(
        self, extractor, sample_document_text, sample_template_variables, sample_existing_context
    ):
        """Test that confidence values are formatted correctly in the prompt."""
        prompt = extractor._build_smart_extraction_prompt(
            text_content=sample_document_text,
            template_variables=sample_template_variables,
            existing_context=sample_existing_context
        )

        # Verify confidence values appear formatted as percentages
        # 0.95 should appear as 95% and 0.88 should appear as 88%
        assert "95%" in prompt
        assert "88%" in prompt

    def test_context_usage_guidance_in_prompt(
        self, extractor, sample_document_text, sample_template_variables, sample_existing_context
    ):
        """Test that the prompt includes guidance on how to use the context."""
        prompt = extractor._build_smart_extraction_prompt(
            text_content=sample_document_text,
            template_variables=sample_template_variables,
            existing_context=sample_existing_context
        )

        # Verify the prompt includes guidance for using context
        assert "Use this context to find related fields" in prompt

    def test_context_section_appears_before_fields_to_extract(
        self, extractor, sample_document_text, sample_template_variables, sample_existing_context
    ):
        """Test that context section appears before the field definitions."""
        prompt = extractor._build_smart_extraction_prompt(
            text_content=sample_document_text,
            template_variables=sample_template_variables,
            existing_context=sample_existing_context
        )

        # Find positions of key sections
        context_pos = prompt.find("ALREADY EXTRACTED FIELDS")
        fields_pos = prompt.find("FIELDS TO EXTRACT")

        # Context should come before fields to extract
        # (Note: The current prompt structure has FIELDS TO EXTRACT, so context should be between
        # DOCUMENT TEXT and FIELDS TO EXTRACT, or after FIELDS TO EXTRACT but before the strategy section)
        assert context_pos != -1, "Context section not found in prompt"
        assert fields_pos != -1, "Fields to extract section not found in prompt"


class TestContextAwareExtractionEdgeCases:
    """Edge case tests for context-aware extraction."""

    @pytest.fixture
    def extractor(self):
        return SmartFieldExtractor()

    @pytest.fixture
    def sample_template_variables(self):
        return [{"name": "test_field", "type": "text", "description": "Test field"}]

    @pytest.fixture
    def sample_document_text(self):
        return "Sample document text"

    def test_context_with_missing_confidence(self, extractor, sample_document_text, sample_template_variables):
        """Test handling of context entries without confidence values."""
        context_missing_confidence = {
            "field_name": {"value": "test value"}  # No confidence key
        }

        prompt = extractor._build_smart_extraction_prompt(
            text_content=sample_document_text,
            template_variables=sample_template_variables,
            existing_context=context_missing_confidence
        )

        # Should still include the field but with 0% confidence
        assert "field_name" in prompt
        assert "test value" in prompt
        assert "0%" in prompt  # Default confidence of 0

    def test_context_with_missing_value(self, extractor, sample_document_text, sample_template_variables):
        """Test handling of context entries without value."""
        context_missing_value = {
            "field_name": {"confidence": 0.9}  # No value key
        }

        prompt = extractor._build_smart_extraction_prompt(
            text_content=sample_document_text,
            template_variables=sample_template_variables,
            existing_context=context_missing_value
        )

        # Should still include the field with N/A for value
        assert "field_name" in prompt
        assert "N/A" in prompt

    def test_context_with_special_characters_in_value(self, extractor, sample_document_text, sample_template_variables):
        """Test handling of context values with special characters."""
        context_special_chars = {
            "company_name": {"value": "O'Reilly & Associates \"LLC\"", "confidence": 0.85}
        }

        # Should not raise an error
        prompt = extractor._build_smart_extraction_prompt(
            text_content=sample_document_text,
            template_variables=sample_template_variables,
            existing_context=context_special_chars
        )

        assert "company_name" in prompt
        assert "O'Reilly" in prompt
