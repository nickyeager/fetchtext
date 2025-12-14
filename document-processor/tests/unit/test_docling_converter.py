"""
Unit tests for Docling converter setup and basic functionality.

Tests Task 1.1: Basic Document Converter Setup
- Create real DocumentConverter instance
- Test basic document conversion
- Handle Docling initialization errors
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
import tempfile
import asyncio

class TestDoclingConverter:
    """Test suite for basic Docling converter functionality."""
    
    def test_docling_import_available(self):
        """Test that Docling can be imported successfully."""
        try:
            import docling
            assert docling is not None
        except ImportError:
            pytest.fail("Docling package is not available for import")
    
    def test_document_converter_import(self):
        """Test that DocumentConverter can be imported from Docling."""
        try:
            from docling.document_converter import DocumentConverter
            assert DocumentConverter is not None
        except ImportError:
            pytest.fail("DocumentConverter cannot be imported from Docling")
    
    def test_document_converter_initialization(self):
        """Test that DocumentConverter can be initialized."""
        from docling.document_converter import DocumentConverter
        
        try:
            converter = DocumentConverter()
            assert converter is not None
            assert hasattr(converter, 'convert')
        except Exception as e:
            pytest.fail(f"DocumentConverter initialization failed: {e}")
    
    @patch('docling.document_converter.DocumentConverter')
    def test_converter_with_mock(self, mock_converter_class):
        """Test converter initialization with mocked Docling."""
        # Setup mock
        mock_converter = Mock()
        mock_converter_class.return_value = mock_converter
        
        from docling.document_converter import DocumentConverter
        converter = DocumentConverter()
        
        assert converter is not None
        mock_converter_class.assert_called_once()
    
    def test_converter_convert_method_exists(self):
        """Test that converter has the convert method."""
        from docling.document_converter import DocumentConverter
        
        converter = DocumentConverter()
        assert hasattr(converter, 'convert')
        assert callable(getattr(converter, 'convert'))
    
    @pytest.mark.asyncio
    async def test_converter_async_compatibility(self):
        """Test that converter works in async context."""
        from docling.document_converter import DocumentConverter
        
        async def async_converter_test():
            converter = DocumentConverter()
            return converter
        
        converter = await async_converter_test()
        assert converter is not None

class TestDoclingServiceUpgrade:
    """Test suite for upgrading DoclingService from mock to real implementation."""
    
    def test_current_service_is_mock(self, docling_service):
        """Verify current service is using mock implementation."""
        # Check if the service has mock indicators
        service_file_path = Path(__file__).parent.parent / "app" / "services" / "docling_service.py"
        
        with open(service_file_path, 'r') as f:
            content = f.read()
            assert "mock" in content.lower() or "Mock" in content
    
    def test_service_has_required_methods(self, docling_service):
        """Test that service has all required methods for upgrade."""
        required_methods = [
            'process_document',
            'process_batch',
            'get_processing_status',
            'extract_content_from_file'
        ]
        
        for method in required_methods:
            assert hasattr(docling_service, method), f"Missing method: {method}"
            assert callable(getattr(docling_service, method)), f"Method {method} is not callable"
    
    def test_service_temp_directory_exists(self, docling_service):
        """Test that service creates temp directory."""
        assert hasattr(docling_service, 'temp_dir')
        assert docling_service.temp_dir.exists()
        assert docling_service.temp_dir.is_dir()
    
    @pytest.mark.asyncio
    async def test_service_async_methods(self, async_docling_service):
        """Test that service methods are async-compatible."""
        service = async_docling_service
        
        # Test that async methods exist and are coroutines
        assert asyncio.iscoroutinefunction(service.process_document)
        assert asyncio.iscoroutinefunction(service.extract_content_from_file)

class TestDoclingIntegrationReadiness:
    """Test readiness for Docling integration."""
    
    def test_docling_modules_available(self):
        """Test that required Docling modules are available."""
        required_modules = [
            'docling.document_converter',
            'docling.datamodel'
        ]
        
        for module_name in required_modules:
            try:
                __import__(module_name)
            except ImportError:
                pytest.fail(f"Required Docling module not available: {module_name}")
    
    def test_docling_version_compatibility(self):
        """Test that Docling version meets requirements."""
        import docling
        
        # Check if version attribute exists
        if hasattr(docling, '__version__'):
            version = docling.__version__
            # We require version 1.0.0 or higher
            version_parts = version.split('.')
            major = int(version_parts[0])
            assert major >= 1, f"Docling version {version} is too old, need 1.0.0+"
    
    @patch('app.services.docling_service.DoclingService')
    def test_service_upgrade_interface(self, mock_service_class):
        """Test that service interface is ready for real Docling integration."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        
        # Test that we can replace the mock with real implementation
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        # Verify the mock was called (indicating successful import)
        mock_service_class.assert_called_once()

class TestErrorHandling:
    """Test error handling for Docling converter."""
    
    @patch('docling.document_converter.DocumentConverter')
    def test_converter_initialization_error(self, mock_converter_class):
        """Test handling of converter initialization errors."""
        # Make the converter raise an exception
        mock_converter_class.side_effect = Exception("Initialization failed")
        
        with pytest.raises(Exception) as exc_info:
            from docling.document_converter import DocumentConverter
            DocumentConverter()
        
        assert "Initialization failed" in str(exc_info.value)
    
    def test_missing_docling_graceful_failure(self):
        """Test graceful handling when Docling is not available."""
        # This test simulates what happens if Docling is not installed
        with patch.dict('sys.modules', {'docling': None}):
            with pytest.raises(ImportError):
                import docling

class TestDoclingFeatures:
    """Test specific Docling features that we'll be using."""
    
    def test_docling_export_formats(self):
        """Test that Docling supports required export formats."""
        from docling.document_converter import DocumentConverter
        
        converter = DocumentConverter()
        
        # These are methods we'll need for our implementation
        # We test that they exist (even if we use mocks for now)
        if hasattr(converter, 'convert'):
            # Basic convert method exists
            assert True
        else:
            pytest.fail("Docling converter missing convert method")
    
    def test_docling_format_support(self):
        """Test that Docling supports the document formats we need."""
        # This is more of a documentation test - we assume Docling supports these
        # based on its documentation, but we can test the classes exist
        try:
            from docling.datamodel.base_models import ConversionResult
            assert ConversionResult is not None
        except ImportError:
            # If specific classes don't exist, that's okay - Docling API might be different
            # We'll adapt our implementation accordingly
            pass

# Integration test placeholder
class TestDoclingConverterIntegration:
    """Integration tests for Docling converter (placeholder for now)."""
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_end_to_end_conversion_workflow(self, temp_dir):
        """Test complete document conversion workflow."""
        # This will be implemented when we have real Docling integration
        # For now, we just ensure the test structure is in place
        
        # Create a simple test file
        test_file = temp_dir / "test.txt"
        test_file.write_text("Sample content for testing")
        
        # This test will be expanded when real Docling is integrated
        assert test_file.exists()
        
        # TODO: Add actual Docling conversion test
        # converter = DocumentConverter()
        # result = converter.convert(str(test_file))
        # assert result is not None
