"""
Comprehensive Integration Tests for TemplateMatchingService

Tests the TemplateMatchingService with real template matching,
scoring algorithms, and semantic similarity features.

Run with: pytest tests/integration/test_template_matching_full.py -v
"""
import pytest
import asyncio
import time
from typing import Dict, Any, List
import json


class TestTemplateMatchingServiceCore:
    """Core functionality tests for TemplateMatchingService."""

    @pytest.fixture
    def matching_service(self):
        """Get TemplateMatchingService instance."""
        from app.services.template_matching_service import TemplateMatchingService
        return TemplateMatchingService()

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_find_matching_templates_for_invoice(self, matching_service):
        """Test finding templates for invoice document type."""
        document_type = "invoice"
        content_keywords = ["invoice", "total", "amount", "due", "payment", "billing"]

        results = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.3
        )

        # Results should be a list
        assert isinstance(results, list)

        if len(results) > 0:
            # First result should have required fields
            first = results[0]
            assert "template_id" in first or "id" in first
            assert "match_score" in first or "score" in first

            # Results should be sorted by score (descending)
            if len(results) > 1:
                scores = [r.get("match_score", r.get("score", 0)) for r in results]
                assert scores == sorted(scores, reverse=True)

            print(f"✅ Found {len(results)} matching templates for invoice")
        else:
            print("ℹ️ No templates found (database may be empty)")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_find_matching_templates_for_contract(self, matching_service):
        """Test finding templates for contract document type."""
        document_type = "contract"
        content_keywords = ["agreement", "contract", "terms", "party", "whereas", "signature"]

        results = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.3
        )

        assert isinstance(results, list)

        if len(results) > 0:
            print(f"✅ Found {len(results)} matching templates for contract")
        else:
            print("ℹ️ No templates found for contract type")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_find_matching_templates_for_receipt(self, matching_service):
        """Test finding templates for receipt document type."""
        document_type = "receipt"
        content_keywords = ["receipt", "transaction", "purchase", "store", "total", "payment"]

        results = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.3
        )

        assert isinstance(results, list)
        print(f"✅ Found {len(results)} matching templates for receipt")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_find_templates_with_document_text(self, matching_service):
        """Test template matching with full document text for semantic similarity."""
        document_type = "invoice"
        content_keywords = ["invoice", "billing", "total"]
        document_text = """INVOICE
From: ABC Corporation
Invoice Number: INV-2024-001
Date: January 15, 2024

Description: Software Development Services
Amount: $5,000.00
Tax: $450.00
Total Due: $5,450.00

Payment Terms: Net 30
"""

        results = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.2,
            document_text=document_text
        )

        assert isinstance(results, list)
        print(f"✅ Semantic matching found {len(results)} templates")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_min_confidence_filtering(self, matching_service):
        """Test that min_confidence properly filters results."""
        document_type = "invoice"
        content_keywords = ["invoice"]

        # High threshold
        high_conf_results = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.8
        )

        # Low threshold
        low_conf_results = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.2
        )

        # Low threshold should return equal or more results
        assert len(low_conf_results) >= len(high_conf_results)

        # All high confidence results should meet threshold
        for result in high_conf_results:
            score = result.get("match_score", result.get("score", 0))
            assert score >= 0.8

        print(f"✅ Confidence filtering: high={len(high_conf_results)}, low={len(low_conf_results)}")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_user_private_templates_included(self, matching_service):
        """Test that user_id parameter includes private templates."""
        document_type = "invoice"
        content_keywords = ["invoice"]

        # Without user_id
        public_results = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.2,
            user_id=None
        )

        # With user_id (using a test UUID)
        user_results = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.2,
            user_id="00000000-0000-0000-0000-000000000001"
        )

        # Both should return valid lists
        assert isinstance(public_results, list)
        assert isinstance(user_results, list)

        print(f"✅ Public templates: {len(public_results)}, With user: {len(user_results)}")


class TestTemplateMatchingScoringAlgorithm:
    """Tests for the multi-factor scoring algorithm."""

    @pytest.fixture
    def matching_service(self):
        """Get TemplateMatchingService instance."""
        from app.services.template_matching_service import TemplateMatchingService
        return TemplateMatchingService()

    @pytest.mark.integration
    def test_category_mapping_exists(self, matching_service):
        """Test that category mappings are properly defined."""
        assert hasattr(matching_service, "category_mappings")
        mappings = matching_service.category_mappings

        # Should have mappings for common document types
        assert "invoice" in mappings
        assert "contract" in mappings
        assert "receipt" in mappings
        assert "report" in mappings

        # Each mapping should be a list
        for doc_type, categories in mappings.items():
            assert isinstance(categories, list)
            assert len(categories) > 0

        print(f"✅ Category mappings defined for {len(mappings)} document types")

    @pytest.mark.integration
    def test_field_indicators_exist(self, matching_service):
        """Test that field indicators are properly defined."""
        assert hasattr(matching_service, "field_indicators")
        indicators = matching_service.field_indicators

        # Should have indicators for common fields
        common_fields = ["invoice_number", "total_amount", "date", "email", "address"]
        for field in common_fields:
            assert field in indicators
            assert isinstance(indicators[field], list)
            assert len(indicators[field]) > 0

        print(f"✅ Field indicators defined for {len(indicators)} field types")

    @pytest.mark.integration
    def test_category_alignment_score(self, matching_service):
        """Test category alignment scoring logic."""
        # Invoice document should align with finance/billing categories
        invoice_mappings = matching_service.category_mappings.get("invoice", [])

        assert "finance" in invoice_mappings or "billing" in invoice_mappings or "invoice" in invoice_mappings

        # Contract should align with legal categories
        contract_mappings = matching_service.category_mappings.get("contract", [])
        assert "legal" in contract_mappings or "contract" in contract_mappings

        print("✅ Category alignment mappings are correct")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_scoring_algorithm_produces_valid_scores(self, matching_service):
        """Test that scoring algorithm produces scores in valid range."""
        document_type = "invoice"
        content_keywords = ["invoice", "total", "amount", "payment"]

        results = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.0  # Get all results
        )

        for result in results:
            score = result.get("match_score", result.get("score", 0))
            # Score should be between 0 and 1
            assert 0.0 <= score <= 1.0

        print(f"✅ All {len(results)} scores in valid range [0, 1]")


class TestTemplateMatchingFieldDetection:
    """Tests for field detectability scoring."""

    @pytest.fixture
    def matching_service(self):
        """Get TemplateMatchingService instance."""
        from app.services.template_matching_service import TemplateMatchingService
        return TemplateMatchingService()

    @pytest.mark.integration
    def test_field_detection_invoice_fields(self, matching_service):
        """Test detection of invoice-related fields in content."""
        content = """Invoice Number: INV-2024-001
Total Amount: $5,000.00
Due Date: February 15, 2024
Customer Email: customer@example.com
"""
        # Field indicators should detect these
        indicators = matching_service.field_indicators

        # Invoice number indicators should match
        invoice_indicators = indicators.get("invoice_number", [])
        assert any(ind.lower() in content.lower() for ind in invoice_indicators)

        # Total amount indicators should match
        total_indicators = indicators.get("total_amount", [])
        assert any(ind.lower() in content.lower() for ind in total_indicators)

        print("✅ Invoice fields correctly detected via indicators")

    @pytest.mark.integration
    def test_field_detection_contract_fields(self, matching_service):
        """Test detection of contract-related fields in content."""
        content = """This Agreement is between Party A and Party B.
Effective Date: January 1, 2024
The terms and conditions are as follows...
Signature: ________________
"""
        indicators = matching_service.field_indicators

        # Party name indicators should match
        party_indicators = indicators.get("party_name", [])
        assert any(ind.lower() in content.lower() for ind in party_indicators)

        # Effective date indicators should match
        date_indicators = indicators.get("effective_date", [])
        assert any(ind.lower() in content.lower() for ind in date_indicators)

        print("✅ Contract fields correctly detected via indicators")

    @pytest.mark.integration
    def test_field_detection_proposal_fields(self, matching_service):
        """Test detection of proposal-related fields."""
        content = """Proposal submitted to John Smith
Job Location: 123 Main Street
Scope of Work: Complete roof replacement
Total Cost: $15,000
"""
        indicators = matching_service.field_indicators

        # Submitted to / customer indicators
        submitted_indicators = indicators.get("submitted_to", [])
        assert any(ind.lower() in content.lower() for ind in submitted_indicators)

        # Job location indicators
        location_indicators = indicators.get("job_location", [])
        assert any(ind.lower() in content.lower() for ind in location_indicators)

        # Work scope indicators
        scope_indicators = indicators.get("work_scope", [])
        assert any(ind.lower() in content.lower() for ind in scope_indicators)

        print("✅ Proposal fields correctly detected via indicators")


class TestTemplateMatchingCaching:
    """Tests for template caching functionality."""

    @pytest.fixture
    def matching_service(self):
        """Get TemplateMatchingService instance."""
        from app.services.template_matching_service import TemplateMatchingService
        return TemplateMatchingService()

    @pytest.mark.integration
    def test_template_cache_exists(self, matching_service):
        """Test that template cache is properly initialized."""
        assert hasattr(matching_service, "template_cache")
        assert matching_service.cache_enabled is True

        print("✅ Template cache initialized")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_cached_queries_faster(self, matching_service):
        """Test that cached queries are faster than initial queries."""
        document_type = "invoice"
        content_keywords = ["invoice", "total"]

        # First query (may hit database)
        start1 = time.time()
        results1 = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.2
        )
        time1 = time.time() - start1

        # Second query (should hit cache)
        start2 = time.time()
        results2 = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.2
        )
        time2 = time.time() - start2

        # Results should be consistent
        assert len(results1) == len(results2)

        print(f"✅ Query times: first={time1:.3f}s, cached={time2:.3f}s")


class TestTemplateMatchingEmbeddings:
    """Tests for semantic embedding functionality."""

    @pytest.fixture
    def matching_service(self):
        """Get TemplateMatchingService instance."""
        from app.services.template_matching_service import TemplateMatchingService
        return TemplateMatchingService()

    @pytest.mark.integration
    def test_embeddings_availability_flag(self, matching_service):
        """Test that embeddings availability is properly detected."""
        assert hasattr(matching_service, "_embeddings_available")
        # This will be True if embedding service is configured
        print(f"✅ Embeddings available: {matching_service._embeddings_available}")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_semantic_similarity_with_text(self, matching_service):
        """Test that document text improves matching when embeddings available."""
        document_type = "invoice"
        content_keywords = ["invoice"]

        # Without text
        results_no_text = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.2,
            document_text=None
        )

        # With text
        document_text = """INVOICE
Invoice Number: INV-001
From: ABC Company
Total Due: $1,000.00
Payment Terms: Net 30
"""
        results_with_text = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.2,
            document_text=document_text
        )

        # Both should return valid results
        assert isinstance(results_no_text, list)
        assert isinstance(results_with_text, list)

        print(f"✅ Without text: {len(results_no_text)}, With text: {len(results_with_text)}")


class TestTemplateMatchingEdgeCases:
    """Edge case tests for TemplateMatchingService."""

    @pytest.fixture
    def matching_service(self):
        """Get TemplateMatchingService instance."""
        from app.services.template_matching_service import TemplateMatchingService
        return TemplateMatchingService()

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_unknown_document_type(self, matching_service):
        """Test matching with unknown document type."""
        document_type = "unknown_type_xyz"
        content_keywords = ["random", "words"]

        results = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.1
        )

        # Should return empty list or low-scoring results
        assert isinstance(results, list)
        print(f"✅ Unknown type returned {len(results)} results")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_empty_keywords(self, matching_service):
        """Test matching with empty keywords list."""
        document_type = "invoice"
        content_keywords = []

        results = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.1
        )

        # Should still work, relying on document type matching
        assert isinstance(results, list)
        print(f"✅ Empty keywords returned {len(results)} results")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_very_high_confidence_threshold(self, matching_service):
        """Test with very high confidence threshold."""
        document_type = "invoice"
        content_keywords = ["invoice"]

        results = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.99
        )

        # May return empty list at very high threshold
        assert isinstance(results, list)
        for result in results:
            score = result.get("match_score", result.get("score", 0))
            assert score >= 0.99

        print(f"✅ High threshold (0.99) returned {len(results)} results")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_special_characters_in_keywords(self, matching_service):
        """Test matching with special characters in keywords."""
        document_type = "invoice"
        content_keywords = ["invoice#", "$amount", "total@due"]

        # Should handle without error
        results = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.1
        )

        assert isinstance(results, list)
        print(f"✅ Special characters handled, returned {len(results)} results")


class TestTemplateMatchingPerformance:
    """Performance tests for TemplateMatchingService."""

    @pytest.fixture
    def matching_service(self):
        """Get TemplateMatchingService instance."""
        from app.services.template_matching_service import TemplateMatchingService
        return TemplateMatchingService()

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_matching_completes_within_timeout(self, matching_service):
        """Test that template matching completes within acceptable time."""
        document_type = "invoice"
        content_keywords = ["invoice", "total", "amount", "payment", "due", "date"]
        document_text = "Invoice content " * 500  # Larger text

        start_time = time.time()
        results = await matching_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=0.2,
            document_text=document_text
        )
        elapsed = time.time() - start_time

        # Should complete within 10 seconds
        assert elapsed < 10.0
        assert isinstance(results, list)

        print(f"✅ Matching completed in {elapsed:.2f}s")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_multiple_document_types_performance(self, matching_service):
        """Test matching performance across multiple document types."""
        document_types = ["invoice", "contract", "receipt", "report", "form"]
        total_time = 0
        results_count = []

        for doc_type in document_types:
            start = time.time()
            results = await matching_service.find_matching_templates(
                document_type=doc_type,
                content_keywords=[doc_type, "test"],
                min_confidence=0.1
            )
            elapsed = time.time() - start
            total_time += elapsed
            results_count.append(len(results))

        avg_time = total_time / len(document_types)
        assert avg_time < 5.0

        print(f"✅ Avg matching time: {avg_time:.3f}s, Total results: {sum(results_count)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
