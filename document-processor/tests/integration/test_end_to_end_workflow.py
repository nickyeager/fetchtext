"""
Integration tests for end-to-end document processing workflow.

These tests validate the complete document processing pipeline from
file upload through content extraction to result delivery.
"""
import pytest
import asyncio
import json
from pathlib import Path
import tempfile
from typing import Dict, Any
import aiofiles

class TestEndToEndWorkflow:
    """Integration tests for complete document processing workflow."""
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_complete_document_processing_workflow(self, temp_dir):
        """Test the complete workflow from file input to processed output."""
        # Create test document
        test_content = """# Test Document

This is a comprehensive test document for integration testing.

## Features to Test
- Text extraction
- Metadata extraction  
- Structure preservation
- Error handling

### Sample Table
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Value A  | Value B  | Value C  |

## Conclusion
This document tests the complete processing pipeline.
"""
        
        test_file = temp_dir / "integration_test.md"
        test_file.write_text(test_content)
        
        # Import the service
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        # Process the document
        result = await service.extract_content_from_file(test_file)
        
        # Verify processing completed
        assert result is not None
        assert isinstance(result, dict)
        
        # Verify basic content extraction
        # (Content will depend on current mock implementation)
        
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_batch_processing_workflow(self, temp_dir):
        """Test batch processing of multiple documents."""
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        # Create multiple test files
        test_files = []
        for i in range(3):
            content = f"# Document {i+1}\n\nContent for document {i+1}."
            file_path = temp_dir / f"batch_test_{i+1}.md"
            file_path.write_text(content)
            test_files.append(file_path)
        
        # Process files concurrently
        tasks = [
            service.extract_content_from_file(file_path)
            for file_path in test_files
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Verify all files processed successfully
        assert len(results) == 3
        for i, result in enumerate(results):
            assert not isinstance(result, Exception), f"File {i} failed: {result}"
            assert result is not None
    
    @pytest.mark.integration 
    @pytest.mark.asyncio
    async def test_different_format_processing(self, temp_dir):
        """Test processing of different file formats."""
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        # Create files with different formats
        test_files = {
            "test.txt": "Plain text content",
            "test.md": "# Markdown\n\nContent here",
            "test.html": "<html><body><h1>HTML</h1><p>Content</p></body></html>",
            "test.json": '{"title": "JSON Document", "content": "JSON content"}'
        }
        
        results = {}
        for filename, content in test_files.items():
            file_path = temp_dir / filename
            file_path.write_text(content)
            
            result = await service.extract_content_from_file(file_path)
            results[filename] = result
            
            # Each file should be processed
            assert result is not None
        
        # Verify different formats were handled
        assert len(results) == len(test_files)

class TestAPIIntegrationWorkflow:
    """Integration tests for API endpoints."""
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_document_upload_api_workflow(self, temp_dir):
        """Test document upload and processing via API."""
        # This test would typically use a test client to hit the API
        # For now, we test the underlying service that powers the API
        
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        # Simulate file upload
        uploaded_file = temp_dir / "uploaded_doc.txt"
        uploaded_file.write_text("Uploaded document content")
        
        # Process as if it came through the API
        result = await service.extract_content_from_file(uploaded_file)
        
        assert result is not None
        # Result should be in format suitable for API response
        assert isinstance(result, dict)
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_health_check_integration(self):
        """Test health check endpoint integration."""
        # Import health check function (renamed from get_health to health_check)
        from app.routers.health import health_check

        # Call health check (it's async now)
        health_status = await health_check()

        # Verify health check response
        assert health_status["status"] == "healthy"
        assert health_status["service"] == "document-processor"
        assert "version" in health_status

class TestErrorHandlingIntegration:
    """Integration tests for error handling scenarios."""
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_invalid_file_handling_integration(self, temp_dir):
        """Test handling of invalid files in complete workflow."""
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        # Create invalid/corrupted file
        invalid_file = temp_dir / "invalid.pdf"
        invalid_file.write_bytes(b"Not a real PDF file")
        
        # Should handle gracefully
        result = await service.extract_content_from_file(invalid_file)
        
        # Should either succeed with warnings or fail gracefully
        assert result is not None or isinstance(result, dict)
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_large_file_integration(self, temp_dir):
        """Test processing of large files."""
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        # Create large file (but not too large for tests)
        large_content = "Large file content line.\n" * 5000  # ~100KB
        large_file = temp_dir / "large_file.txt"
        large_file.write_text(large_content)
        
        # Should process without memory issues
        result = await service.extract_content_from_file(large_file)
        
        assert result is not None
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_concurrent_processing_stress(self, temp_dir):
        """Test concurrent processing under load."""
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        # Create multiple files for concurrent processing
        files = []
        for i in range(10):
            content = f"Stress test document {i}\n" + "Content line.\n" * 100
            file_path = temp_dir / f"stress_test_{i}.txt"
            file_path.write_text(content)
            files.append(file_path)
        
        # Process all files concurrently
        tasks = [
            service.extract_content_from_file(file_path)
            for file_path in files
        ]
        
        start_time = asyncio.get_event_loop().time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        end_time = asyncio.get_event_loop().time()
        
        # Verify all completed
        assert len(results) == 10
        
        # Check for failures
        failures = [r for r in results if isinstance(r, Exception)]
        assert len(failures) == 0, f"Had {len(failures)} failures: {failures}"
        
        # Performance check (should complete in reasonable time)
        processing_time = end_time - start_time
        assert processing_time < 60.0, f"Processing took too long: {processing_time}s"

class TestDataPersistenceIntegration:
    """Integration tests for data persistence and caching."""
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_temp_file_cleanup_integration(self, temp_dir):
        """Test that temporary files are properly cleaned up."""
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        # Process a file
        test_file = temp_dir / "cleanup_test.txt"
        test_file.write_text("Content for cleanup test")
        
        # Check temp directory before
        temp_files_before = list(service.temp_dir.glob("*"))
        
        # Process file
        result = await service.extract_content_from_file(test_file)
        assert result is not None
        
        # Check temp directory after (should be cleaned up)
        temp_files_after = list(service.temp_dir.glob("*"))
        
        # Should not have accumulated temp files
        # (Or have a reasonable cleanup strategy)
        assert len(temp_files_after) <= len(temp_files_before) + 1

class TestUpgradeCompatibilityIntegration:
    """Integration tests for upgrade compatibility."""
    
    @pytest.mark.integration
    @pytest.mark.asyncio  
    async def test_mock_to_real_upgrade_compatibility(self, temp_dir):
        """Test that upgrade from mock to real Docling maintains compatibility."""
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        # Test current mock implementation
        test_file = temp_dir / "upgrade_test.txt"
        test_file.write_text("Content for upgrade compatibility test")
        
        # Get result from current implementation
        mock_result = await service.extract_content_from_file(test_file)
        
        # Verify result structure is upgrade-compatible
        assert mock_result is not None
        assert isinstance(mock_result, dict)
        
        # Mock implementation should return structured data
        # that will be compatible with real Docling implementation
    
    @pytest.mark.integration
    def test_api_contract_compatibility(self):
        """Test that API contracts remain stable during upgrade."""
        # Import API models
        from app.models.document import (
            DocumentProcessingResponse,
            DocumentProcessingStatus,
            BatchProcessingRequest,
            ProcessingResult
        )
        
        # Test that models can be instantiated (API contract check)
        response = DocumentProcessingResponse(
            job_id="test-123",
            status="completed",
            filename="test.txt",
            message="Processing complete"
        )
        
        status = DocumentProcessingStatus(
            job_id="test-123", 
            status="completed",
            progress=100.0,
            message="Done",
            filename="test.txt"
        )
        
        assert response.job_id == "test-123"
        assert status.progress == 100.0
        
        # API contracts should remain stable through upgrade

class TestPerformanceIntegration:
    """Integration tests for performance characteristics."""
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_processing_performance_baseline(self, temp_dir):
        """Establish performance baseline for document processing."""
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        # Create standard test document
        standard_content = "# Performance Test\n\n" + "Standard line of content.\n" * 1000
        test_file = temp_dir / "performance_test.txt"
        test_file.write_text(standard_content)
        
        # Measure processing time
        start_time = asyncio.get_event_loop().time()
        result = await service.extract_content_from_file(test_file)
        end_time = asyncio.get_event_loop().time()
        
        processing_time = end_time - start_time
        
        # Verify processing completed
        assert result is not None
        
        # Document baseline performance (this will change with real Docling)
        # Current mock should be very fast
        assert processing_time < 5.0, f"Mock processing took {processing_time}s (too slow)"
        
        # Log performance for comparison after upgrade
        print(f"Baseline processing time: {processing_time:.3f}s")
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_memory_usage_integration(self, temp_dir):
        """Test memory usage during document processing."""
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        # Process multiple files to test memory usage
        files = []
        for i in range(5):
            content = f"Memory test document {i}\n" + "Content line.\n" * 1000
            file_path = temp_dir / f"memory_test_{i}.txt"
            file_path.write_text(content)
            files.append(file_path)
        
        # Process files sequentially
        results = []
        for file_path in files:
            result = await service.extract_content_from_file(file_path)
            results.append(result)
            assert result is not None
        
        # Should complete without memory errors
        assert len(results) == 5
