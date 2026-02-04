"""
Integration tests for Docling service with real Docling installation.

These tests validate the complete Docling integration including:
- Real DocumentConverter functionality
- Document processing workflows
- Error handling and fallbacks
- Performance characteristics
"""
import pytest
import asyncio
import json
from pathlib import Path
import tempfile
from typing import Dict, Any
import aiofiles
import time

class TestDoclingIntegration:
    """Integration tests for real Docling functionality."""
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_real_docling_initialization(self):
        """Test that real Docling can be initialized properly."""
        from app.services.docling_service import DoclingService
        
        service = DoclingService()
        status = await service.get_service_status()
        
        # Verify Docling is available
        assert status["docling_available"] == True
        assert status["docling_version"] is not None
        assert status["use_real_docling"] == True
        assert status["status"] == "healthy"
        
        print(f"Docling version: {status['docling_version']}")
        print(f"Using real Docling: {status['use_real_docling']}")
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_real_docling_text_extraction(self, temp_dir):
        """Test real Docling text extraction from various formats."""
        from app.services.docling_service import DoclingService
        
        service = DoclingService()
        
        # Create test files with different formats
        test_files = {
            "test.txt": "This is a plain text document for testing Docling integration.",
            "test.md": "# Test Markdown\n\nThis is a **markdown** document with *formatting*.",
            "test.html": "<html><body><h1>Test HTML</h1><p>This is HTML content.</p></body></html>"
        }
        
        for filename, content in test_files.items():
            file_path = temp_dir / filename
            file_path.write_text(content)
            
            # Process with real Docling
            result = await service.process_document(
                file_path,
                extract_text=True,
                extract_metadata=True,
                extract_structure=False
            )
            
            # Verify processing completed
            assert result["status"] == "completed"
            assert result["processing_method"] == "real_docling"
            assert "content" in result
            assert "text" in result["content"]
            
            # Verify text extraction
            extracted_text = result["content"]["text"]
            assert len(extracted_text) > 0
            assert "test" in extracted_text.lower()
            
            print(f"✅ {filename}: Extracted {len(extracted_text)} characters")
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_real_docling_structure_extraction(self, temp_dir):
        """Test real Docling structure extraction capabilities."""
        from app.services.docling_service import DoclingService
        
        service = DoclingService()
        
        # Create a structured test document
        structured_content = """# Test Document

## Introduction
This is a test document with structure.

## Main Content
Here is the main content with some formatting.

### Subsection
- Item 1
- Item 2
- Item 3

## Conclusion
This concludes the test document.
"""
        
        test_file = temp_dir / "structured_test.md"
        test_file.write_text(structured_content)
        
        # Process with structure extraction
        result = await service.process_document(
            test_file,
            extract_text=True,
            extract_metadata=True,
            extract_structure=True
        )
        
        # Verify processing completed
        assert result["status"] == "completed"
        assert result["processing_method"] == "real_docling"
        
        # Verify structure extraction
        content = result["content"]
        assert "layout_info" in content
        assert content["layout_info"]["layout_detected"] == True
        
        print(f"✅ Structure extraction: {content['layout_info']}")
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_real_docling_performance(self, temp_dir):
        """Test Docling performance characteristics."""
        from app.services.docling_service import DoclingService
        
        service = DoclingService()
        
        # Create a larger test document
        large_content = "# Performance Test Document\n\n" + "This is line of content for performance testing.\n" * 1000
        test_file = temp_dir / "performance_test.txt"
        test_file.write_text(large_content)
        
        # Measure processing time
        start_time = time.time()
        result = await service.process_document(
            test_file,
            extract_text=True,
            extract_metadata=True,
            extract_structure=False
        )
        end_time = time.time()
        
        processing_time = end_time - start_time
        
        # Verify processing completed
        assert result["status"] == "completed"
        assert result["processing_method"] == "real_docling"
        
        # Performance assertions (adjust based on expected performance)
        assert processing_time < 10.0, f"Processing took {processing_time:.2f}s (too slow)"
        assert result["processing_time"] < 10.0
        
        print(f"✅ Performance test: {processing_time:.2f}s for {len(large_content)} characters")
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_real_docling_error_handling(self, temp_dir):
        """Test Docling error handling and fallbacks."""
        from app.services.docling_service import DoclingService
        
        service = DoclingService()
        
        # Test with non-existent file
        non_existent_file = temp_dir / "non_existent.txt"
        
        result = await service.process_document(
            non_existent_file,
            extract_text=True,
            extract_metadata=True,
            extract_structure=False
        )
        
        # Should handle error gracefully
        assert result["status"] == "failed"
        assert "error_message" in result
        
        print(f"✅ Error handling: {result['error_message']}")
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_real_docling_batch_processing(self, temp_dir):
        """Test Docling batch processing capabilities."""
        from app.services.docling_service import DoclingService
        
        service = DoclingService()
        
        # Create multiple test files
        test_files = []
        for i in range(5):
            content = f"# Test Document {i}\n\nThis is test document number {i}."
            file_path = temp_dir / f"batch_test_{i}.txt"
            file_path.write_text(content)
            test_files.append(file_path)
        
        # Process batch
        start_time = time.time()
        results = await service.process_batch(
            test_files,
            extract_text=True,
            extract_metadata=True,
            extract_structure=False
        )
        end_time = time.time()
        
        batch_time = end_time - start_time
        
        # Verify all files processed
        assert len(results) == 5
        successful_results = [r for r in results if r["status"] == "completed"]
        assert len(successful_results) == 5
        
        # All should use real Docling
        for result in successful_results:
            assert result["processing_method"] == "real_docling"
        
        print(f"✅ Batch processing: {len(successful_results)} files in {batch_time:.2f}s")

class TestDoclingAPIIntegration:
    """Integration tests for Docling API endpoints."""
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_docling_api_health_check(self):
        """Test Docling service health check endpoint."""
        from app.services.docling_service import DoclingService
        
        service = DoclingService()
        status = await service.get_service_status()
        
        # Verify health check response
        assert "service" in status
        assert "status" in status
        assert "docling_available" in status
        assert "use_real_docling" in status
        
        print(f"✅ Health check: {status['status']} (real_docling: {status['use_real_docling']})")
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_docling_api_document_upload(self, temp_dir):
        """Test document upload and processing via API."""
        from app.services.docling_service import DoclingService
        
        service = DoclingService()
        
        # Create test document
        test_content = "# API Test Document\n\nThis document tests the API integration."
        test_file = temp_dir / "api_test.txt"
        test_file.write_text(test_content)
        
        # Process document
        result = await service.extract_content_from_file(
            test_file,
            extract_text=True,
            extract_metadata=True,
            extract_structure=False
        )
        
        # Verify API response format
        assert result is not None
        assert isinstance(result, dict)
        assert "job_id" in result
        assert "status" in result
        assert "content" in result
        
        print(f"✅ API integration: {result['status']} (job_id: {result['job_id']})")

class TestDoclingCompatibility:
    """Tests for Docling compatibility and version handling."""
    
    @pytest.mark.integration
    def test_docling_version_compatibility(self):
        """Test that Docling version is compatible."""
        import docling
        
        # Check version
        if hasattr(docling, '__version__'):
            version = docling.__version__
            print(f"Docling version: {version}")
            
            # Parse version for compatibility check
            version_parts = version.split('.')
            major = int(version_parts[0])
            minor = int(version_parts[1])
            
            # We require version 2.0.0 or higher
            assert major >= 2, f"Docling version {version} is too old, need 2.0.0+"
            
            print(f"✅ Version compatibility: {version}")
        else:
            print("⚠️  Docling version not available")
    
    @pytest.mark.integration
    def test_docling_module_availability(self):
        """Test that all required Docling modules are available."""
        required_modules = [
            'docling.document_converter',
            'docling.datamodel',
            'docling.datamodel.base_models'
        ]
        
        for module_name in required_modules:
            try:
                __import__(module_name)
                print(f"✅ Module available: {module_name}")
            except ImportError as e:
                pytest.fail(f"Required Docling module not available: {module_name} - {e}")

class TestDoclingPerformanceBaseline:
    """Performance baseline tests for Docling integration."""
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_docling_performance_baseline(self, temp_dir):
        """Establish performance baseline for Docling processing."""
        from app.services.docling_service import DoclingService
        
        service = DoclingService()
        
        # Create standard test document
        standard_content = "# Performance Baseline Test\n\n" + "Standard line of content for baseline testing.\n" * 500
        test_file = temp_dir / "baseline_test.txt"
        test_file.write_text(standard_content)
        
        # Measure processing time
        start_time = time.time()
        result = await service.process_document(
            test_file,
            extract_text=True,
            extract_metadata=True,
            extract_structure=False
        )
        end_time = time.time()
        
        processing_time = end_time - start_time
        
        # Verify processing completed
        assert result["status"] == "completed"
        assert result["processing_method"] == "real_docling"
        
        # Document baseline performance
        assert processing_time < 5.0, f"Baseline processing took {processing_time}s (too slow)"
        
        print(f"✅ Performance baseline: {processing_time:.3f}s for {len(standard_content)} characters")
        print(f"   Processing method: {result['processing_method']}")
        print(f"   Service status: {result['status']}")
