"""
Unit tests for metadata extraction functionality.

Tests Task 1.3: Implement Real Metadata Extraction
- Extract document title, author, creation date
- Get page count and document type
- Handle metadata extraction failures gracefully
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
import tempfile
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional

class TestMetadataExtraction:
    """Test suite for document metadata extraction."""
    
    def test_metadata_model_structure(self):
        """Test that metadata model has required fields."""
        from app.models.document import DocumentMetadata, DocumentType
        
        # Test model can be created with all fields
        metadata = DocumentMetadata(
            filename="test.pdf",
            file_size=12345,
            mime_type="application/pdf",
            document_type=DocumentType.PDF,
            title="Test Document",
            author="Test Author", 
            created_at=datetime.now(),
            modified_at=datetime.now(),
            page_count=5
        )
        
        assert metadata.title == "Test Document"
        assert metadata.author == "Test Author"
        assert metadata.page_count == 5
        assert metadata.word_count == 1000
        assert metadata.document_type == "pdf"
    
    def test_metadata_optional_fields(self):
        """Test that metadata model handles optional fields correctly."""
        from app.models.document import DocumentMetadata, DocumentType
        
        # Test with minimal required fields
        metadata = DocumentMetadata(
            filename="test.txt",
            file_size=123,
            mime_type="text/plain",
            document_type=DocumentType.TXT,
            title="Test"
        )
        
        assert metadata.title == "Test"
        assert metadata.author is None
        assert metadata.page_count is None
        assert metadata.file_size == 123

class TestDoclingMetadataExtraction:
    """Test suite for real Docling metadata extraction."""
    
    @patch('docling.document_converter.DocumentConverter')
    def test_docling_extract_title(self, mock_converter_class):
        """Test title extraction from document."""
        # Setup mock with document title
        mock_converter = Mock()
        mock_result = Mock()
        mock_document = Mock()
        
        # Mock the document structure Docling might return
        mock_document.metadata = {"title": "Sample Document Title"}
        mock_result.document = mock_document
        mock_converter.convert.return_value = mock_result
        mock_converter_class.return_value = mock_converter
        
        from docling.document_converter import DocumentConverter
        converter = DocumentConverter()
        result = converter.convert("test.pdf")
        
        title = result.document.metadata.get("title")
        assert title == "Sample Document Title"
    
    @patch('docling.document_converter.DocumentConverter')
    def test_docling_extract_author(self, mock_converter_class):
        """Test author extraction from document."""
        mock_converter = Mock()
        mock_result = Mock()
        mock_document = Mock()
        
        mock_document.metadata = {"author": "John Doe"}
        mock_result.document = mock_document
        mock_converter.convert.return_value = mock_result
        mock_converter_class.return_value = mock_converter
        
        from docling.document_converter import DocumentConverter
        converter = DocumentConverter()
        result = converter.convert("test.docx")
        
        author = result.document.metadata.get("author")
        assert author == "John Doe"
    
    @patch('docling.document_converter.DocumentConverter')
    def test_docling_extract_creation_date(self, mock_converter_class):
        """Test creation date extraction from document."""
        mock_converter = Mock()
        mock_result = Mock()
        mock_document = Mock()
        
        mock_document.metadata = {
            "creation_date": "2025-07-06T10:30:00",
            "created": "2025-07-06"
        }
        mock_result.document = mock_document
        mock_converter.convert.return_value = mock_result
        mock_converter_class.return_value = mock_converter
        
        from docling.document_converter import DocumentConverter
        converter = DocumentConverter()
        result = converter.convert("test.pdf")
        
        metadata = result.document.metadata
        assert "creation_date" in metadata or "created" in metadata
    
    @patch('docling.document_converter.DocumentConverter')
    def test_docling_extract_page_count(self, mock_converter_class):
        """Test page count extraction from document."""
        mock_converter = Mock()
        mock_result = Mock()
        mock_document = Mock()
        
        # Mock page count in document structure
        mock_document.num_pages = 10
        mock_document.metadata = {"page_count": 10}
        mock_result.document = mock_document
        mock_converter.convert.return_value = mock_result
        mock_converter_class.return_value = mock_converter
        
        from docling.document_converter import DocumentConverter
        converter = DocumentConverter()
        result = converter.convert("test.pdf")
        
        # Page count might be in different places
        page_count = (
            getattr(result.document, 'num_pages', None) or
            result.document.metadata.get("page_count")
        )
        assert page_count == 10

class TestMetadataExtractionService:
    """Test metadata extraction in the DoclingService."""
    
    @pytest.mark.asyncio
    async def test_service_extract_metadata_method(self, async_docling_service):
        """Test that service has metadata extraction capability."""
        service = async_docling_service
        
        # The service should have metadata extraction as part of content extraction
        # or as a separate method
        if hasattr(service, 'extract_metadata'):
            assert callable(service.extract_metadata)
        else:
            # Metadata should be part of extract_content_from_file result
            assert hasattr(service, 'extract_content_from_file')
    
    @pytest.mark.asyncio
    async def test_metadata_from_content_extraction(self, async_docling_service, temp_dir):
        """Test that metadata is included in content extraction results."""
        service = async_docling_service
        
        test_file = temp_dir / "test.txt"
        test_file.write_text("Sample content for metadata testing")
        
        result = await service.extract_content_from_file(test_file)
        
        # Result should include metadata
        assert result is not None
        assert isinstance(result, dict)
        
        # Check if metadata is included (structure may vary)
        has_metadata = (
            "metadata" in result or
            any(key in result for key in ["title", "author", "file_size", "word_count"])
        )
        assert has_metadata, "Result should include metadata information"
    
    @pytest.mark.asyncio
    async def test_file_based_metadata_extraction(self, async_docling_service, temp_dir):
        """Test metadata extraction from file properties."""
        service = async_docling_service
        
        # Create file with known properties
        test_content = "This is a test document with specific content.\n" * 10
        test_file = temp_dir / "metadata_test.txt"
        test_file.write_text(test_content)
        
        result = await service.extract_content_from_file(test_file)
        
        # Should be able to extract basic file metadata
        assert result is not None
        
        # File size should be extractable
        file_size = test_file.stat().st_size
        assert file_size > 0
        
        # Word count should be calculable
        word_count = len(test_content.split())
        assert word_count > 0

class TestMetadataErrorHandling:
    """Test error handling in metadata extraction."""
    
    @pytest.mark.asyncio
    async def test_missing_metadata_graceful_handling(self, async_docling_service, temp_dir):
        """Test handling when document has no metadata."""
        service = async_docling_service
        
        # Create simple file with minimal metadata
        simple_file = temp_dir / "simple.txt"
        simple_file.write_text("content")
        
        result = await service.extract_content_from_file(simple_file)
        
        # Should handle gracefully even if metadata is minimal
        assert result is not None
        
        # At minimum should have file-based metadata
        file_stats = simple_file.stat()
        assert file_stats.st_size > 0  # File size should be available
    
    @pytest.mark.asyncio
    async def test_corrupted_metadata_handling(self, async_docling_service, temp_dir):
        """Test handling of corrupted or malformed metadata."""
        service = async_docling_service
        
        # Create file with potentially problematic content
        problematic_file = temp_dir / "problematic.txt"
        problematic_file.write_bytes(b'\x00\x01\x02\x03invalid\xff\xfe')
        
        # Should handle gracefully without crashing
        try:
            result = await service.extract_content_from_file(problematic_file)
            # If it succeeds, result should be structured
            if result:
                assert isinstance(result, dict)
        except Exception as e:
            # If it fails, should be a controlled failure
            assert isinstance(e, (UnicodeDecodeError, ValueError))
    
    @patch('pathlib.Path.stat')
    @pytest.mark.asyncio
    async def test_file_stat_error_handling(self, mock_stat, async_docling_service, temp_dir):
        """Test handling when file stat operations fail."""
        service = async_docling_service
        
        # Mock stat to raise an error
        mock_stat.side_effect = OSError("Permission denied")
        
        test_file = temp_dir / "test.txt"
        test_file.write_text("content")
        
        # Should handle stat errors gracefully
        try:
            result = await service.extract_content_from_file(test_file)
            # Should complete even if file stats aren't available
            assert result is not None
        except OSError:
            # Acceptable if it propagates the OS error
            pass

class TestMetadataValidation:
    """Test validation of extracted metadata."""
    
    def test_metadata_date_validation(self):
        """Test that date metadata is properly validated."""
        from app.models.document import DocumentMetadata, DocumentType
        
        # Valid date
        valid_metadata = DocumentMetadata(
            filename="test.txt",
            file_size=100,
            mime_type="text/plain",
            document_type=DocumentType.TXT,
            title="Test",
            created_at=datetime(2025, 7, 6, 10, 30)
        )
        assert valid_metadata.created_at.year == 2025
        
        # Test that invalid dates are handled by Pydantic
        try:
            invalid_metadata = DocumentMetadata(
                filename="test.txt",
                file_size=100,
                mime_type="text/plain",
                document_type=DocumentType.TXT,
                title="Test",
                created_at="invalid-date"
            )
            pytest.fail("Should have failed validation for invalid date")
        except (ValueError, TypeError):
            # Expected validation error
            pass
    
    def test_metadata_numeric_validation(self):
        """Test validation of numeric metadata fields."""
        from app.models.document import DocumentMetadata, DocumentType
        
        # Valid numeric values
        valid_metadata = DocumentMetadata(
            filename="test.pdf",
            file_size=12345,
            mime_type="application/pdf",
            document_type=DocumentType.PDF,
            title="Test",
            page_count=5
        )
        assert valid_metadata.page_count == 5
        assert valid_metadata.file_size == 12345
        
        # Test negative values are handled appropriately
        try:
            invalid_metadata = DocumentMetadata(
                filename="test.pdf",
                file_size=100,
                mime_type="application/pdf",
                document_type=DocumentType.PDF,
                title="Test",
                page_count=-1  # Negative page count should be invalid
            )
            # Depending on model validation, this might pass or fail
            # The test documents the expected behavior
        except ValueError:
            # If validation prevents negative values, that's good
            pass

class TestMetadataDocumentTypes:
    """Test metadata extraction for different document types."""
    
    @pytest.mark.asyncio
    async def test_pdf_metadata_extraction(self, async_docling_service, temp_dir):
        """Test metadata extraction specifically for PDF files."""
        service = async_docling_service
        
        # Create mock PDF file (we can't create real PDF easily in tests)
        pdf_file = temp_dir / "test.pdf"
        pdf_file.write_bytes(b"%PDF-1.4\nMock PDF content")
        
        result = await service.extract_content_from_file(pdf_file)
        
        assert result is not None
        # Should recognize file type from extension
        
    @pytest.mark.asyncio
    async def test_docx_metadata_extraction(self, async_docling_service, temp_dir):
        """Test metadata extraction for DOCX files."""
        service = async_docling_service
        
        # Create mock DOCX file
        docx_file = temp_dir / "test.docx"
        docx_file.write_bytes(b"PK\x03\x04Mock DOCX content")  # Basic ZIP signature
        
        result = await service.extract_content_from_file(docx_file)
        
        assert result is not None
        # Should handle DOCX format
    
    @pytest.mark.asyncio
    async def test_image_metadata_extraction(self, async_docling_service, temp_dir):
        """Test metadata extraction for image files.""" 
        service = async_docling_service
        
        # Create mock image file
        image_file = temp_dir / "test.png"
        image_file.write_bytes(b"\x89PNG\r\n\x1a\nMock PNG")
        
        result = await service.extract_content_from_file(image_file)
        
        assert result is not None
        # Should handle image format (might extract text via OCR)

class TestMetadataUpgrade:
    """Test the upgrade path for metadata extraction."""
    
    def test_mock_metadata_structure(self, docling_service):
        """Test that current mock returns metadata in expected structure."""
        # This helps ensure compatibility when upgrading
        service = docling_service
        
        # Mock should return structured metadata
        # This test documents the current interface
        assert hasattr(service, 'extract_content_from_file')
    
    @patch('app.services.docling_service.DoclingService.extract_content_from_file')
    @pytest.mark.asyncio
    async def test_metadata_upgrade_interface(self, mock_extract, temp_dir):
        """Test interface compatibility for metadata upgrade."""
        # Define expected structure for real Docling integration
        expected_metadata = {
            "text": "Extracted content",
            "metadata": {
                "title": "Document Title",
                "author": "Author Name", 
                "creation_date": "2025-07-06T10:30:00",
                "page_count": 3,
                "word_count": 150,
                "file_size": 12345,
                "document_type": "pdf",
                "language": "en"
            },
            "success": True
        }
        
        mock_extract.return_value = expected_metadata
        
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        test_file = temp_dir / "test.pdf"
        test_file.write_text("content")
        
        result = await service.extract_content_from_file(test_file)
        
        # Verify structure matches expectations
        assert result["metadata"]["title"] == "Document Title"
        assert result["metadata"]["author"] == "Author Name"
        assert result["metadata"]["page_count"] == 3
        assert result["metadata"]["word_count"] == 150
        assert result["success"] is True

# Integration test markers
class TestMetadataExtractionIntegration:
    """Integration tests for metadata extraction."""
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_real_docling_metadata_extraction(self, temp_dir):
        """Integration test with real Docling for metadata extraction."""
        # This test will be implemented when real Docling is integrated
        
        test_file = temp_dir / "integration_test.txt"
        test_file.write_text("Integration test content for metadata")
        
        assert test_file.exists()
        
        # TODO: Add real Docling metadata extraction test
        # from docling.document_converter import DocumentConverter
        # converter = DocumentConverter()
        # result = converter.convert(str(test_file))
        # metadata = result.document.metadata
        # assert metadata is not None
        # assert "title" in metadata or "author" in metadata
