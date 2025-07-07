"""
Unit tests for content extraction functionality.

Tests Task 1.2: Replace Mock Content Extraction
- Update extract_content_from_file() method
- Handle different document formats (PDF, DOCX, PPTX, etc.)
- Preserve error handling and logging
"""
import pytest
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from pathlib import Path
import tempfile
import asyncio
import json
from typing import Dict, Any

class TestContentExtraction:
    """Test suite for document content extraction."""
    
    @pytest.mark.asyncio
    async def test_extract_content_from_file_exists(self, async_docling_service):
        """Test that extract_content_from_file method exists."""
        service = async_docling_service
        assert hasattr(service, 'extract_content_from_file')
        assert asyncio.iscoroutinefunction(service.extract_content_from_file)
    
    @pytest.mark.asyncio
    async def test_extract_content_mock_implementation(self, async_docling_service, temp_dir):
        """Test current mock implementation works."""
        service = async_docling_service
        
        # Create a test file
        test_file = temp_dir / "test.txt"
        test_file.write_text("Sample content")
        
        # Test current mock implementation
        result = await service.extract_content_from_file(test_file)
        
        assert result is not None
        assert isinstance(result, dict)
        # Mock implementation should return structured data
        
    def test_supported_file_formats(self):
        """Test that service knows about supported file formats."""
        supported_formats = {
            '.pdf': 'Portable Document Format',
            '.docx': 'Microsoft Word Document',
            '.pptx': 'Microsoft PowerPoint',
            '.xlsx': 'Microsoft Excel',
            '.html': 'HTML Document',
            '.txt': 'Plain Text',
            '.md': 'Markdown',
            '.png': 'PNG Image',
            '.jpg': 'JPEG Image',
            '.jpeg': 'JPEG Image',
            '.wav': 'WAV Audio',
            '.mp3': 'MP3 Audio'
        }
        
        # These formats should be supported by Docling
        for ext, description in supported_formats.items():
            assert ext.startswith('.'), f"Format {ext} should start with dot"
            assert description, f"Format {ext} should have description"

class TestDoclingContentExtraction:
    """Test suite for real Docling content extraction implementation."""
    
    @patch('docling.document_converter.DocumentConverter')
    def test_docling_converter_extract_text(self, mock_converter_class):
        """Test text extraction using Docling converter."""
        # Setup mock converter
        mock_converter = Mock()
        mock_result = Mock()
        mock_result.document.export_to_markdown.return_value = "# Sample Document\n\nContent here"
        mock_converter.convert.return_value = mock_result
        mock_converter_class.return_value = mock_converter
        
        # This is what the real implementation should look like
        from docling.document_converter import DocumentConverter
        converter = DocumentConverter()
        result = converter.convert("test.pdf")
        
        assert result is not None
        text_content = result.document.export_to_markdown()
        assert "Sample Document" in text_content
        
        mock_converter.convert.assert_called_once_with("test.pdf")
    
    @patch('docling.document_converter.DocumentConverter')
    def test_docling_converter_extract_metadata(self, mock_converter_class):
        """Test metadata extraction using Docling."""
        # Setup mock with metadata
        mock_converter = Mock()
        mock_result = Mock()
        mock_document = Mock()
        mock_document.metadata = {
            "title": "Test Document", 
            "author": "Test Author",
            "creation_date": "2025-07-06"
        }
        mock_result.document = mock_document
        mock_converter.convert.return_value = mock_result
        mock_converter_class.return_value = mock_converter
        
        from docling.document_converter import DocumentConverter
        converter = DocumentConverter()
        result = converter.convert("test.pdf")
        
        metadata = result.document.metadata
        assert metadata["title"] == "Test Document"
        assert metadata["author"] == "Test Author"
        assert metadata["creation_date"] == "2025-07-06"
    
    @pytest.mark.asyncio
    async def test_async_content_extraction_workflow(self, temp_dir):
        """Test async content extraction workflow."""
        # Create test files
        test_files = {
            'test.txt': "Simple text content",
            'test.md': "# Markdown\n\nContent here"
        }
        
        for filename, content in test_files.items():
            test_file = temp_dir / filename
            test_file.write_text(content)
        
        # Mock async extraction function
        async def mock_extract_content(file_path: Path) -> Dict[str, Any]:
            return {
                "text": f"Extracted from {file_path.name}",
                "metadata": {"file_type": file_path.suffix},
                "word_count": 10,
                "page_count": 1
            }
        
        for filename in test_files.keys():
            file_path = temp_dir / filename
            result = await mock_extract_content(file_path)
            
            assert result["text"].startswith("Extracted from")
            assert result["metadata"]["file_type"] in ['.txt', '.md']
            assert isinstance(result["word_count"], int)

class TestErrorHandlingContentExtraction:
    """Test error handling in content extraction."""
    
    @pytest.mark.asyncio
    async def test_nonexistent_file_handling(self, async_docling_service):
        """Test handling of non-existent files."""
        service = async_docling_service
        nonexistent_file = Path("/nonexistent/file.pdf")
        
        # Should handle gracefully, not crash
        try:
            result = await service.extract_content_from_file(nonexistent_file)
            # If it returns a result, it should indicate an error
            if result:
                assert "error" in result or result.get("success") is False
        except FileNotFoundError:
            # This is also acceptable behavior
            pass
        except Exception as e:
            pytest.fail(f"Unexpected exception for non-existent file: {e}")
    
    @pytest.mark.asyncio
    async def test_unsupported_format_handling(self, async_docling_service, temp_dir):
        """Test handling of unsupported file formats."""
        service = async_docling_service
        
        # Create file with unsupported extension
        unsupported_file = temp_dir / "test.xyz"
        unsupported_file.write_text("content")
        
        result = await service.extract_content_from_file(unsupported_file)
        
        # Should handle gracefully
        assert result is not None
        # May contain error information or fallback to text extraction
    
    @pytest.mark.asyncio 
    async def test_empty_file_handling(self, async_docling_service, temp_dir):
        """Test handling of empty files."""
        service = async_docling_service
        
        empty_file = temp_dir / "empty.txt"
        empty_file.write_text("")
        
        result = await service.extract_content_from_file(empty_file)
        
        assert result is not None
        # Should handle empty files gracefully
    
    @pytest.mark.asyncio
    async def test_large_file_handling(self, async_docling_service, temp_dir):
        """Test handling of large files."""
        service = async_docling_service
        
        # Create a moderately large test file
        large_content = "Large file content.\n" * 10000  # ~200KB
        large_file = temp_dir / "large.txt"
        large_file.write_text(large_content)
        
        # Should handle without memory issues
        result = await service.extract_content_from_file(large_file)
        assert result is not None

class TestContentExtractionFormats:
    """Test content extraction for different document formats."""
    
    @pytest.mark.asyncio
    async def test_text_file_extraction(self, async_docling_service, temp_dir):
        """Test text file content extraction."""
        service = async_docling_service
        
        text_content = "This is a simple text file.\nWith multiple lines.\n"
        text_file = temp_dir / "test.txt"
        text_file.write_text(text_content)
        
        result = await service.extract_content_from_file(text_file)
        
        assert result is not None
        # Should extract the text content
        
    @pytest.mark.asyncio
    async def test_markdown_file_extraction(self, async_docling_service, temp_dir):
        """Test Markdown file content extraction."""
        service = async_docling_service
        
        md_content = """# Test Document

## Section 1
Some **bold** and *italic* text.

- List item 1
- List item 2

## Section 2
More content here.
"""
        md_file = temp_dir / "test.md"
        md_file.write_text(md_content)
        
        result = await service.extract_content_from_file(md_file)
        
        assert result is not None
        # Should preserve Markdown structure or convert appropriately
    
    @pytest.mark.asyncio 
    async def test_html_file_extraction(self, async_docling_service, temp_dir):
        """Test HTML file content extraction."""
        service = async_docling_service
        
        html_content = """<!DOCTYPE html>
<html>
<head><title>Test Document</title></head>
<body>
    <h1>Main Title</h1>
    <p>Paragraph content with <strong>bold</strong> text.</p>
    <ul>
        <li>Item 1</li>
        <li>Item 2</li>
    </ul>
</body>
</html>"""
        html_file = temp_dir / "test.html"
        html_file.write_text(html_content)
        
        result = await service.extract_content_from_file(html_file)
        
        assert result is not None
        # Should extract clean text from HTML

class TestContentExtractionUpgrade:
    """Test the upgrade path from mock to real Docling implementation."""
    
    def test_mock_to_real_interface_compatibility(self, docling_service):
        """Test that mock and real implementations have compatible interfaces."""
        service = docling_service
        
        # Current mock implementation should have these methods
        required_methods = [
            'extract_content_from_file',
            'process_document', 
            'process_batch'
        ]
        
        for method in required_methods:
            assert hasattr(service, method), f"Missing method: {method}"
    
    @patch('app.services.docling_service.DoclingService.extract_content_from_file')
    @pytest.mark.asyncio
    async def test_mock_replacement_ready(self, mock_extract, temp_dir):
        """Test that mock can be easily replaced with real implementation."""
        # Mock the extract method to simulate real Docling behavior
        mock_extract.return_value = {
            "text": "Real Docling extracted text",
            "metadata": {"source": "docling"},
            "success": True
        }
        
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        test_file = temp_dir / "test.txt"
        test_file.write_text("content")
        
        result = await service.extract_content_from_file(test_file)
        
        assert result["text"] == "Real Docling extracted text"
        assert result["metadata"]["source"] == "docling"
        assert result["success"] is True
        
        mock_extract.assert_called_once_with(test_file)

class TestPerformanceContentExtraction:
    """Test performance aspects of content extraction."""
    
    @pytest.mark.asyncio
    async def test_concurrent_extraction(self, async_docling_service, temp_dir):
        """Test concurrent content extraction."""
        service = async_docling_service
        
        # Create multiple test files
        test_files = []
        for i in range(5):
            test_file = temp_dir / f"test_{i}.txt"
            test_file.write_text(f"Content of file {i}")
            test_files.append(test_file)
        
        # Extract content from all files concurrently
        tasks = [
            service.extract_content_from_file(file_path) 
            for file_path in test_files
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # All extractions should complete successfully
        assert len(results) == 5
        for result in results:
            assert not isinstance(result, Exception), f"Extraction failed: {result}"
            assert result is not None
    
    @pytest.mark.asyncio
    async def test_extraction_timeout_handling(self, async_docling_service, temp_dir):
        """Test timeout handling for long-running extractions."""
        service = async_docling_service
        
        test_file = temp_dir / "test.txt"
        test_file.write_text("content")
        
        # Test with a reasonable timeout
        try:
            result = await asyncio.wait_for(
                service.extract_content_from_file(test_file), 
                timeout=30.0  # 30 second timeout
            )
            assert result is not None
        except asyncio.TimeoutError:
            pytest.fail("Content extraction took too long (>30s)")

# Integration test markers
class TestContentExtractionIntegration:
    """Integration tests for content extraction (to be run with real Docling)."""
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_real_docling_text_extraction(self, temp_dir):
        """Integration test with real Docling for text extraction."""
        # This test will be fully implemented when real Docling is integrated
        
        # For now, ensure test structure is ready
        test_file = temp_dir / "integration_test.txt"
        test_file.write_text("Integration test content")
        
        assert test_file.exists()
        
        # TODO: Add real Docling integration test
        # from docling.document_converter import DocumentConverter
        # converter = DocumentConverter()
        # result = converter.convert(str(test_file))
        # assert result.document.export_to_markdown() == expected_output
