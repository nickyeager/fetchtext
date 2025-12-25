"""
Middleware modules for the Document Processor API
"""

from .api_auth import api_key_auth, APIKeyAuth
from .admin_auth import admin_auth, AdminAuth

__all__ = ['api_key_auth', 'APIKeyAuth', 'admin_auth', 'AdminAuth']
