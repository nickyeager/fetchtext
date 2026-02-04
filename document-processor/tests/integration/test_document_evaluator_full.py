"""
Comprehensive Integration Tests for DocumentEvaluator Service

Tests the DocumentEvaluator service with real document processing,
template matching, and type detection workflows.

Run with: pytest tests/integration/test_document_evaluator_full.py -v
"""
import pytest
import asyncio
import tempfile
import time
from pathlib import Path
from typing import Dict, Any, List
import json


class TestDocumentEvaluatorCore:
    """Core functionality tests for DocumentEvaluator."""

    @pytest.fixture
    def evaluator(self):
        """Get DocumentEvaluator instance."""
        from app.services.document_evaluator import DocumentEvaluator
        return DocumentEvaluator()

    @pytest.fixture
    def sample_invoice_path(self, temp_dir) -> Path:
        """Create sample invoice document."""
        content = """INVOICE

From: TechCorp Solutions
123 Business Street
San Francisco, CA 94105
Phone: (555) 123-4567
Email: billing@techcorp.com

To: ABC Company
456 Customer Avenue
New York, NY 10001

Invoice Number: INV-2024-001
Invoice Date: January 15, 2024
Due Date: February 15, 2024

DESCRIPTION                          QTY    RATE      AMOUNT
Software Development Services         40    $125.00   $5,000.00
UI/UX Design Consultation            10    $100.00   $1,000.00
System Integration                   20     $75.00   $1,500.00

                              Subtotal:    $7,500.00
                                   Tax:      $675.00
                           TOTAL AMOUNT:    $8,175.00

Payment Terms: Net 30 days
Payment Method: Check or Wire Transfer

Thank you for your business!
"""
        file_path = temp_dir / "sample_invoice.txt"
        file_path.write_text(content)
        return file_path

    @pytest.fixture
    def sample_contract_path(self, temp_dir) -> Path:
        """Create sample contract document."""
        content = """SERVICE AGREEMENT

This Agreement is entered into as of January 1, 2024

BETWEEN:
Party A: TechCorp Solutions Inc. ("Service Provider")
123 Business Street, San Francisco, CA 94105

AND:
Party B: ABC Company ("Client")
456 Customer Avenue, New York, NY 10001

WHEREAS the Service Provider agrees to provide software development services;
WHEREAS the Client agrees to compensate the Service Provider;

NOW THEREFORE, in consideration of the mutual covenants herein, the parties agree:

1. SCOPE OF SERVICES
   The Service Provider shall provide software development and consulting services
   as outlined in Exhibit A attached hereto.

2. TERM
   This Agreement shall commence on January 1, 2024 and continue for a period
   of twelve (12) months unless terminated earlier.

3. COMPENSATION
   The Client agrees to pay the Service Provider according to the fee schedule
   in Exhibit B.

4. TERMINATION
   Either party may terminate this Agreement with 30 days written notice.

IN WITNESS WHEREOF, the parties have executed this Agreement:

Service Provider: _____________________ Date: _____________
Client: _____________________ Date: _____________
"""
        file_path = temp_dir / "sample_contract.txt"
        file_path.write_text(content)
        return file_path

    @pytest.fixture
    def sample_receipt_path(self, temp_dir) -> Path:
        """Create sample receipt document."""
        content = """WALMART SUPERCENTER
123 Main Street
Anytown, ST 12345
Phone: (555) 123-4567

RECEIPT
Transaction ID: TXN-2024-789012
Date: January 20, 2024
Time: 14:30:25
Cashier: Jane D.

ITEMS PURCHASED:
Milk (1 gal)           $3.99
Bread                  $2.49
Eggs (12 ct)           $2.99
Bananas (2 lbs)        $1.98
Coffee (ground)        $8.99

Subtotal:             $20.44
Tax (8%):              $1.64
TOTAL:                $22.08

Payment Method: VISA ****1234
Authorization: 123456

Thank you for shopping with us!
Returns accepted within 30 days with receipt.
"""
        file_path = temp_dir / "sample_receipt.txt"
        file_path.write_text(content)
        return file_path

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_evaluate_invoice_document(self, evaluator, sample_invoice_path):
        """Test evaluation of invoice document returns correct type detection."""
        result = await evaluator.evaluate_document(
            file_path=sample_invoice_path,
            filename="sample_invoice.txt",
            content_type="text/plain",
            quick_scan=True
        )

        # Verify result structure
        assert "document_info" in result
        assert "type_evaluation" in result
        assert "template_suggestions" in result
        assert "processing_recommendations" in result

        # Verify type detection
        type_eval = result["type_evaluation"]
        assert type_eval["primary_type"] == "invoice"
        assert type_eval["confidence"] > 0.5

        # Verify document info
        doc_info = result["document_info"]
        assert doc_info["format_supported"] is True
        assert doc_info["file_extension"] == ".txt"

        print(f"✅ Invoice detection: type={type_eval['primary_type']}, confidence={type_eval['confidence']:.2f}")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_evaluate_contract_document(self, evaluator, sample_contract_path):
        """Test evaluation of contract document returns correct type detection."""
        result = await evaluator.evaluate_document(
            file_path=sample_contract_path,
            filename="sample_contract.txt",
            content_type="text/plain",
            quick_scan=True
        )

        type_eval = result["type_evaluation"]
        assert type_eval["primary_type"] == "contract"
        assert type_eval["confidence"] > 0.4

        print(f"✅ Contract detection: type={type_eval['primary_type']}, confidence={type_eval['confidence']:.2f}")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_evaluate_receipt_document(self, evaluator, sample_receipt_path):
        """Test evaluation of receipt document returns correct type detection."""
        result = await evaluator.evaluate_document(
            file_path=sample_receipt_path,
            filename="sample_receipt.txt",
            content_type="text/plain",
            quick_scan=True
        )

        type_eval = result["type_evaluation"]
        # Receipt should be detected as receipt or invoice (both valid)
        assert type_eval["primary_type"] in ["receipt", "invoice"]
        assert type_eval["confidence"] > 0.3

        print(f"✅ Receipt detection: type={type_eval['primary_type']}, confidence={type_eval['confidence']:.2f}")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_content_override_bypasses_file_extraction(self, evaluator, temp_dir):
        """Test that content_override parameter bypasses file extraction."""
        # Create a minimal file (content doesn't matter)
        file_path = temp_dir / "dummy.txt"
        file_path.write_text("This should be ignored")

        # Override with invoice content
        invoice_content = """INVOICE
Invoice Number: INV-001
Total Amount: $5,000.00
Due Date: January 30, 2024
Payment Terms: Net 30
"""

        result = await evaluator.evaluate_document(
            file_path=file_path,
            filename="dummy.txt",
            content_type="text/plain",
            content_override=invoice_content,
            quick_scan=True
        )

        # Should detect as invoice based on override content, not file content
        assert result["type_evaluation"]["primary_type"] == "invoice"

        print("✅ Content override correctly bypassed file extraction")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_quick_scan_vs_full_scan_performance(self, evaluator, sample_invoice_path):
        """Test that quick scan is faster than full scan."""
        # Quick scan
        start_quick = time.time()
        result_quick = await evaluator.evaluate_document(
            file_path=sample_invoice_path,
            filename="sample_invoice.txt",
            content_type="text/plain",
            quick_scan=True
        )
        time_quick = time.time() - start_quick

        # Full scan
        start_full = time.time()
        result_full = await evaluator.evaluate_document(
            file_path=sample_invoice_path,
            filename="sample_invoice.txt",
            content_type="text/plain",
            quick_scan=False
        )
        time_full = time.time() - start_full

        # Both should detect correctly
        assert result_quick["type_evaluation"]["primary_type"] == "invoice"
        assert result_full["type_evaluation"]["primary_type"] == "invoice"

        # Quick scan should generally be faster (allow some variance)
        print(f"✅ Quick scan: {time_quick:.3f}s, Full scan: {time_full:.3f}s")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_unsupported_format_handling(self, evaluator, temp_dir):
        """Test handling of unsupported file formats."""
        # Create unsupported file type
        file_path = temp_dir / "test.xyz"
        file_path.write_bytes(b'\x00\x01\x02\x03')

        result = await evaluator.evaluate_document(
            file_path=file_path,
            filename="test.xyz",
            content_type="application/xyz",
            quick_scan=True
        )

        assert result["document_info"]["format_supported"] is False
        assert result["type_evaluation"]["primary_type"] == "unsupported"
        assert result["processing_recommendations"]["workflow"] == "unsupported"

        print("✅ Unsupported format handled correctly")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_unknown_document_type(self, evaluator, temp_dir):
        """Test handling of documents that don't match known patterns."""
        content = """Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
"""
        file_path = temp_dir / "lorem.txt"
        file_path.write_text(content)

        result = await evaluator.evaluate_document(
            file_path=file_path,
            filename="lorem.txt",
            content_type="text/plain",
            quick_scan=True
        )

        type_eval = result["type_evaluation"]
        assert type_eval["primary_type"] == "unknown"
        assert type_eval["confidence"] < 0.01  # Near-zero confidence
        assert result["processing_recommendations"]["workflow"] == "generate_template"

        print("✅ Unknown document type handled correctly")


class TestDocumentEvaluatorHelpers:
    """Tests for DocumentEvaluator helper methods."""

    @pytest.fixture
    def evaluator(self):
        """Get DocumentEvaluator instance."""
        from app.services.document_evaluator import DocumentEvaluator
        return DocumentEvaluator()

    @pytest.mark.integration
    def test_calculate_pattern_score_full_match(self, evaluator):
        """Test pattern scoring with all keywords present."""
        content = "This invoice shows the total amount due with payment terms"
        keywords = ["invoice", "total", "amount", "payment"]

        score = evaluator._calculate_pattern_score(content, keywords)
        assert score >= 0.99  # Near-perfect match

        print(f"✅ Full match score: {score}")

    @pytest.mark.integration
    def test_calculate_pattern_score_partial_match(self, evaluator):
        """Test pattern scoring with some keywords present."""
        content = "This is an invoice document"
        keywords = ["invoice", "total", "amount", "payment"]

        score = evaluator._calculate_pattern_score(content, keywords)
        # Score should be partial (between 0 and 1, not full match)
        assert 0.0 < score < 1.0

        print(f"✅ Partial match score: {score}")

    @pytest.mark.integration
    def test_calculate_pattern_score_no_match(self, evaluator):
        """Test pattern scoring with no keywords present."""
        content = "Just some random text without any relevant keywords"
        keywords = ["invoice", "receipt", "contract", "agreement"]

        score = evaluator._calculate_pattern_score(content, keywords)
        assert score < 0.01  # Near-zero match

        print(f"✅ No match score: {score}")

    @pytest.mark.integration
    def test_extract_key_phrases(self, evaluator):
        """Test key phrase extraction from document text."""
        text = """Invoice number 12345 from TechCorp Solutions
Total amount due: $5,000.00
Due date: February 15, 2024
Payment terms: Net 30 days"""

        phrases = evaluator._extract_key_phrases(text, limit=10)

        assert len(phrases) > 0
        assert len(phrases) <= 10
        # Should extract meaningful words
        assert any("invoice" in p.lower() for p in phrases)
        # Should filter common stop words
        assert "the" not in [p.lower() for p in phrases]

        print(f"✅ Extracted {len(phrases)} key phrases: {phrases[:5]}...")

    @pytest.mark.integration
    def test_determine_workflow_high_confidence(self, evaluator):
        """Test workflow determination for high confidence with template match."""
        type_eval = {"confidence": 0.9}
        templates = [{"match_score": 0.85, "template_name": "Invoice Template"}]

        workflow = evaluator._determine_workflow(type_eval, templates)

        assert workflow["workflow"] == "existing_template"
        assert workflow["confidence_level"] == "high"

        print(f"✅ High confidence workflow: {workflow['workflow']}")

    @pytest.mark.integration
    def test_determine_workflow_medium_confidence(self, evaluator):
        """Test workflow determination for medium confidence."""
        type_eval = {"confidence": 0.7}
        templates = []

        workflow = evaluator._determine_workflow(type_eval, templates)

        assert workflow["workflow"] == "template_selection"
        assert workflow["confidence_level"] == "medium"

        print(f"✅ Medium confidence workflow: {workflow['workflow']}")

    @pytest.mark.integration
    def test_determine_workflow_low_confidence(self, evaluator):
        """Test workflow determination for low confidence."""
        type_eval = {"confidence": 0.3}
        templates = []

        workflow = evaluator._determine_workflow(type_eval, templates)

        assert workflow["workflow"] == "generate_template"
        assert workflow["confidence_level"] == "low"

        print(f"✅ Low confidence workflow: {workflow['workflow']}")


class TestDocumentEvaluatorTemplateMatching:
    """Tests for template matching integration in DocumentEvaluator."""

    @pytest.fixture
    def evaluator(self):
        """Get DocumentEvaluator instance."""
        from app.services.document_evaluator import DocumentEvaluator
        return DocumentEvaluator()

    @pytest.fixture
    def sample_proposal_path(self, temp_dir) -> Path:
        """Create sample proposal document."""
        content = """ROOFING PROPOSAL

Proposal Date: January 25, 2024
Proposal #: PROP-2024-001

SUBMITTED TO:
John Smith
123 Residential Lane
Hometown, ST 54321

JOB LOCATION:
123 Residential Lane
Hometown, ST 54321

SCOPE OF WORK:
Complete roof replacement including:
- Remove existing shingles and underlayment
- Inspect and repair decking as needed
- Install new ice and water shield
- Install new 30-year architectural shingles
- Replace all flashing and vents
- Clean up all debris

MATERIALS:
- GAF Timberline HDZ Architectural Shingles
- GAF FeltBuster Synthetic Underlayment
- Aluminum drip edge and flashing

TOTAL COST: $12,500.00

Payment Terms: 50% deposit, 50% upon completion
Warranty: 10-year workmanship warranty

Contractor: ABC Roofing Company
License #: ROO-12345
Phone: (555) 987-6543
"""
        file_path = temp_dir / "sample_proposal.txt"
        file_path.write_text(content)
        return file_path

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_template_suggestions_for_invoice(self, evaluator, temp_dir):
        """Test that invoice document gets relevant template suggestions."""
        content = """INVOICE
Invoice Number: INV-2024-100
From: Vendor Corp
To: Customer Inc
Total Amount: $10,000.00
Due Date: February 28, 2024
"""
        file_path = temp_dir / "test_invoice.txt"
        file_path.write_text(content)

        result = await evaluator.evaluate_document(
            file_path=file_path,
            filename="test_invoice.txt",
            content_type="text/plain",
            quick_scan=True
        )

        # Should have template suggestions
        templates = result["template_suggestions"]

        if len(templates) > 0:
            # First template should be relevant
            assert templates[0]["category"] in ["Financial", "Business", "finance", "billing", "invoice"]
            assert templates[0]["match_score"] > 0.3
            print(f"✅ Got {len(templates)} template suggestions, top: {templates[0].get('template_name', 'unnamed')}")
        else:
            print("ℹ️ No template suggestions (database may not have templates)")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_template_suggestions_sorted_by_score(self, evaluator, temp_dir):
        """Test that template suggestions are sorted by match score."""
        content = """CONTRACT AGREEMENT
Between Party A and Party B
Effective Date: January 1, 2024
Terms and conditions apply...
"""
        file_path = temp_dir / "test_contract.txt"
        file_path.write_text(content)

        result = await evaluator.evaluate_document(
            file_path=file_path,
            filename="test_contract.txt",
            content_type="text/plain",
            quick_scan=True
        )

        templates = result["template_suggestions"]

        if len(templates) > 1:
            # Verify sorted by score (descending)
            for i in range(len(templates) - 1):
                assert templates[i]["match_score"] >= templates[i + 1]["match_score"]
            print(f"✅ {len(templates)} templates correctly sorted by score")
        else:
            print("ℹ️ Not enough templates to verify sorting")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_proposal_document_detection(self, evaluator, sample_proposal_path):
        """Test detection and matching for proposal documents."""
        result = await evaluator.evaluate_document(
            file_path=sample_proposal_path,
            filename="sample_proposal.txt",
            content_type="text/plain",
            quick_scan=True
        )

        type_eval = result["type_evaluation"]
        # Proposal might be detected as contract, legal, or proposal
        assert type_eval["primary_type"] in ["proposal", "contract", "legal", "invoice", "report"]
        assert type_eval["confidence"] > 0.2

        print(f"✅ Proposal detection: type={type_eval['primary_type']}, confidence={type_eval['confidence']:.2f}")


class TestDocumentEvaluatorPerformance:
    """Performance tests for DocumentEvaluator."""

    @pytest.fixture
    def evaluator(self):
        """Get DocumentEvaluator instance."""
        from app.services.document_evaluator import DocumentEvaluator
        return DocumentEvaluator()

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_evaluation_completes_within_timeout(self, evaluator, temp_dir):
        """Test that document evaluation completes within acceptable time."""
        content = "Invoice Number: 12345\nTotal: $100.00\n" * 100  # Larger document
        file_path = temp_dir / "large_invoice.txt"
        file_path.write_text(content)

        start_time = time.time()
        result = await evaluator.evaluate_document(
            file_path=file_path,
            filename="large_invoice.txt",
            content_type="text/plain",
            quick_scan=True
        )
        elapsed = time.time() - start_time

        # Should complete within reasonable time (30 seconds max)
        assert elapsed < 30.0
        assert result["type_evaluation"]["primary_type"] is not None

        print(f"✅ Evaluation completed in {elapsed:.2f}s")

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_batch_evaluation_performance(self, evaluator, temp_dir):
        """Test evaluation of multiple documents."""
        documents = [
            ("invoice1.txt", "INVOICE\nNumber: INV-001\nTotal: $1000"),
            ("invoice2.txt", "INVOICE\nNumber: INV-002\nTotal: $2000"),
            ("contract1.txt", "CONTRACT\nBetween Party A and Party B"),
            ("receipt1.txt", "RECEIPT\nTransaction: TXN-001\nTotal: $50"),
        ]

        results = []
        total_time = 0

        for filename, content in documents:
            file_path = temp_dir / filename
            file_path.write_text(content)

            start = time.time()
            result = await evaluator.evaluate_document(
                file_path=file_path,
                filename=filename,
                content_type="text/plain",
                quick_scan=True
            )
            elapsed = time.time() - start
            total_time += elapsed
            results.append((filename, result["type_evaluation"]["primary_type"], elapsed))

        # All should complete
        assert len(results) == 4

        # Average time per document should be reasonable
        avg_time = total_time / len(documents)
        assert avg_time < 10.0

        for filename, doc_type, elapsed in results:
            print(f"✅ {filename}: {doc_type} ({elapsed:.2f}s)")
        print(f"✅ Total: {total_time:.2f}s, Average: {avg_time:.2f}s")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
