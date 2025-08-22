"""
Google Drive Service with Dynamic User Credentials
Handles both OAuth2 and Service Account authentication using user-provided credentials
"""

import json
import base64
import tempfile
import asyncio
from typing import Dict, Any, Optional, Tuple
from pathlib import Path
import httpx
from google.oauth2 import service_account
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import logging

logger = logging.getLogger(__name__)

class GoogleDriveService:
    """Service for accessing Google Drive with user-provided credentials"""
    
    def __init__(self):
        self.oauth2_scopes = [
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/documents.readonly'
        ]
    
    async def authenticate_with_credentials(self, credentials: Dict[str, Any]) -> Tuple[Optional[Any], Optional[str]]:
        """
        Authenticate with Google APIs using user-provided credentials
        
        Args:
            credentials: Dictionary containing auth_method and credentials
            
        Returns:
            Tuple of (service_object, error_message)
        """
        try:
            auth_method = credentials.get('auth_method', 'oauth2')
            
            if auth_method == 'oauth2':
                return await self._authenticate_oauth2(credentials)
            elif auth_method == 'service_account':
                return await self._authenticate_service_account(credentials)
            else:
                return None, f"Unsupported authentication method: {auth_method}"
                
        except Exception as e:
            logger.error(f"Authentication failed: {e}")
            return None, f"Authentication failed: {str(e)}"
    
    async def _authenticate_oauth2(self, credentials: Dict[str, Any]) -> Tuple[Optional[Any], Optional[str]]:
        """Authenticate using OAuth2 credentials"""
        client_id = credentials.get('client_id')
        client_secret = credentials.get('client_secret')
        
        if not client_id or not client_secret:
            return None, "OAuth2 credentials incomplete: missing client_id or client_secret"
        
        # For OAuth2, we need to implement a proper OAuth flow
        # For now, we'll return an error indicating this needs user interaction
        return None, "OAuth2 requires interactive authentication flow - use service account for automated access"
    
    async def _authenticate_service_account(self, credentials: Dict[str, Any]) -> Tuple[Optional[Any], Optional[str]]:
        """Authenticate using Service Account credentials"""
        service_account_key = credentials.get('service_account_key')
        service_account_email = credentials.get('service_account_email')
        
        if not service_account_key or not service_account_email:
            return None, "Service account credentials incomplete"
        
        try:
            # Parse the service account key JSON
            if isinstance(service_account_key, str):
                key_data = json.loads(service_account_key)
            else:
                key_data = service_account_key
            
            # Validate required fields
            required_fields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email']
            missing_fields = [field for field in required_fields if field not in key_data]
            if missing_fields:
                return None, f"Service account key missing fields: {missing_fields}"
            
            # Create credentials from service account key
            creds = service_account.Credentials.from_service_account_info(
                key_data, scopes=self.oauth2_scopes
            )
            
            # Build the Drive service
            service = build('drive', 'v3', credentials=creds)
            
            return service, None
            
        except json.JSONDecodeError:
            return None, "Invalid service account key format - must be valid JSON"
        except Exception as e:
            return None, f"Service account authentication failed: {str(e)}"
    
    async def download_document(
        self, 
        document_id: str, 
        export_format: str, 
        credentials: Dict[str, Any]
    ) -> Tuple[Optional[bytes], Optional[Dict[str, Any]], Optional[str]]:
        """
        Download a Google Doc using user credentials
        
        Args:
            document_id: Google Docs document ID
            export_format: MIME type for export (e.g., 'text/plain', 'text/html')
            credentials: User authentication credentials
            
        Returns:
            Tuple of (file_content, metadata, error_message)
        """
        try:
            # Authenticate with Google APIs
            service, auth_error = await self.authenticate_with_credentials(credentials)
            if auth_error:
                return None, None, auth_error
            
            # Get document metadata
            try:
                file_metadata = service.files().get(fileId=document_id).execute()
            except HttpError as e:
                if e.resp.status == 404:
                    return None, None, f"Document not found: {document_id}"
                elif e.resp.status == 403:
                    return None, None, f"Access denied to document: {document_id}"
                else:
                    return None, None, f"Failed to access document metadata: {e}"
            
            # Download the document in the specified format
            try:
                request = service.files().export_media(fileId=document_id, mimeType=export_format)
                file_content = request.execute()
            except HttpError as e:
                if e.resp.status == 400:
                    return None, None, f"Invalid export format '{export_format}' for document type"
                else:
                    return None, None, f"Failed to download document: {e}"
            
            # Prepare metadata
            metadata = {
                'document_id': document_id,
                'name': file_metadata.get('name', 'Unknown'),
                'mime_type': export_format,
                'size': len(file_content),
                'modified_time': file_metadata.get('modifiedTime'),
                'created_time': file_metadata.get('createdTime'),
                'owners': file_metadata.get('owners', []),
                'export_format': export_format
            }
            
            return file_content, metadata, None
            
        except Exception as e:
            logger.error(f"Document download failed: {e}")
            return None, None, f"Document download failed: {str(e)}"
    
    async def validate_document_access(
        self, 
        document_id: str, 
        credentials: Dict[str, Any]
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate that the user can access a specific document
        
        Args:
            document_id: Google Docs document ID
            credentials: User authentication credentials
            
        Returns:
            Tuple of (access_granted, error_message)
        """
        try:
            # Authenticate with Google APIs
            service, auth_error = await self.authenticate_with_credentials(credentials)
            if auth_error:
                return False, auth_error
            
            # Try to get document metadata (lightweight check)
            try:
                service.files().get(fileId=document_id, fields='id,name,mimeType').execute()
                return True, None
            except HttpError as e:
                if e.resp.status == 404:
                    return False, "Document not found or not accessible"
                elif e.resp.status == 403:
                    return False, "Access denied - document may not be shared with your account"
                else:
                    return False, f"Access validation failed: {e}"
                    
        except Exception as e:
            logger.error(f"Access validation failed: {e}")
            return False, f"Access validation failed: {str(e)}"
    
    async def list_folder_documents(
        self, 
        folder_id: str, 
        credentials: Dict[str, Any],
        page_size: int = 50
    ) -> Tuple[Optional[list], Optional[str]]:
        """
        List Google Docs in a specific folder
        
        Args:
            folder_id: Google Drive folder ID
            credentials: User authentication credentials
            page_size: Maximum number of documents to return
            
        Returns:
            Tuple of (document_list, error_message)
        """
        try:
            # Authenticate with Google APIs
            service, auth_error = await self.authenticate_with_credentials(credentials)
            if auth_error:
                return None, auth_error
            
            # Query for Google Docs in the folder
            query = f"'{folder_id}' in parents and mimeType='application/vnd.google-apps.document'"
            
            try:
                results = service.files().list(
                    q=query,
                    pageSize=page_size,
                    fields="files(id,name,modifiedTime,createdTime,owners)"
                ).execute()
                
                documents = results.get('files', [])
                return documents, None
                
            except HttpError as e:
                if e.resp.status == 404:
                    return None, "Folder not found or not accessible"
                elif e.resp.status == 403:
                    return None, "Access denied to folder"
                else:
                    return None, f"Failed to list folder contents: {e}"
                    
        except Exception as e:
            logger.error(f"Folder listing failed: {e}")
            return None, f"Folder listing failed: {str(e)}"
    
    async def get_supported_export_formats(self) -> Dict[str, str]:
        """Get supported export formats for Google Docs"""
        return {
            'text/plain': 'Plain Text (.txt)',
            'text/html': 'HTML (.html)',
            'application/pdf': 'PDF (.pdf)',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Microsoft Word (.docx)',
            'application/vnd.oasis.opendocument.text': 'OpenDocument Text (.odt)',
            'application/rtf': 'Rich Text Format (.rtf)',
            'application/epub+zip': 'EPUB (.epub)'
        }
    
    def validate_credentials_format(self, credentials: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Validate the format of user-provided credentials
        
        Args:
            credentials: User authentication credentials
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        auth_method = credentials.get('auth_method')
        
        if not auth_method:
            return False, "Missing authentication method"
        
        if auth_method not in ['oauth2', 'service_account']:
            return False, f"Unsupported authentication method: {auth_method}"
        
        if auth_method == 'oauth2':
            required_fields = ['client_id', 'client_secret']
            missing_fields = [field for field in required_fields if not credentials.get(field)]
            if missing_fields:
                return False, f"OAuth2 credentials missing: {missing_fields}"
        
        elif auth_method == 'service_account':
            required_fields = ['service_account_key', 'service_account_email']
            missing_fields = [field for field in required_fields if not credentials.get(field)]
            if missing_fields:
                return False, f"Service account credentials missing: {missing_fields}"
            
            # Validate service account key format
            try:
                key_data = credentials.get('service_account_key')
                if isinstance(key_data, str):
                    json.loads(key_data)
            except json.JSONDecodeError:
                return False, "Service account key must be valid JSON"
        
        return True, None

# Create singleton instance
google_drive_service = GoogleDriveService()