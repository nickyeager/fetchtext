"""
Tests for semantic variable name parsing.

This module tests the SemanticVariableParser which converts variable names like
"customer_billing_address" into semantic descriptions that help the LLM understand
what to look for in documents.
"""
import pytest
from app.services.semantic_variable_parser import SemanticVariableParser


class TestSemanticVariableParser:
    """Test semantic parsing of variable names to natural language descriptions."""

    @pytest.fixture
    def parser(self):
        """Create a parser instance for testing."""
        return SemanticVariableParser()

    def test_parse_snake_case_variable(self, parser):
        """Parse snake_case variable names into semantic descriptions."""
        result = parser.parse_variable_name("customer_billing_address")
        assert result["semantic_description"] == "billing address of a customer"
        assert result["field_type_hint"] == "address"
        assert "street" in result["search_keywords"] or "address" in result["search_keywords"]

    def test_parse_camel_case_variable(self, parser):
        """Parse camelCase variable names."""
        result = parser.parse_variable_name("vendorEmailAddress")
        assert "email" in result["semantic_description"].lower()
        assert result["field_type_hint"] == "email"

    def test_parse_date_variable(self, parser):
        """Identify date-related variables."""
        result = parser.parse_variable_name("invoice_date")
        assert result["field_type_hint"] == "date"
        assert "date" in result["search_keywords"]

    def test_parse_currency_variable(self, parser):
        """Identify currency-related variables."""
        result = parser.parse_variable_name("total_amount")
        assert result["field_type_hint"] == "currency"
        assert any(kw in result["search_keywords"] for kw in ["total", "amount", "$"])

    def test_parse_id_variable(self, parser):
        """Identify ID/reference number variables."""
        result = parser.parse_variable_name("invoice_number")
        assert result["field_type_hint"] == "id"
        assert any(kw in result["search_keywords"] for kw in ["#", "no.", "number"])

    def test_parse_name_variable(self, parser):
        """Identify name variables."""
        result = parser.parse_variable_name("company_name")
        assert result["field_type_hint"] == "text"
        assert "name" in result["semantic_description"].lower()

    def test_relationship_inference(self, parser):
        """Infer relationships between variables."""
        result = parser.parse_variable_name("vendor_address")
        assert "vendor" in result["related_fields"]
        # Should suggest looking near vendor_name

    # Additional edge case tests
    def test_parse_single_word_variable(self, parser):
        """Handle single word variable names."""
        result = parser.parse_variable_name("email")
        assert result["field_type_hint"] == "email"
        assert result["semantic_description"] == "email"

    def test_parse_complex_snake_case(self, parser):
        """Handle complex snake_case with multiple words."""
        result = parser.parse_variable_name("customer_primary_contact_phone")
        assert result["field_type_hint"] == "phone"
        assert "customer" in result["related_fields"]

    def test_parse_mixed_case_variable(self, parser):
        """Handle PascalCase variable names."""
        result = parser.parse_variable_name("CustomerName")
        assert "customer" in result["related_fields"]
        assert "name" in result["semantic_description"].lower()

    def test_return_structure(self, parser):
        """Verify the return structure contains all expected keys."""
        result = parser.parse_variable_name("test_field")
        assert "semantic_description" in result
        assert "field_type_hint" in result
        assert "search_keywords" in result
        assert "related_fields" in result
        assert "original_name" in result
        assert "words" in result

    def test_percentage_type_detection(self, parser):
        """Identify percentage-related variables."""
        result = parser.parse_variable_name("tax_rate")
        assert result["field_type_hint"] == "percentage"

    def test_phone_type_detection(self, parser):
        """Identify phone-related variables."""
        result = parser.parse_variable_name("contact_phone")
        assert result["field_type_hint"] == "phone"

    def test_empty_string_handling(self, parser):
        """Handle empty string input gracefully."""
        result = parser.parse_variable_name("")
        assert result["semantic_description"] == ""
        assert result["field_type_hint"] == "text"
        assert result["words"] == []

    def test_underscore_only_handling(self, parser):
        """Handle underscore-only input."""
        result = parser.parse_variable_name("___")
        assert result["semantic_description"] == ""
        assert result["words"] == []

    def test_keywords_are_unique(self, parser):
        """Ensure search keywords are unique (no duplicates)."""
        result = parser.parse_variable_name("email_email_address")
        keywords = result["search_keywords"]
        assert len(keywords) == len(set(keywords)), "Keywords should be unique"

    def test_batch_parsing(self, parser):
        """Test parsing multiple variables at once."""
        variables = ["invoice_date", "customer_name", "total_amount"]
        results = parser.parse_variable_names(variables)

        assert len(results) == 3
        assert results["invoice_date"]["field_type_hint"] == "date"
        assert results["customer_name"]["field_type_hint"] == "text"
        assert results["total_amount"]["field_type_hint"] == "currency"

    def test_get_extraction_context(self, parser):
        """Test generating extraction context for LLM prompts."""
        context = parser.get_extraction_context("customer_billing_address")

        assert "variable" in context
        assert "description" in context
        assert "look_for" in context
        assert "nearby_fields" in context
