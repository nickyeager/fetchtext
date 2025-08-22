#!/usr/bin/env python3
"""
Test Suite for Google Docs Backend API
Tests the new backend API with user-provided credentials
"""

import pytest
import json
import os
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock

# Import the FastAPI app
from app.main import app

client = TestClient(app)

class TestGoogleDocsAPI:
    """Test the Google Docs API endpoints"""
    
    def setup_method(self):
        """Setup test data"""
        self.valid_oauth2_credentials = {
            "auth_method": "oauth2",
            "client_id": "test_client_id.apps.googleusercontent.com",
            "client_secret": "test_client_secret",
            "project_id": "test_project_id"
        }
        
        self.valid_service_account_credentials = {
            "auth_method": "service_account",
            "service_account_email": "test@test-project.iam.gserviceaccount.com",
            "service_account_key": json.dumps({
                "type": "service_account",
                "project_id": "test-project",
                "private_key_id": "test_key_id",
                "private_key": "-----BEGIN PRIVATE KEY-----\nTEST_KEY\n-----END PRIVATE KEY-----\n",
                "client_email": "test@test-project.iam.gserviceaccount.com",
                "client_id": "123456789",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token"
            }),
            "project_id": "test-project"
        }
        
        self.test_document_id = "1abc123def456ghi789jkl012mno345pqr678stu901vwx234"
        self.invalid_document_id = "invalid_id"

    def test_health_endpoint(self):
        """Test the health check endpoint"""
        response = client.get("/api/google-docs/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "google-docs-integration"
        assert "features" in data
        assert len(data["features"]) > 0

    def test_supported_formats_endpoint(self):
        """Test the supported formats endpoint"""
        response = client.get("/api/google-docs/supported-formats")
        assert response.status_code == 200
        
        data = response.json()
        assert "formats" in data
        assert len(data["formats"]) > 0
        
        # Check that common formats are included
        format_types = [f["mime_type"] for f in data["formats"]]
        assert "text/plain" in format_types
        assert "text/html" in format_types
        assert "application/pdf" in format_types

    def test_load_document_missing_credentials(self):
        """Test loading document without credentials"""
        request_data = {
            "document_id": self.test_document_id,
            "export_format": "text/plain"
            # Missing google_credentials
        }
        
        response = client.post("/api/google-docs/load-document", json=request_data)
        assert response.status_code == 422  # Validation error

    def test_load_document_invalid_credentials(self):
        """Test loading document with invalid credentials"""
        request_data = {
            "document_id": self.test_document_id,
            "export_format": "text/plain",
            "google_credentials": {
                "auth_method": "invalid_method"
            }
        }
        
        response = client.post("/api/google-docs/load-document", json=request_data)
        assert response.status_code == 400
        
        data = response.json()
        assert "Invalid credentials" in data["detail"]

    def test_load_document_incomplete_oauth2_credentials(self):
        """Test loading document with incomplete OAuth2 credentials"""
        request_data = {
            "document_id": self.test_document_id,
            "export_format": "text/plain",
            "google_credentials": {
                "auth_method": "oauth2",
                "client_id": "test_id"
                # Missing client_secret
            }
        }
        
        response = client.post("/api/google-docs/load-document", json=request_data)
        assert response.status_code == 400
        
        data = response.json()
        assert "OAuth2 credentials missing" in data["detail"]

    def test_load_document_incomplete_service_account_credentials(self):
        """Test loading document with incomplete service account credentials"""
        request_data = {
            "document_id": self.test_document_id,
            "export_format": "text/plain",
            "google_credentials": {
                "auth_method": "service_account",
                "service_account_email": "test@example.com"
                # Missing service_account_key
            }
        }
        
        response = client.post("/api/google-docs/load-document", json=request_data)
        assert response.status_code == 400
        
        data = response.json()
        assert "Service account credentials missing" in data["detail"]

    @patch('app.services.google_drive_service.google_drive_service.download_document')
    def test_load_document_service_account_success(self, mock_download):
        """Test successful document loading with service account"""
        # Mock successful download
        mock_content = b"Test document content"
        mock_metadata = {
            "document_id": self.test_document_id,
            "name": "Test Document",
            "mime_type": "text/plain",
            "size": len(mock_content),
            "modified_time": "2024-01-15T10:00:00Z",
            "created_time": "2024-01-15T09:00:00Z",
            "owners": [],
            "export_format": "text/plain"
        }
        mock_download.return_value = (mock_content, mock_metadata, None)
        
        request_data = {
            "document_id": self.test_document_id,
            "export_format": "text/plain",
            "google_credentials": self.valid_service_account_credentials,
            "process_immediately": False
        }
        
        response = client.post("/api/google-docs/load-document", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["google_doc_id"] == self.test_document_id
        assert "file_data" in data
        assert data["file_data"]["file_name"] == "Test Document"

    @patch('app.services.google_drive_service.google_drive_service.download_document')
    def test_load_document_download_error(self, mock_download):
        """Test document loading with download error"""
        # Mock download failure
        mock_download.return_value = (None, None, "Document not found")
        
        request_data = {
            "document_id": self.test_document_id,
            "export_format": "text/plain",
            "google_credentials": self.valid_service_account_credentials
        }
        
        response = client.post("/api/google-docs/load-document", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == False
        assert data["error"] == "Document not found"

    @patch('app.services.google_drive_service.google_drive_service.validate_document_access')
    def test_validate_access_success(self, mock_validate):
        """Test successful document access validation"""
        # Mock successful validation
        mock_validate.return_value = (True, None)
        
        request_data = {
            "document_id": self.test_document_id,
            "google_credentials": self.valid_service_account_credentials
        }
        
        response = client.post("/api/google-docs/validate-access", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["valid"] == True
        assert "document_info" in data

    @patch('app.services.google_drive_service.google_drive_service.validate_document_access')
    def test_validate_access_failure(self, mock_validate):
        """Test document access validation failure"""
        # Mock validation failure
        mock_validate.return_value = (False, "Access denied")
        
        request_data = {
            "document_id": self.test_document_id,
            "google_credentials": self.valid_service_account_credentials
        }
        
        response = client.post("/api/google-docs/validate-access", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["valid"] == False
        assert data["error"] == "Access denied"

    def test_validate_access_invalid_credentials(self):
        """Test access validation with invalid credentials"""
        request_data = {
            "document_id": self.test_document_id,
            "google_credentials": {
                "auth_method": "invalid"
            }
        }
        
        response = client.post("/api/google-docs/validate-access", json=request_data)
        assert response.status_code == 400

    @patch('app.services.google_drive_service.google_drive_service.download_document')
    def test_batch_load_documents(self, mock_download):
        """Test batch document loading"""
        # Mock successful download for both documents
        mock_content = b"Test document content"
        mock_metadata = {
            "document_id": self.test_document_id,
            "name": "Test Document",
            "mime_type": "text/plain", 
            "size": len(mock_content),
            "modified_time": "2024-01-15T10:00:00Z",
            "created_time": "2024-01-15T09:00:00Z",
            "owners": [],
            "export_format": "text/plain"
        }
        mock_download.return_value = (mock_content, mock_metadata, None)
        
        request_data = [
            {
                "document_id": "doc1",
                "export_format": "text/plain",
                "google_credentials": self.valid_service_account_credentials,
                "process_immediately": False
            },
            {
                "document_id": "doc2", 
                "export_format": "text/html",
                "google_credentials": self.valid_service_account_credentials,
                "process_immediately": False
            }
        ]
        
        response = client.post("/api/google-docs/batch-load", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["total_requested"] == 2
        assert data["total_processed"] == 2
        assert data["successful"] == 2
        assert data["failed"] == 0
        assert len(data["results"]) == 2

    @patch('app.services.google_drive_service.google_drive_service.list_folder_documents')
    def test_list_folder_documents_success(self, mock_list):
        """Test successful folder document listing"""
        # Mock folder listing
        mock_documents = [
            {
                "id": "doc1",
                "name": "Document 1",
                "modifiedTime": "2024-01-15T10:00:00Z"
            },
            {
                "id": "doc2",
                "name": "Document 2", 
                "modifiedTime": "2024-01-15T11:00:00Z"
            }
        ]
        mock_list.return_value = (mock_documents, None)
        
        response = client.post(
            "/api/google-docs/list-folder-documents",
            params={"folder_id": "test_folder_id"},
            json=self.valid_service_account_credentials
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["folder_id"] == "test_folder_id"
        assert data["document_count"] == 2
        assert len(data["documents"]) == 2

    @patch('app.services.google_drive_service.google_drive_service.list_folder_documents')
    def test_list_folder_documents_error(self, mock_list):
        """Test folder document listing with error"""
        # Mock listing error
        mock_list.return_value = (None, "Folder not found")
        
        response = client.post(
            "/api/google-docs/list-folder-documents",
            params={"folder_id": "invalid_folder_id"},
            json=self.valid_service_account_credentials
        )
        assert response.status_code == 400

class TestGoogleDriveService:
    """Test the Google Drive Service directly"""
    
    def setup_method(self):
        """Setup test data"""
        self.valid_service_account_key = {
            "type": "service_account",
            "project_id": "test-project",
            "private_key_id": "test_key_id",
            "private_key": "-----BEGIN PRIVATE KEY-----\nTEST_KEY\n-----END PRIVATE KEY-----\n",
            "client_email": "test@test-project.iam.gserviceaccount.com",
            "client_id": "123456789",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token"
        }

    def test_credentials_format_validation(self):
        """Test credential format validation"""
        from app.services.google_drive_service import google_drive_service
        
        # Test valid OAuth2 credentials
        oauth2_creds = {
            "auth_method": "oauth2",
            "client_id": "test_id",
            "client_secret": "test_secret"
        }
        is_valid, error = google_drive_service.validate_credentials_format(oauth2_creds)
        assert is_valid == True
        assert error is None
        
        # Test invalid OAuth2 credentials (missing secret)
        invalid_oauth2 = {
            "auth_method": "oauth2",
            "client_id": "test_id"
        }
        is_valid, error = google_drive_service.validate_credentials_format(invalid_oauth2)
        assert is_valid == False
        assert "client_secret" in error
        
        # Test valid service account credentials
        service_account_creds = {
            "auth_method": "service_account",
            "service_account_email": "test@example.com",
            "service_account_key": json.dumps(self.valid_service_account_key)
        }
        is_valid, error = google_drive_service.validate_credentials_format(service_account_creds)
        assert is_valid == True
        assert error is None
        
        # Test invalid service account credentials (invalid JSON)
        invalid_service_account = {
            "auth_method": "service_account",
            "service_account_email": "test@example.com",
            "service_account_key": "invalid json"
        }
        is_valid, error = google_drive_service.validate_credentials_format(invalid_service_account)
        assert is_valid == False
        assert "valid JSON" in error

    def test_supported_export_formats(self):
        """Test getting supported export formats"""
        from app.services.google_drive_service import google_drive_service
        
        formats = asyncio.run(google_drive_service.get_supported_export_formats())
        
        assert isinstance(formats, dict)
        assert len(formats) > 0
        assert "text/plain" in formats
        assert "application/pdf" in formats
        assert "text/html" in formats

if __name__ == "__main__":
    pytest.main([__file__, "-v"])