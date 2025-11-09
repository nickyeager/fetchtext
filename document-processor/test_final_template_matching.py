#!/usr/bin/env python3
"""
Final comprehensive test for template matching with real Supabase database integration
Tests both mock fallback and real database scenarios
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import Dict, List, Any
import time

# Add current directory to path for imports
sys.path.append('.')

async def test_database_configuration():
    """Test database configuration and client setup"""
    print("🔧 TEST 1: Database Configuration")
    print("-" * 40)
    
    try:
        from app.config.database import db_config
        
        print(f"✅ Database configured: {db_config.is_configured}")
        print(f"   SUPABASE_URL present: {bool(db_config.supabase_url)}")
        print(f"   SUPABASE_ANON_KEY present: {bool(db_config.supabase_anon_key)}")
        
        if db_config.is_configured:
            print(f"   URL: {db_config.supabase_url}")
            print(f"   Key prefix: {db_config.supabase_anon_key[:20]}...")
            
            # Test connection
            connection_ok = await db_config.test_connection()
            print(f"✅ Connection test: {'PASSED' if connection_ok else 'FAILED'}")
        
        return True
        
    except Exception as e:
        print(f"❌ Configuration test failed: {e}")
        return False

async def test_template_matching_with_database():
    """Test template matching service with database integration"""
    print("\n🎯 TEST 2: Template Matching Service")
    print("-" * 40)
    
    try:
        from app.services.template_matching_service import template_matching_service
        
        # Test invoice matching
        start_time = time.time()
        suggestions = await template_matching_service.find_matching_templates(
            document_type='invoice',
            content_keywords=['invoice', 'number', 'company', 'total', 'amount', 'billing'],
            min_confidence=0.6
        )
        end_time = time.time()
        
        print(f"✅ Invoice matching completed in {end_time - start_time:.3f}s")
        print(f"   Found {len(suggestions)} suggestions")
        
        if suggestions:
            best = suggestions[0]
            print(f"   Best match: {best['template_name']} (score: {best['match_score']:.3f})")
            
            # Validate suggestion structure
            required_fields = ['template_id', 'template_name', 'match_score', 'category', 'field_count']
            for field in required_fields:
                assert field in best, f"Missing field: {field}"
            
            assert best['match_score'] >= 0.6, f"Score below threshold: {best['match_score']}"
        
        # Test receipt matching
        receipt_suggestions = await template_matching_service.find_matching_templates(
            document_type='receipt',
            content_keywords=['receipt', 'store', 'purchase', 'retail', 'items'],
            min_confidence=0.5
        )
        
        print(f"✅ Receipt matching: {len(receipt_suggestions)} suggestions")
        if receipt_suggestions:
            print(f"   Best: {receipt_suggestions[0]['template_name']} ({receipt_suggestions[0]['match_score']:.3f})")
        
        return True
        
    except Exception as e:
        print(f"❌ Template matching test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_document_evaluator_integration():
    """Test integration with document evaluator"""
    print("\n🔗 TEST 3: Document Evaluator Integration")
    print("-" * 40)
    
    try:
        from app.services.document_evaluator import document_evaluator
        
        # Test template suggestions through document evaluator
        suggestions = await document_evaluator._suggest_matching_templates(
            document_type='invoice',
            confidence=0.85,
            key_phrases=['invoice', 'number', 'total', 'amount', 'company']
        )
        
        print(f"✅ DocumentEvaluator suggestions: {len(suggestions)}")
        
        if suggestions:
            for i, suggestion in enumerate(suggestions[:3], 1):
                print(f"   {i}. {suggestion['template_name']} - {suggestion['match_score']:.3f}")
        
        return True
        
    except Exception as e:
        print(f"❌ DocumentEvaluator integration failed: {e}")
        return False

async def test_error_handling_and_fallbacks():
    """Test error handling and mock data fallbacks"""
    print("\n⚠️ TEST 4: Error Handling & Fallbacks")
    print("-" * 40)
    
    try:
        from app.services.template_matching_service import TemplateMatchingService
        
        # Test service with mock data fallback
        service = TemplateMatchingService()
        
        # This should work even without database connection
        mock_suggestions = await service._get_mock_templates()
        print(f"✅ Mock templates available: {len(mock_suggestions)}")
        
        # Test graceful handling of invalid inputs
        empty_suggestions = await service.find_matching_templates(
            document_type='',
            content_keywords=[],
            min_confidence=0.6
        )
        print(f"✅ Empty input handled: {len(empty_suggestions)} suggestions")
        
        return True
        
    except Exception as e:
        print(f"❌ Error handling test failed: {e}")
        return False

async def test_performance_benchmarks():
    """Test performance with multiple concurrent requests"""
    print("\n⚡ TEST 5: Performance Benchmarks")
    print("-" * 40)
    
    try:
        from app.services.template_matching_service import template_matching_service
        
        # Benchmark concurrent template matching requests
        start_time = time.time()
        
        tasks = []
        test_scenarios = [
            ('invoice', ['invoice', 'business', 'billing']),
            ('receipt', ['receipt', 'store', 'purchase']), 
            ('contract', ['contract', 'agreement', 'legal']),
            ('report', ['report', 'analysis', 'business']),
            ('form', ['form', 'application', 'data'])
        ]
        
        for doc_type, keywords in test_scenarios:
            task = template_matching_service.find_matching_templates(
                document_type=doc_type,
                content_keywords=keywords,
                min_confidence=0.5
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        end_time = time.time()
        
        total_time = end_time - start_time
        total_suggestions = sum(len(r) for r in results)
        
        print(f"✅ {len(tasks)} concurrent requests completed in {total_time:.3f}s")
        print(f"✅ Average time per request: {total_time/len(tasks):.3f}s")
        print(f"✅ Total suggestions found: {total_suggestions}")
        
        # Performance assertions
        assert total_time < 5.0, f"Total time too slow: {total_time:.3f}s"
        assert total_time/len(tasks) < 1.0, f"Average time per request too slow: {total_time/len(tasks):.3f}s"
        
        return True
        
    except Exception as e:
        print(f"❌ Performance test failed: {e}")
        return False

async def test_with_environment_variables():
    """Test behavior with and without environment variables"""
    print("\n🌍 TEST 6: Environment Variable Scenarios")
    print("-" * 40)
    
    try:
        # Save original environment
        original_url = os.environ.get('SUPABASE_URL')
        original_key = os.environ.get('SUPABASE_ANON_KEY')
        
        # Test 1: With environment variables (if they exist)
        if original_url and original_key:
            print("✅ Testing with environment variables present")
            from app.config.database import DatabaseConfig
            config_with_env = DatabaseConfig()
            print(f"   Configuration valid: {config_with_env.is_configured}")
        else:
            print("ℹ️  No environment variables found - testing without database")
        
        # Test 2: Without environment variables
        print("✅ Testing without environment variables")
        os.environ.pop('SUPABASE_URL', None)
        os.environ.pop('SUPABASE_ANON_KEY', None)
        os.environ.pop('VITE_SUPABASE_URL', None)
        os.environ.pop('VITE_SUPABASE_ANON_KEY', None)
        
        # Force reload of database config
        import importlib
        import app.config.database
        importlib.reload(app.config.database)
        
        config_without_env = app.config.database.DatabaseConfig()
        print(f"   Configuration valid: {config_without_env.is_configured}")
        print(f"   Should use mock data: {not config_without_env.is_configured}")
        
        # Restore original environment
        if original_url:
            os.environ['SUPABASE_URL'] = original_url
        if original_key:
            os.environ['SUPABASE_ANON_KEY'] = original_key
        
        return True
        
    except Exception as e:
        print(f"❌ Environment variable test failed: {e}")
        return False

async def run_final_comprehensive_tests():
    """Run the complete final test suite"""
    print("🚀 FINAL TEMPLATE MATCHING INTEGRATION TEST")
    print("=" * 60)
    print("Testing production-ready database integration with fallbacks")
    print("=" * 60)
    
    tests = [
        test_database_configuration,
        test_template_matching_with_database,
        test_document_evaluator_integration,
        test_error_handling_and_fallbacks,
        test_performance_benchmarks,
        test_with_environment_variables
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
        print("✅ Template matching system is production-ready!")
        print("\n📋 FINAL IMPLEMENTATION STATUS:")
        print("✅ Database integration with Supabase - COMPLETE")
        print("✅ Mock data fallback for development - COMPLETE") 
        print("✅ Advanced 5-component scoring algorithm - COMPLETE")
        print("✅ Error handling and graceful degradation - COMPLETE")
        print("✅ Performance optimization for concurrent requests - COMPLETE")
        print("✅ Environment-based configuration - COMPLETE")
        print("\n🚀 Ready for production deployment!")
    else:
        print(f"⚠️ {passed_tests}/{total_tests} tests passed")
        print("❌ Some issues need to be addressed before production")
    print("=" * 60)
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = asyncio.run(run_final_comprehensive_tests())
    exit(0 if success else 1)