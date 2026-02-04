"""Test that field extraction includes position data"""
import pytest
from app.services.smart_field_extractor import SmartFieldExtractor


class TestExtractorPositions:
    @pytest.fixture
    def extractor(self):
        return SmartFieldExtractor()

    def test_format_extracted_fields_includes_location_structure(self, extractor):
        """Formatted fields should have proper location structure"""
        raw_fields = {
            "invoice_number": {
                "value": "INV-001",
                "confidence": 0.95,
                "reasoning": "Found in header"
            }
        }

        formatted = extractor._format_extracted_fields(raw_fields)

        assert "invoice_number" in formatted
        field = formatted["invoice_number"]

        # Should have location dict structure (even if empty/default)
        assert "location" in field
        assert isinstance(field["location"], dict)
        # Location should have extraction_method at minimum
        assert "extraction_method" in field["location"]

    def test_format_extracted_fields_preserves_bbox_from_raw(self, extractor):
        """If raw data includes bbox, it should be preserved"""
        raw_fields = {
            "total_amount": {
                "value": "$500.00",
                "confidence": 0.9,
                "reasoning": "Found in summary",
                "page": 2,
                "bbox": {"x": 0.1, "y": 0.5, "width": 0.2, "height": 0.05}
            }
        }

        formatted = extractor._format_extracted_fields(raw_fields)

        assert "total_amount" in formatted
        field = formatted["total_amount"]
        assert field["location"]["page"] == 2
        assert field["location"]["bbox"] == {"x": 0.1, "y": 0.5, "width": 0.2, "height": 0.05}

    def test_format_extracted_fields_default_page_is_1(self, extractor):
        """Default page should be 1 if not specified"""
        raw_fields = {
            "vendor_name": {
                "value": "Acme Corp",
                "confidence": 0.85,
                "reasoning": "Header"
            }
        }

        formatted = extractor._format_extracted_fields(raw_fields)
        assert formatted["vendor_name"]["location"]["page"] == 1

    def test_format_extracted_fields_preserves_char_positions(self, extractor):
        """If raw data includes char_start/char_end, they should be preserved"""
        raw_fields = {
            "customer_email": {
                "value": "test@example.com",
                "confidence": 0.92,
                "reasoning": "Email field match",
                "char_start": 150,
                "char_end": 166
            }
        }

        formatted = extractor._format_extracted_fields(raw_fields)

        assert "customer_email" in formatted
        field = formatted["customer_email"]
        assert field["location"]["char_start"] == 150
        assert field["location"]["char_end"] == 166

    def test_format_extracted_fields_location_has_all_expected_keys(self, extractor):
        """Location dict should have all expected keys even when values are None"""
        raw_fields = {
            "date_field": {
                "value": "2024-01-15",
                "confidence": 0.88,
                "reasoning": "Date pattern"
            }
        }

        formatted = extractor._format_extracted_fields(raw_fields)
        location = formatted["date_field"]["location"]

        # Check all expected keys exist
        assert "page" in location
        assert "bbox" in location
        assert "char_start" in location
        assert "char_end" in location
        assert "extraction_method" in location

    def test_format_extracted_fields_extraction_method_is_llm_intelligent(self, extractor):
        """Default extraction method should be 'llm_intelligent'"""
        raw_fields = {
            "company_name": {
                "value": "Test Corp",
                "confidence": 0.75,
                "reasoning": "Found in document header"
            }
        }

        formatted = extractor._format_extracted_fields(raw_fields)
        assert formatted["company_name"]["location"]["extraction_method"] == "llm_intelligent"
