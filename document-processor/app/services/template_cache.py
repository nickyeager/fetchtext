"""
Template caching service for optimizing database queries
"""

import logging
import time
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import asyncio

logger = logging.getLogger(__name__)

class TemplateCache:
    """In-memory cache for template data with TTL support"""
    
    def __init__(self, default_ttl: int = 300):  # 5 minutes default
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.default_ttl = default_ttl
        self.logger = logging.getLogger(__name__)
        self._lock = asyncio.Lock()
        
        # Performance metrics
        self.hits = 0
        self.misses = 0
        self.last_cleanup = time.time()
        
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        async with self._lock:
            if key in self.cache:
                entry = self.cache[key]
                if time.time() < entry['expires_at']:
                    self.hits += 1
                    self.logger.debug(f"Cache hit for key: {key}")
                    return entry['value']
                else:
                    # Remove expired entry
                    del self.cache[key]
                    self.logger.debug(f"Cache expired for key: {key}")
            
            self.misses += 1
            self.logger.debug(f"Cache miss for key: {key}")
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache with TTL"""
        expires_at = time.time() + (ttl or self.default_ttl)
        
        async with self._lock:
            self.cache[key] = {
                'value': value,
                'expires_at': expires_at,
                'created_at': time.time()
            }
            self.logger.debug(f"Cached key: {key}, TTL: {ttl or self.default_ttl}s")
            
            # Cleanup expired entries periodically
            if time.time() - self.last_cleanup > 60:  # Every minute
                await self._cleanup_expired()
    
    async def invalidate(self, key: str) -> None:
        """Remove specific key from cache"""
        async with self._lock:
            if key in self.cache:
                del self.cache[key]
                self.logger.debug(f"Invalidated cache key: {key}")
    
    async def clear(self) -> None:
        """Clear entire cache"""
        async with self._lock:
            self.cache.clear()
            self.hits = 0
            self.misses = 0
            self.logger.info("Cache cleared")
    
    async def _cleanup_expired(self) -> None:
        """Remove expired entries from cache"""
        current_time = time.time()
        expired_keys = [
            key for key, entry in self.cache.items() 
            if current_time >= entry['expires_at']
        ]
        
        for key in expired_keys:
            del self.cache[key]
        
        if expired_keys:
            self.logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")
        
        self.last_cleanup = current_time
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        total_requests = self.hits + self.misses
        hit_rate = (self.hits / total_requests) if total_requests > 0 else 0
        
        return {
            'hits': self.hits,
            'misses': self.misses,
            'hit_rate': round(hit_rate * 100, 2),
            'size': len(self.cache),
            'total_requests': total_requests
        }

class CachedTemplateMatchingService:
    """Wrapper for template matching service with caching"""
    
    def __init__(self, template_service, cache_ttl: int = 300):
        self.template_service = template_service
        self.cache = TemplateCache(default_ttl=cache_ttl)
        self.logger = logging.getLogger(__name__)
        
    async def find_matching_templates(
        self,
        document_type: str,
        content_keywords: List[str],
        min_confidence: float = 0.6
    ) -> List[Dict[str, Any]]:
        """Find matching templates with caching"""
        
        # Create cache key from parameters
        cache_key = self._create_cache_key(document_type, content_keywords, min_confidence)
        
        # Check cache first
        cached_result = await self.cache.get(cache_key)
        if cached_result is not None:
            return cached_result
        
        # If not in cache, call actual service
        result = await self.template_service.find_matching_templates(
            document_type=document_type,
            content_keywords=content_keywords,
            min_confidence=min_confidence
        )
        
        # Cache the result
        await self.cache.set(cache_key, result)
        
        return result
    
    def _create_cache_key(
        self, 
        document_type: str, 
        content_keywords: List[str], 
        min_confidence: float
    ) -> str:
        """Create consistent cache key from parameters"""
        # Sort keywords for consistent keys
        sorted_keywords = sorted(content_keywords[:10])  # Limit to first 10 keywords
        keywords_str = ','.join(sorted_keywords)
        return f"templates:{document_type}:{keywords_str}:{min_confidence}"
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        return self.cache.get_stats()
    
    async def clear_cache(self) -> None:
        """Clear template cache"""
        await self.cache.clear()

# Global cache instance (optional - can be initialized in template_matching_service.py)
template_cache = TemplateCache(default_ttl=300)  # 5 minute TTL