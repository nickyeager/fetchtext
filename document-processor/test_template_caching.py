#!/usr/bin/env python3
"""
Test suite for template caching functionality
"""

import asyncio
import os
import sys
import time
from typing import Dict, List, Any

# Add current directory to path for imports
sys.path.append('.')

# Set environment variables for testing
os.environ['SUPABASE_URL'] = 'http://localhost:8000'
os.environ['SUPABASE_ANON_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU1MjQ0NTIzLCJleHAiOjE3ODY3ODA1MjN9.h6VsUD-W6BuvpX5giP6Q-WSKrwQa6-2PPlAPFUzvtzU'

async def test_cache_functionality():
    """Test basic cache get/set operations"""
    print("🧪 TEST 1: Basic Cache Functionality")
    print("-" * 40)
    
    try:
        from app.services.template_cache import TemplateCache
        
        cache = TemplateCache(default_ttl=5)  # 5 second TTL for testing
        
        # Test set and get
        test_key = "test_key"
        test_value = {"templates": ["template1", "template2"]}
        
        await cache.set(test_key, test_value)
        retrieved = await cache.get(test_key)
        
        assert retrieved == test_value, f"Expected {test_value}, got {retrieved}"
        print("✅ Cache set/get working correctly")
        
        # Test cache miss
        miss_result = await cache.get("non_existent_key")
        assert miss_result is None, "Cache miss should return None"
        print("✅ Cache miss handling correct")
        
        # Test TTL expiration
        await asyncio.sleep(6)  # Wait for TTL to expire
        expired_result = await cache.get(test_key)
        assert expired_result is None, "Expired cache entry should return None"
        print("✅ TTL expiration working correctly")
        
        # Test stats
        stats = cache.get_stats()
        assert stats['hits'] == 1, f"Expected 1 hit, got {stats['hits']}"
        assert stats['misses'] == 2, f"Expected 2 misses, got {stats['misses']}"
        print(f"✅ Cache stats: {stats}")
        
        return True
        
    except Exception as e:
        print(f"❌ Cache functionality test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_template_matching_with_cache():
    """Test template matching service with caching enabled"""
    print("\n🚀 TEST 2: Template Matching with Cache")
    print("-" * 40)
    
    try:
        from app.services.template_matching_service import template_matching_service
        
        # Clear cache before testing
        await template_matching_service.clear_cache()
        
        # First call - cache miss
        start_time = time.time()
        suggestions1 = await template_matching_service.find_matching_templates(
            document_type='invoice',
            content_keywords=['invoice', 'number', 'company', 'total'],
            min_confidence=0.6
        )
        first_call_time = time.time() - start_time
        
        print(f"✅ First call (cache miss): {first_call_time:.3f}s - {len(suggestions1)} suggestions")
        
        # Second identical call - cache hit
        start_time = time.time()
        suggestions2 = await template_matching_service.find_matching_templates(
            document_type='invoice',
            content_keywords=['invoice', 'number', 'company', 'total'],
            min_confidence=0.6
        )
        second_call_time = time.time() - start_time
        
        print(f"✅ Second call (cache hit): {second_call_time:.3f}s - {len(suggestions2)} suggestions")
        
        # Verify cache hit is faster
        assert second_call_time < first_call_time / 2, "Cache hit should be significantly faster"
        assert suggestions1 == suggestions2, "Results should be identical"
        
        # Check cache stats
        stats = await template_matching_service.get_cache_stats()
        print(f"✅ Cache performance: {stats['hit_rate']}% hit rate ({stats['hits']} hits, {stats['misses']} misses)")
        assert stats['hits'] > 0, "Should have cache hits"
        
        return True
        
    except Exception as e:
        print(f"❌ Template matching cache test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_cache_performance_impact():
    """Test performance improvement with caching"""
    print("\n⚡ TEST 3: Cache Performance Impact")
    print("-" * 40)
    
    try:
        from app.services.template_matching_service import template_matching_service
        
        # Test with cache disabled
        template_matching_service.disable_cache()
        
        start_time = time.time()
        tasks = []
        for i in range(10):
            task = template_matching_service.find_matching_templates(
                document_type='invoice',
                content_keywords=['invoice', 'test', str(i % 3)],  # 3 unique combinations
                min_confidence=0.6
            )
            tasks.append(task)
        
        await asyncio.gather(*tasks)
        no_cache_time = time.time() - start_time
        print(f"✅ Without cache: 10 requests in {no_cache_time:.3f}s")
        
        # Test with cache enabled
        template_matching_service.enable_cache()
        await template_matching_service.clear_cache()
        
        start_time = time.time()
        tasks = []
        for i in range(10):
            task = template_matching_service.find_matching_templates(
                document_type='invoice',
                content_keywords=['invoice', 'test', str(i % 3)],  # 3 unique combinations
                min_confidence=0.6
            )
            tasks.append(task)
        
        await asyncio.gather(*tasks)
        with_cache_time = time.time() - start_time
        print(f"✅ With cache: 10 requests in {with_cache_time:.3f}s")
        
        # Cache should improve performance for repeated queries
        improvement = ((no_cache_time - with_cache_time) / no_cache_time) * 100
        print(f"✅ Performance improvement: {improvement:.1f}%")
        
        # Get final cache stats
        stats = await template_matching_service.get_cache_stats()
        print(f"✅ Final cache stats: {stats}")
        assert stats['hits'] > 0, "Should have cache hits for repeated queries"
        
        return True
        
    except Exception as e:
        print(f"❌ Performance impact test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_cache_invalidation():
    """Test cache invalidation scenarios"""
    print("\n🔄 TEST 4: Cache Invalidation")
    print("-" * 40)
    
    try:
        from app.services.template_cache import TemplateCache
        
        cache = TemplateCache(default_ttl=60)
        
        # Set some values
        await cache.set("key1", "value1")
        await cache.set("key2", "value2")
        await cache.set("key3", "value3")
        
        # Verify all exist
        assert await cache.get("key1") == "value1"
        assert await cache.get("key2") == "value2"
        assert await cache.get("key3") == "value3"
        print("✅ All cache entries set")
        
        # Invalidate specific key
        await cache.invalidate("key2")
        assert await cache.get("key1") == "value1"
        assert await cache.get("key2") is None
        assert await cache.get("key3") == "value3"
        print("✅ Specific key invalidation working")
        
        # Clear entire cache
        await cache.clear()
        assert await cache.get("key1") is None
        assert await cache.get("key3") is None
        print("✅ Cache clear working")
        
        # Verify stats reset
        stats = cache.get_stats()
        assert stats['size'] == 0, "Cache should be empty after clear"
        print("✅ Cache stats reset after clear")
        
        return True
        
    except Exception as e:
        print(f"❌ Cache invalidation test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def run_cache_tests():
    """Run all cache-related tests"""
    print("🧪 TEMPLATE CACHING TEST SUITE")
    print("=" * 60)
    print("Testing cache functionality and performance impact")
    print("=" * 60)
    
    tests = [
        test_cache_functionality,
        test_template_matching_with_cache,
        test_cache_performance_impact,
        test_cache_invalidation
    ]
    
    passed_tests = 0
    total_tests = len(tests)
    
    for test_func in tests:
        try:
            result = await test_func()
            if result:
                passed_tests += 1
        except Exception as e:
            print(f"💥 Test {test_func.__name__} crashed: {e}")
    
    print("\n" + "=" * 60)
    if passed_tests == total_tests:
        print(f"🎉 ALL TESTS PASSED! ({passed_tests}/{total_tests})")
        print("✅ Template caching is working correctly")
    else:
        print(f"⚠️ {passed_tests}/{total_tests} tests passed")
        print("❌ Some cache tests failed")
    print("=" * 60)
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = asyncio.run(run_cache_tests())
    exit(0 if success else 1)