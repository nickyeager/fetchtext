"""Tests for chunked document extraction."""
import pytest
from app.services.smart_field_extractor import SmartFieldExtractor


class TestChunkedExtraction:
    """Test extraction of long documents using chunking."""

    @pytest.fixture
    def extractor(self):
        return SmartFieldExtractor()

    def test_chunk_document_creates_overlapping_chunks(self, extractor):
        """Should create overlapping chunks for context preservation."""
        # Create a document longer than the chunk size
        long_text = "Section A content. " * 200 + "TARGET VALUE HERE. " + "Section B content. " * 200

        chunks = extractor._chunk_document(long_text, chunk_size=500, overlap=100)

        assert len(chunks) > 1
        # Check overlap - adjacent chunks should share some content
        if len(chunks) >= 2:
            # Verify chunks have content overlap (not necessarily exact due to boundary adjustments)
            # The last part of chunk 0 should contain words that appear at the start of chunk 1
            chunk0_words = set(chunks[0][-150:].split())
            chunk1_words = set(chunks[1][:150].split())
            common_words = chunk0_words & chunk1_words
            assert len(common_words) > 0, "Chunks should have overlapping content"

    def test_chunk_preserves_all_content(self, extractor):
        """Chunking should not lose any content."""
        original = "Word" + " Word" * 1000  # Long document

        chunks = extractor._chunk_document(original, chunk_size=500, overlap=50)

        # All words from original should appear in at least one chunk
        original_words = set(original.split())
        chunk_words = set()
        for chunk in chunks:
            chunk_words.update(chunk.split())

        assert original_words <= chunk_words

    def test_short_document_single_chunk(self, extractor):
        """Short documents should return single chunk."""
        short_text = "This is a short document."

        chunks = extractor._chunk_document(short_text, chunk_size=500, overlap=50)

        assert len(chunks) == 1
        assert chunks[0] == short_text

    def test_merge_chunk_extractions_keeps_highest_confidence(self, extractor):
        """Merging should keep highest confidence value for each field."""
        chunk_results = [
            {"vendor_name": {"value": "Acme", "confidence": 0.6}},
            {"vendor_name": {"value": "Acme Corp", "confidence": 0.95}},
            {"total": {"value": "$100", "confidence": 0.8}},
        ]

        merged = extractor._merge_chunk_extractions(chunk_results)

        assert merged["vendor_name"]["value"] == "Acme Corp"
        assert merged["vendor_name"]["confidence"] == 0.95
        assert merged["total"]["value"] == "$100"

    def test_merge_handles_empty_results(self, extractor):
        """Merging should handle empty chunk results."""
        chunk_results = [
            {},
            {"field_a": {"value": "test", "confidence": 0.7}},
            {},
        ]

        merged = extractor._merge_chunk_extractions(chunk_results)

        assert len(merged) == 1
        assert merged["field_a"]["value"] == "test"

    def test_chunk_raises_on_invalid_params(self, extractor):
        """Should raise ValueError for invalid parameters."""
        with pytest.raises(ValueError, match="chunk_size must be positive"):
            extractor._chunk_document("text", chunk_size=0)

        with pytest.raises(ValueError, match="overlap must be less than chunk_size"):
            extractor._chunk_document("text", chunk_size=100, overlap=100)

        with pytest.raises(ValueError, match="overlap must be non-negative"):
            extractor._chunk_document("text", overlap=-1)

    def test_chunk_empty_text(self, extractor):
        """Should return empty list for empty text."""
        result = extractor._chunk_document("")
        assert result == []

    def test_chunk_boundary_detection_accuracy(self, extractor):
        """Should accurately detect sentence and word boundaries."""
        # Test with clear sentence boundaries
        text = "First sentence. Second sentence. Third sentence."
        chunks = extractor._chunk_document(text, chunk_size=20, overlap=5)

        # Verify chunks are created and don't have truncated words in the middle
        for chunk in chunks:
            assert chunk.strip()  # No empty chunks
            # If chunk ends with a character, it should be a word boundary or punctuation
            if chunks.index(chunk) < len(chunks) - 1:
                assert chunk[-1] in '.!? \n' or len(chunk) < 20

    def test_chunk_no_infinite_loop(self, extractor):
        """Should not enter infinite loop even with edge case parameters."""
        # Very small chunk size with overlap
        text = "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z" * 10
        chunks = extractor._chunk_document(text, chunk_size=10, overlap=5)

        # Should produce a reasonable number of chunks
        assert len(chunks) > 1
        assert len(chunks) < len(text)  # Sanity check - more chunks than input length would indicate infinite loop

        # Verify no chunks are empty or None
        for chunk in chunks:
            assert chunk is not None
            assert len(chunk) > 0

        # Verify the union of all unique characters is preserved (not exact order due to overlaps)
        original_chars = set(text)
        combined_chars = set("".join(chunks))
        assert original_chars == combined_chars
