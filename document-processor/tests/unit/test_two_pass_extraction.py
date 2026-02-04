"""
Unit tests for two-pass extraction strategy.

Tests verify that the TwoPassExtractor:
1. Performs first pass extraction and identifies low-confidence fields
2. Uses high-confidence fields as context for second pass
3. Merges results to return best-confidence values
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.two_pass_extractor import TwoPassExtractor


class TestTwoPassExtraction:
    """Test two-pass extraction for improved accuracy."""

    @pytest.fixture
    def extractor(self):
        """Create a TwoPassExtractor instance for testing."""
        return TwoPassExtractor()

    @pytest.fixture
    def sample_template_variables(self):
        """Sample template variables for testing."""
        return [
            {"name": "vendor_name", "type": "text", "description": "Name of the vendor"},
            {"name": "vendor_address", "type": "text", "description": "Address of the vendor"},
            {"name": "invoice_date", "type": "date", "description": "Date of the invoice"},
            {"name": "total_amount", "type": "currency", "description": "Total amount due"},
        ]

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
    async def test_first_pass_extracts_high_confidence(self, extractor):
        """First pass should extract high-confidence fields."""
        with patch.object(extractor, '_run_extraction_pass', new_callable=AsyncMock) as mock_extract:
            mock_extract.return_value = {
                "extracted_values": {
                    "vendor_name": {"value": "Acme Corp", "confidence": 0.95},
                    "vendor_address": {"value": "123 Main", "confidence": 0.45},  # Low confidence
                }
            }

            result = await extractor.extract_two_pass(
                "Sample text",
                [{"name": "vendor_name"}, {"name": "vendor_address"}],
                confidence_threshold=0.6
            )

            # Should have attempted at least one pass
            assert mock_extract.call_count >= 1
            assert "extracted_values" in result

    @pytest.mark.asyncio
    async def test_second_pass_uses_first_pass_context(self, extractor):
        """Second pass should use first pass results as context."""
        call_contexts = []

        async def mock_extraction(text, variables, threshold, context=None, provider="azure"):
            call_contexts.append(context)
            if context is None:
                # First pass
                return {
                    "extracted_values": {
                        "vendor_name": {"value": "Acme Corp", "confidence": 0.95},
                        "total_amount": {"value": "$100", "confidence": 0.40},
                    }
                }
            else:
                # Second pass with context
                return {
                    "extracted_values": {
                        "total_amount": {"value": "$150.00", "confidence": 0.85},
                    }
                }

        with patch.object(extractor, '_run_extraction_pass', side_effect=mock_extraction):
            result = await extractor.extract_two_pass(
                "Invoice from Acme Corp for $150.00",
                [{"name": "vendor_name"}, {"name": "total_amount"}],
                confidence_threshold=0.6
            )

            # First call should have no context (None)
            assert call_contexts[0] is None

            # Second call should have context from first pass
            assert len(call_contexts) >= 2
            assert call_contexts[1] is not None
            assert "vendor_name" in call_contexts[1]
            assert call_contexts[1]["vendor_name"]["value"] == "Acme Corp"

    @pytest.mark.asyncio
    async def test_returns_best_results(self, extractor):
        """Should return best confidence results from both passes."""
        async def mock_extraction(text, variables, threshold, context=None, provider="azure"):
            if context is None:
                return {
                    "extracted_values": {
                        "field_a": {"value": "first", "confidence": 0.9},
                        "field_b": {"value": "low", "confidence": 0.4},
                    }
                }
            else:
                return {
                    "extracted_values": {
                        "field_b": {"value": "improved", "confidence": 0.8},
                    }
                }

        with patch.object(extractor, '_run_extraction_pass', side_effect=mock_extraction):
            result = await extractor.extract_two_pass(
                "text",
                [{"name": "field_a"}, {"name": "field_b"}],
                confidence_threshold=0.6
            )

            # Should have high-confidence field_a from pass 1
            # and improved field_b from pass 2
            extracted = result.get("extracted_values", {})
            assert extracted.get("field_a", {}).get("value") == "first"
            assert extracted.get("field_b", {}).get("value") == "improved"

    @pytest.mark.asyncio
    async def test_no_second_pass_when_all_high_confidence(self, extractor):
        """Should skip second pass when all fields have high confidence."""
        call_count = 0

        async def mock_extraction(text, variables, threshold, context=None, provider="azure"):
            nonlocal call_count
            call_count += 1
            return {
                "extracted_values": {
                    "field_a": {"value": "value_a", "confidence": 0.95},
                    "field_b": {"value": "value_b", "confidence": 0.90},
                }
            }

        with patch.object(extractor, '_run_extraction_pass', side_effect=mock_extraction):
            result = await extractor.extract_two_pass(
                "text",
                [{"name": "field_a"}, {"name": "field_b"}],
                confidence_threshold=0.6
            )

            # Should only call once since all fields are high confidence
            assert call_count == 1
            assert result["pass_stats"]["pass1_high_confidence"] == 2
            assert result["pass_stats"]["pass2_refined"] == 0

    @pytest.mark.asyncio
    async def test_no_second_pass_when_no_high_confidence_context(self, extractor):
        """Should skip second pass when there's no high-confidence context to use."""
        call_count = 0

        async def mock_extraction(text, variables, threshold, context=None, provider="azure"):
            nonlocal call_count
            call_count += 1
            return {
                "extracted_values": {
                    "field_a": {"value": "value_a", "confidence": 0.3},
                    "field_b": {"value": "value_b", "confidence": 0.4},
                }
            }

        with patch.object(extractor, '_run_extraction_pass', side_effect=mock_extraction):
            result = await extractor.extract_two_pass(
                "text",
                [{"name": "field_a"}, {"name": "field_b"}],
                confidence_threshold=0.6
            )

            # Should only call once - no high-confidence context to provide
            assert call_count == 1

    @pytest.mark.asyncio
    async def test_handles_missing_fields_in_first_pass(self, extractor):
        """Should include fields not extracted in first pass in second pass."""
        call_variables = []

        async def mock_extraction(text, variables, threshold, context=None, provider="azure"):
            call_variables.append([v.get("name") for v in variables])
            if context is None:
                # First pass - only extract field_a
                return {
                    "extracted_values": {
                        "field_a": {"value": "value_a", "confidence": 0.95},
                    }
                }
            else:
                # Second pass - extract missing field_b
                return {
                    "extracted_values": {
                        "field_b": {"value": "value_b", "confidence": 0.75},
                    }
                }

        with patch.object(extractor, '_run_extraction_pass', side_effect=mock_extraction):
            result = await extractor.extract_two_pass(
                "text",
                [{"name": "field_a"}, {"name": "field_b"}],
                confidence_threshold=0.6
            )

            # field_b should be in second pass variables
            assert len(call_variables) >= 2
            assert "field_b" in call_variables[1]

            # Both fields should be in final result
            extracted = result.get("extracted_values", {})
            assert "field_a" in extracted
            assert "field_b" in extracted

    @pytest.mark.asyncio
    async def test_extraction_pass_marked(self, extractor):
        """Each field should be marked with which pass it was extracted in."""
        async def mock_extraction(text, variables, threshold, context=None, provider="azure"):
            if context is None:
                return {
                    "extracted_values": {
                        "field_a": {"value": "value_a", "confidence": 0.95},
                        "field_b": {"value": "low", "confidence": 0.4},
                    }
                }
            else:
                return {
                    "extracted_values": {
                        "field_b": {"value": "improved", "confidence": 0.85},
                    }
                }

        with patch.object(extractor, '_run_extraction_pass', side_effect=mock_extraction):
            result = await extractor.extract_two_pass(
                "text",
                [{"name": "field_a"}, {"name": "field_b"}],
                confidence_threshold=0.6
            )

            extracted = result.get("extracted_values", {})
            # field_a should be marked as pass 1
            assert extracted["field_a"].get("extraction_pass") == 1
            # field_b should be marked as pass 2 (improved)
            assert extracted["field_b"].get("extraction_pass") == 2

    @pytest.mark.asyncio
    async def test_result_metadata(self, extractor):
        """Result should include extraction metadata."""
        async def mock_extraction(text, variables, threshold, context=None, provider="azure"):
            return {
                "extracted_values": {
                    "field_a": {"value": "value_a", "confidence": 0.95},
                }
            }

        with patch.object(extractor, '_run_extraction_pass', side_effect=mock_extraction):
            result = await extractor.extract_two_pass(
                "text",
                [{"name": "field_a"}],
                confidence_threshold=0.6
            )

            # Check metadata fields
            assert result["extraction_method"] == "two_pass_intelligent"
            assert "total_fields_requested" in result
            assert "fields_extracted" in result
            assert "confidence_threshold" in result
            assert "success_rate" in result
            assert "processing_time_ms" in result
            assert "pass_stats" in result


class TestTwoPassExtractionEdgeCases:
    """Edge case tests for two-pass extraction."""

    @pytest.fixture
    def extractor(self):
        return TwoPassExtractor()

    @pytest.mark.asyncio
    async def test_empty_template_variables(self, extractor):
        """Should handle empty template variables gracefully."""
        async def mock_extraction(text, variables, threshold, context=None, provider="azure"):
            return {"extracted_values": {}}

        with patch.object(extractor, '_run_extraction_pass', side_effect=mock_extraction):
            result = await extractor.extract_two_pass(
                "text",
                [],
                confidence_threshold=0.6
            )

            assert result["total_fields_requested"] == 0
            assert result["fields_extracted"] == 0

    @pytest.mark.asyncio
    async def test_custom_confidence_threshold(self, extractor):
        """Should respect custom confidence threshold."""
        async def mock_extraction(text, variables, threshold, context=None, provider="azure"):
            return {
                "extracted_values": {
                    "field_a": {"value": "value_a", "confidence": 0.75},
                    "field_b": {"value": "value_b", "confidence": 0.85},
                }
            }

        with patch.object(extractor, '_run_extraction_pass', side_effect=mock_extraction):
            # With 0.8 threshold, only field_b should count as high-confidence
            result = await extractor.extract_two_pass(
                "text",
                [{"name": "field_a"}, {"name": "field_b"}],
                confidence_threshold=0.8
            )

            # Both fields should still be extracted
            extracted = result.get("extracted_values", {})
            assert len(extracted) == 2

    @pytest.mark.asyncio
    async def test_second_pass_doesnt_improve(self, extractor):
        """Should keep first pass result when second pass doesn't improve confidence."""
        async def mock_extraction(text, variables, threshold, context=None, provider="azure"):
            if context is None:
                return {
                    "extracted_values": {
                        "field_a": {"value": "good", "confidence": 0.95},
                        "field_b": {"value": "okay", "confidence": 0.5},
                    }
                }
            else:
                # Second pass has lower confidence
                return {
                    "extracted_values": {
                        "field_b": {"value": "worse", "confidence": 0.3},
                    }
                }

        with patch.object(extractor, '_run_extraction_pass', side_effect=mock_extraction):
            result = await extractor.extract_two_pass(
                "text",
                [{"name": "field_a"}, {"name": "field_b"}],
                confidence_threshold=0.6
            )

            extracted = result.get("extracted_values", {})
            # field_b should keep pass 1 value since pass 2 was worse
            assert extracted["field_b"]["value"] == "okay"
            assert extracted["field_b"]["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_provider_passed_through(self, extractor):
        """Should pass provider to underlying extraction."""
        providers_used = []

        async def mock_extraction(text, variables, threshold, context=None, provider="azure"):
            providers_used.append(provider)
            return {"extracted_values": {"field_a": {"value": "v", "confidence": 0.95}}}

        with patch.object(extractor, '_run_extraction_pass', side_effect=mock_extraction):
            await extractor.extract_two_pass(
                "text",
                [{"name": "field_a"}],
                confidence_threshold=0.6,
                provider="ollama"
            )

            assert all(p == "ollama" for p in providers_used)
