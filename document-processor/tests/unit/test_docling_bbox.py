"""Test bounding box extraction from Docling.

Tests for the find_text_positions method in DoclingService that finds
positions of specific text strings in a document and returns bounding box data.
"""
import pytest
from pathlib import Path
import sys

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.docling_service import DoclingService


class TestDoclingBoundingBoxes:
    """Test suite for bounding box extraction from Docling."""

    @pytest.fixture
    def service(self):
        """Create a DoclingService instance for testing."""
        return DoclingService()

    @pytest.fixture
    def sample_invoice_path(self) -> Path:
        """Path to sample invoice text file for testing."""
        return Path(__file__).parent.parent / "fixtures" / "sample_documents" / "sample_invoice.txt"

    @pytest.fixture
    def sample_pdf_path(self) -> Path:
        """Path to sample PDF file for testing (if available)."""
        return Path(__file__).parent.parent / "fixtures" / "sample_documents" / "test_invoice.pdf"

    @pytest.mark.asyncio
    async def test_extract_text_positions_returns_bboxes(self, service, sample_invoice_path):
        """Text positions should include bounding box data when available."""
        if not sample_invoice_path.exists():
            raise FileNotFoundError(f"Required test fixture not found: {sample_invoice_path}")

        result = await service.process_document(
            sample_invoice_path,
            extract_text=True,
            extract_structure=True
        )

        # Should have successful result
        assert result.get("status") == "completed", f"Processing failed: {result.get('error_message')}"

        # Check that content was extracted
        content = result.get("content", {})
        assert content.get("text"), "No text content extracted"

        # For text files, layout_info should have basic structure
        layout_info = content.get("layout_info", {})
        assert "pages" in layout_info or "line_count" in layout_info, "No layout info extracted"

    @pytest.mark.asyncio
    async def test_text_search_returns_positions(self, service, sample_invoice_path):
        """Searching for text should return position data."""
        if not sample_invoice_path.exists():
            raise FileNotFoundError(f"Required test fixture not found: {sample_invoice_path}")

        # Call the new find_text_positions method
        positions = await service.find_text_positions(
            sample_invoice_path,
            search_texts=["Invoice", "Total", "$"]
        )

        # Verify the method returns a list
        assert isinstance(positions, list), "find_text_positions should return a list"

        # Each position should have required fields
        for pos in positions:
            assert "text" in pos, "Position should include 'text' field"
            assert "page" in pos, "Position should include 'page' field"

    @pytest.mark.asyncio
    async def test_find_text_positions_with_pdf(self, service, sample_pdf_path):
        """Find text positions in a PDF should return bounding boxes."""
        if not sample_pdf_path.exists():
            raise FileNotFoundError(f"Required test fixture not found: {sample_pdf_path}")

        positions = await service.find_text_positions(
            sample_pdf_path,
            search_texts=["Invoice", "Total", "$"]
        )

        assert isinstance(positions, list)

        # For PDFs, we expect actual bounding box data
        if positions:
            for pos in positions:
                assert "text" in pos
                assert "page" in pos
                # PDF positions should include bbox when found
                if pos.get("bbox"):
                    bbox = pos["bbox"]
                    assert "x" in bbox
                    assert "y" in bbox
                    assert "width" in bbox
                    assert "height" in bbox

    @pytest.mark.asyncio
    async def test_find_text_positions_returns_element_type(self, service, sample_invoice_path):
        """Position data should include the element type from Docling."""
        if not sample_invoice_path.exists():
            raise FileNotFoundError(f"Required test fixture not found: {sample_invoice_path}")

        positions = await service.find_text_positions(
            sample_invoice_path,
            search_texts=["TechCorp"]
        )

        assert isinstance(positions, list)

        # If we found positions, check for element_type
        if positions:
            for pos in positions:
                assert "element_type" in pos, "Position should include element_type"

    @pytest.mark.asyncio
    async def test_find_text_positions_empty_search(self, service, sample_invoice_path):
        """Empty search texts should return empty list."""
        if not sample_invoice_path.exists():
            raise FileNotFoundError(f"Required test fixture not found: {sample_invoice_path}")

        positions = await service.find_text_positions(
            sample_invoice_path,
            search_texts=[]
        )

        assert isinstance(positions, list)
        assert len(positions) == 0

    @pytest.mark.asyncio
    async def test_find_text_positions_not_found(self, service, sample_invoice_path):
        """Searching for non-existent text should return empty list."""
        if not sample_invoice_path.exists():
            raise FileNotFoundError(f"Required test fixture not found: {sample_invoice_path}")

        positions = await service.find_text_positions(
            sample_invoice_path,
            search_texts=["xyznonexistenttext123"]
        )

        assert isinstance(positions, list)
        assert len(positions) == 0

    @pytest.mark.asyncio
    async def test_find_text_positions_case_insensitive(self, service, sample_invoice_path):
        """Text search should be case-insensitive."""
        if not sample_invoice_path.exists():
            raise FileNotFoundError(f"Required test fixture not found: {sample_invoice_path}")

        # Search with different cases
        positions_lower = await service.find_text_positions(
            sample_invoice_path,
            search_texts=["invoice"]
        )

        positions_upper = await service.find_text_positions(
            sample_invoice_path,
            search_texts=["INVOICE"]
        )

        # Both should find the text
        assert len(positions_lower) > 0, "Should find 'invoice' (lowercase search)"
        assert len(positions_upper) > 0, "Should find 'INVOICE' (uppercase search)"

    @pytest.mark.asyncio
    async def test_find_text_positions_includes_found_context(self, service, sample_invoice_path):
        """Position data should include the text context where the search was found."""
        if not sample_invoice_path.exists():
            raise FileNotFoundError(f"Required test fixture not found: {sample_invoice_path}")

        positions = await service.find_text_positions(
            sample_invoice_path,
            search_texts=["TechCorp"]
        )

        assert isinstance(positions, list)

        # Should find TechCorp and include context
        if positions:
            for pos in positions:
                assert "found_in" in pos, "Position should include 'found_in' context"
                # The found_in should contain relevant context
                if pos.get("found_in"):
                    assert len(pos["found_in"]) > 0
