"""
Database configuration and client management for template matching
"""

import os
import logging
from typing import Optional
from supabase import create_client, Client

logger = logging.getLogger(__name__)

class DatabaseConfig:
    """Database configuration management"""
    
    def __init__(self):
        self._client: Optional[Client] = None
        self.supabase_url = os.getenv('SUPABASE_URL', '')
        self.supabase_anon_key = os.getenv('SUPABASE_ANON_KEY', '')
        
        # Alternative environment variable names
        if not self.supabase_url:
            self.supabase_url = os.getenv('VITE_SUPABASE_URL', '')
        if not self.supabase_anon_key:
            self.supabase_anon_key = os.getenv('VITE_SUPABASE_ANON_KEY', '')
        
        # Validate configuration
        if not self.supabase_url or not self.supabase_anon_key:
            logger.warning("Supabase configuration incomplete. Template matching will use mock data.")
            logger.warning(f"SUPABASE_URL present: {bool(self.supabase_url)}")
            logger.warning(f"SUPABASE_ANON_KEY present: {bool(self.supabase_anon_key)}")
        else:
            logger.info("Supabase configuration found - database integration enabled")
    
    @property
    def client(self) -> Optional[Client]:
        """Get Supabase client instance"""
        if not self._client and self.supabase_url and self.supabase_anon_key:
            try:
                self._client = create_client(self.supabase_url, self.supabase_anon_key)
                logger.info("Supabase client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
                return None
        
        return self._client
    
    @property
    def is_configured(self) -> bool:
        """Check if database is properly configured"""
        return bool(self.supabase_url and self.supabase_anon_key)
    
    async def test_connection(self) -> bool:
        """Test database connection"""
        if not self.client:
            return False
        
        try:
            # Simple query to test connection
            result = self.client.table('smart_templates').select('id').limit(1).execute()
            logger.info("Database connection test successful")
            return True
        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            return False

# Global instance
db_config = DatabaseConfig()