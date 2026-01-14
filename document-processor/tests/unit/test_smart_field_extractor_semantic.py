"""Tests for semantic-enhanced smart field extraction."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.smart_field_extractor import SmartFieldExtractor


class TestSmartFieldExtractorSemantic:
    """Test semantic enhancements to smart field extractor."""

    @pytest.fixture
    def extractor(self):
        return SmartFieldExtractor()

    def test_build_prompt_includes_semantic_description(self, extractor):
        """Prompt should include semantic description of variable."""
        template_variables = [
            {
                "name": "customer_billing_address",
                "type": "text",
                "description": "Customer address",
                "extraction_hints": []
            }
        ]

        prompt = extractor._build_smart_extraction_prompt(
            "Sample document text",
            template_variables
        )

        # Should include semantic understanding
        assert "billing address of a customer" in prompt.lower() or \
               "semantic meaning" in prompt.lower() or \
               "look for" in prompt.lower()

    def test_build_prompt_includes_field_type_guidance(self, extractor):
        """Prompt should include field-type specific guidance."""
        template_variables = [
            {
                "name": "invoice_date",
                "type": "date",
                "description": "Invoice date",
                "extraction_hints": []
            }
        ]

        prompt = extractor._build_smart_extraction_prompt(
            "Sample document text",
            template_variables
        )

        # Should mention date patterns
        assert "date" in prompt.lower()

    def test_get_semantic_field_info(self, extractor):
        """Should generate semantic info for fields."""
        result = extractor._get_semantic_field_info("vendor_email_address")

        assert result is not None
        assert "email" in result.get("field_type_hint", "") or \
               "email" in result.get("semantic_description", "").lower()

    def test_build_prompt_includes_semantic_meaning_line(self, extractor):
        """Prompt should include 'Semantic meaning:' line for field."""
        template_variables = [
            {
                "name": "customer_billing_address",
                "type": "text",
                "description": "Customer address",
                "extraction_hints": []
            }
        ]

        prompt = extractor._build_smart_extraction_prompt(
            "Sample document text",
            template_variables
        )

        # Should include the semantic meaning line
        assert 'Semantic meaning:' in prompt
        assert 'billing address of a customer' in prompt.lower()

    def test_build_prompt_includes_related_fields(self, extractor):
        """Prompt should include related fields hint for entity-prefixed variables."""
        template_variables = [
            {
                "name": "customer_email",
                "type": "email",
                "description": "Customer email address",
                "extraction_hints": []
            }
        ]

        prompt = extractor._build_smart_extraction_prompt(
            "Sample document text",
            template_variables
        )

        # Should include related fields hint since 'customer' is an entity prefix
        assert 'Often found near:' in prompt

    def test_semantic_keywords_merged_with_variations(self, extractor):
        """Semantic keywords should be merged with existing variations."""
        template_variables = [
            {
                "name": "invoice_date",
                "type": "date",
                "description": "Date of invoice",
                "extraction_hints": []
            }
        ]

        prompt = extractor._build_smart_extraction_prompt(
            "Sample document text",
            template_variables
        )

        # Should have combined keywords from both sources
        assert 'Look for:' in prompt
        # Semantic keywords for date include 'date', 'dated', 'on'
        # Should include at least some of these
        lower_prompt = prompt.lower()
        assert 'date' in lower_prompt
