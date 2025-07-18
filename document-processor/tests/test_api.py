"""
API Integration Tests for Document Processor Service
Tests all HTTP endpoints using FastAPI TestClient
"""

import pytest
import tempfile
import json
from pathlib import Path
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import io

# Import the FastAPI app
from app.main import app

# Create test client
client = TestClient(app)


class TestRootEndpoint:
    """Test root endpoint"""
    
    def test_root_endpoint(self):
        """Test GET / returns API information"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Document Processor API"
        assert data["version"] == "1.0.0"
        assert data["status"] == "running"


class TestHealthEndpoints:
    """Test health check endpoints"""
    
    def test_health_check(self):
        """Test basic health check endpoint"""
        response = client.get("/health/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "document-processor"
        assert data["version"] == "1.0.0"
    
    def test_readiness_check_success(self):
        """Test readiness check when dependencies available"""
        with patch('docling.__version__', '1.0.0'):
            response = client.get("/health/ready")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ready"
            assert data["checks"]["docling"] is True
            assert data["service"] == "document-processor"
    
    def test_readiness_check_failure(self):
        """Test readiness check when dependencies unavailable"""
        with patch('app.routers.health.docling', side_effect=ImportError("Docling not found")):
            response = client.get("/health/ready")
            assert response.status_code == 503
            data = response.json()
            assert data["status"] == "not_ready"
            assert "Docling not available" in data["error"]
    
    def test_liveness_check(self):
        """Test liveness check endpoint"""
        response = client.get("/health/live")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "alive"


class TestDocumentUploadEndpoint:
    """Test single document upload and processing"""
    
    def test_upload_document_success(self):
        """Test successful document upload"""
        # Create a test file
        test_content = "This is a test document for API testing."
        test_file = io.StringIO(test_content)
        
        files = {
            "file": ("test.txt", test_file, "text/plain")
        }
        params = {
            "extract_text": True,
            "extract_metadata": True,
            "extract_structure": False
        }
        
        with patch('app.routers.documents.docling_service.process_document') as mock_process:
            mock_process.return_value = {
                "job_id": "test-job-id",
                "status": "completed",
                "content": {"text": test_content}
            }
            
            response = client.post("/documents/upload", files=files, params=params)
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "processing"
            assert data["filename"] == "test.txt"
            assert "job_id" in data
            assert data["message"] == "Document uploaded and processing started"
    
    def test_upload_unsupported_file_type(self):
        """Test upload with unsupported file type"""
        test_file = io.StringIO("test content")
        files = {
            "file": ("test.xyz", test_file, "application/octet-stream")
        }
        
        response = client.post("/documents/upload", files=files)
        assert response.status_code == 400
        assert "Unsupported file type" in response.json()["detail"]
    
    def test_upload_supported_file_types(self):
        """Test upload with all supported file types"""
        supported_types = [
            ("test.pdf", "application/pdf"),
            ("test.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            ("test.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
            ("test.html", "text/html"),
            ("test.md", "text/markdown"),
            ("test.txt", "text/plain")
        ]
        
        for filename, mime_type in supported_types:
            test_file = io.StringIO("test content")
            files = {"file": (filename, test_file, mime_type)}
            
            with patch('app.routers.documents.docling_service.process_document'):
                response = client.post("/documents/upload", files=files)
                assert response.status_code == 200


class TestDocumentStatusEndpoint:
    """Test document processing status endpoints"""
    
    def test_get_status_success(self):
        """Test getting status of existing job"""
        job_id = "test-job-id"
        
        # Mock the processing_status dictionary
        with patch('app.routers.documents.processing_status', {
            job_id: {
                "status": "processing",
                "filename": "test.pdf",
                "progress": 50.0,
                "message": "Processing document..."
            }
        }):
            response = client.get(f"/documents/status/{job_id}")
            assert response.status_code == 200
            data = response.json()
            assert data["job_id"] == job_id
            assert data["status"] == "processing"
            assert data["progress"] == 50.0
            assert data["filename"] == "test.pdf"
    
    def test_get_status_not_found(self):
        """Test getting status of non-existent job"""
        with patch('app.routers.documents.processing_status', {}):
            response = client.get("/documents/status/invalid-job-id")
            assert response.status_code == 404
            assert response.json()["detail"] == "Job ID not found"


class TestDocumentResultEndpoint:
    """Test document processing result endpoints"""
    
    def test_get_result_success(self):
        """Test getting result of completed job"""
        job_id = "test-job-id"
        test_result = {
            "job_id": job_id,
            "status": "completed",
            "content": {"text": "Extracted text"}
        }
        
        with patch('app.routers.documents.processing_status', {
            job_id: {
                "status": "completed",
                "filename": "test.pdf",
                "progress": 100.0,
                "result": test_result
            }
        }):
            response = client.get(f"/documents/result/{job_id}")
            assert response.status_code == 200
            data = response.json()
            assert data["job_id"] == job_id
            assert data["status"] == "completed"
    
    def test_get_result_not_completed(self):
        """Test getting result of job not yet completed"""
        job_id = "test-job-id"
        
        with patch('app.routers.documents.processing_status', {
            job_id: {
                "status": "processing",
                "filename": "test.pdf",
                "progress": 50.0
            }
        }):
            response = client.get(f"/documents/result/{job_id}")
            assert response.status_code == 400
            assert "Processing not completed" in response.json()["detail"]
    
    def test_get_result_not_found(self):
        """Test getting result of non-existent job"""
        with patch('app.routers.documents.processing_status', {}):
            response = client.get("/documents/result/invalid-job-id")
            assert response.status_code == 404


class TestBatchProcessingEndpoints:
    """Test batch document processing endpoints"""
    
    def test_batch_upload_success(self):
        """Test successful batch document upload"""
        files = [
            ("files", ("test1.txt", io.StringIO("Content 1"), "text/plain")),
            ("files", ("test2.txt", io.StringIO("Content 2"), "text/plain"))
        ]
        
        with patch('app.routers.documents.docling_service.process_document'):
            response = client.post("/documents/batch", files=files)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "processing"
            assert data["total_files"] == 2
            assert len(data["job_ids"]) == 2
            assert "batch_id" in data
    
    def test_batch_upload_too_many_files(self):
        """Test batch upload with too many files"""
        files = [
            ("files", (f"test{i}.txt", io.StringIO(f"Content {i}"), "text/plain"))
            for i in range(15)  # More than the limit of 10
        ]
        
        response = client.post("/documents/batch", files=files)
        assert response.status_code == 400
        assert "Maximum 10 files allowed" in response.json()["detail"]
    
    def test_batch_status_success(self):
        """Test getting batch processing status"""
        batch_id = "test-batch-id"
        
        with patch('app.routers.documents.processing_status', {
            f"{batch_id}_0": {
                "status": "completed",
                "filename": "test1.txt",
                "progress": 100.0,
                "batch_id": batch_id
            },
            f"{batch_id}_1": {
                "status": "processing", 
                "filename": "test2.txt",
                "progress": 50.0,
                "batch_id": batch_id
            }
        }):
            response = client.get(f"/documents/batch/status/{batch_id}")
            assert response.status_code == 200
            data = response.json()
            assert data["batch_id"] == batch_id
            assert data["total_files"] == 2
            assert data["completed"] == 1
            assert data["processing"] == 1
    
    def test_batch_status_not_found(self):
        """Test getting status of non-existent batch"""
        with patch('app.routers.documents.processing_status', {}):
            response = client.get("/documents/batch/status/invalid-batch-id")
            assert response.status_code == 404


class TestCleanupEndpoint:
    """Test job cleanup endpoints"""
    
    def test_cleanup_success(self):
        """Test successful job cleanup"""
        job_id = "test-job-id"
        
        with patch('app.routers.documents.processing_status', {
            job_id: {
                "status": "completed",
                "filename": "test.pdf"
            }
        }):
            with patch('pathlib.Path.glob', return_value=[]):
                response = client.delete(f"/documents/cleanup/{job_id}")
                assert response.status_code == 200
                assert f"Job {job_id} cleaned up successfully" in response.json()["message"]
    
    def test_cleanup_not_found(self):
        """Test cleanup of non-existent job"""
        with patch('app.routers.documents.processing_status', {}):
            response = client.delete("/documents/cleanup/invalid-job-id")
            assert response.status_code == 404


class TestAPIErrorHandling:
    """Test API error handling scenarios"""
    
    def test_upload_with_processing_error(self):
        """Test upload when processing fails"""
        test_file = io.StringIO("test content")
        files = {"file": ("test.txt", test_file, "text/plain")}
        
        with patch('app.routers.documents.docling_service.process_document', 
                  side_effect=Exception("Processing failed")):
            response = client.post("/documents/upload", files=files)
            # Should still return 200 since error handling is in background task
            assert response.status_code == 200
    
    def test_invalid_json_response_handling(self):
        """Test handling of invalid JSON in responses"""
        # Test that all endpoints return valid JSON
        endpoints = [
            "/",
            "/health/",
            "/health/ready",
            "/health/live"
        ]
        
        for endpoint in endpoints:
            response = client.get(endpoint)
            # Should be able to parse JSON without error
            data = response.json()
            assert isinstance(data, dict)


class TestAPIIntegration:
    """End-to-end API integration tests"""
    
    def test_complete_document_workflow(self):
        """Test complete document processing workflow via API"""
        # 1. Upload document
        test_content = "# Test Document\n\nThis is test content."
        test_file = io.StringIO(test_content)
        files = {"file": ("test.md", test_file, "text/markdown")}
        
        with patch('app.routers.documents.docling_service.process_document') as mock_process:
            mock_result = {
                "job_id": "workflow-test-id",
                "status": "completed",
                "content": {
                    "text": "Test Document This is test content.",
                    "markdown": test_content
                },
                "metadata": {
                    "filename": "test.md",
                    "file_size": len(test_content),
                    "document_type": "md"
                }
            }
            mock_process.return_value = mock_result
            
            # Upload
            upload_response = client.post("/documents/upload", files=files)
            assert upload_response.status_code == 200
            job_id = upload_response.json()["job_id"]
            
            # 2. Check status (simulate completed)
            with patch('app.routers.documents.processing_status', {
                job_id: {
                    "status": "completed",
                    "filename": "test.md",
                    "progress": 100.0,
                    "result": mock_result
                }
            }):
                status_response = client.get(f"/documents/status/{job_id}")
                assert status_response.status_code == 200
                assert status_response.json()["status"] == "completed"
                
                # 3. Get result
                result_response = client.get(f"/documents/result/{job_id}")
                assert result_response.status_code == 200
                result_data = result_response.json()
                assert result_data["content"]["text"] == "Test Document This is test content."
                
                # 4. Cleanup
                cleanup_response = client.delete(f"/documents/cleanup/{job_id}")
                assert cleanup_response.status_code == 200


# Fixtures for API testing
@pytest.fixture
def api_client():
    """Provide test client for API tests"""
    return client


@pytest.fixture
def sample_document_file():
    """Provide sample document file for testing"""
    content = "# Sample Document\n\nThis is a sample document for API testing."
    return io.StringIO(content)


@pytest.fixture
def mock_docling_service():
    """Mock Docling service for API tests"""
    with patch('app.routers.documents.docling_service') as mock:
        mock.process_document.return_value = {
            "job_id": "test-job",
            "status": "completed",
            "content": {"text": "Sample text"}
        }
        yield mock


if __name__ == "__main__":
    # Run tests when script is executed directly
    pytest.main([__file__, "-v"])
