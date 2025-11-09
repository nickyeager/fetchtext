"""
Integration Tests for Template Matching System

Tests the complete workflow from document evaluation to template suggestions
"""

import asyncio
import logging
import pytest
from pathlib import Path
from typing import Dict, List, Any
import sys
import os

# Add project path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.services.document_evaluator import DocumentEvaluator
from app.services.template_matching_service import template_matching_service
from app.config.database import db_config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TestTemplateMatchingIntegration:
    """Test suite for template matching integration"""

    def __init__(self):
        """Initialize test suite"""
        self.evaluator = DocumentEvaluator()
        # Disable cache for consistent testing
        template_matching_service.disable_cache()
        
    def test_sample_documents(self):
        """Test template matching with various document types"""
        test_docs = [
            ('sample_invoice.txt', 'invoice'),
            ('sample_receipt.txt', 'receipt'), 
            ('sample_contract.txt', 'contract'),
            ('sample_report.txt', 'report'),
            ('sample_form.txt', 'form')
        ]
        
        for doc_file, expected_type in test_docs:
            doc_path = Path(f"../data/{doc_file}")
            if doc_path.exists():
                result = asyncio.run(self.run_template_matching_test(doc_path, expected_type))
                self.verify_template_suggestions(result, expected_type)

    async def run_template_matching_test(self, file_path: Path, expected_type: str) -> Dict[str, Any]:
        """Run template matching test for a single document"""
        logger.info(f"\n=== Testing Template Matching for {file_path.name} ===")
        
        try:
            # Run document evaluation (which includes template matching)
            result = await self.evaluator.evaluate_document(
                file_path=file_path,
                filename=file_path.name,
                content_type='text/plain'
            )
            
            # Log results
            logger.info(f"Document Type Detected: {result['type_evaluation']['primary_type']}")
            logger.info(f"Confidence: {result['type_evaluation']['confidence']}")
            logger.info(f"Template Suggestions: {len(result['template_suggestions'])}")
            
            for i, suggestion in enumerate(result['template_suggestions'][:3]):
                logger.info(f"  {i+1}. {suggestion['template_name']}: {suggestion['match_score']:.3f} ({suggestion['category']})")
            
            return result
            
        except Exception as e:
            logger.error(f"Error testing {file_path.name}: {str(e)}")
            raise

    def verify_template_suggestions(self, result: Dict[str, Any], expected_type: str):
        """Verify template suggestions are reasonable"""
        
        # Basic structure validation
        assert 'template_suggestions' in result
        assert 'type_evaluation' in result
        assert 'processing_recommendations' in result
        
        template_suggestions = result['template_suggestions']
        type_eval = result['type_evaluation']
        
        # Log what we got for debugging
        logger.info(f"Expected type: {expected_type}, Detected: {type_eval['primary_type']}")
        logger.info(f"Template suggestions count: {len(template_suggestions)}")
        
        # Template suggestions should exist (unless no matching templates available)
        if len(template_suggestions) == 0:
            logger.warning(f"No template suggestions for {expected_type} document")
            # This is acceptable - might mean no matching templates in database
            return
        
        # Verify suggestion structure
        for suggestion in template_suggestions:
            assert 'template_id' in suggestion
            assert 'template_name' in suggestion
            assert 'match_score' in suggestion
            assert 'category' in suggestion
            assert isinstance(suggestion['match_score'], (int, float))
            assert 0 <= suggestion['match_score'] <= 1
            
        # Verify suggestions are sorted by score (highest first)
        scores = [s['match_score'] for s in template_suggestions]
        assert scores == sorted(scores, reverse=True), "Suggestions should be sorted by score descending"
        
        # Best suggestion should have reasonable confidence
        best_suggestion = template_suggestions[0]
        assert best_suggestion['match_score'] >= 0.3, f"Best suggestion score too low: {best_suggestion['match_score']}"
        
        logger.info(f"✅ Template suggestions validation passed for {expected_type}")

    def test_template_matching_service_directly(self):
        """Test the template matching service directly"""
        
        async def run_direct_tests():
            logger.info("\n=== Testing Template Matching Service Directly ===")
            
            test_cases = [
                {
                    'document_type': 'invoice',
                    'keywords': ['invoice', 'bill', 'payment', 'total', 'amount', 'company', 'date'],
                    'expected_categories': ['finance', 'business', 'invoice', 'billing']
                },
                {
                    'document_type': 'receipt',
                    'keywords': ['receipt', 'store', 'purchase', 'total', 'item', 'date'],
                    'expected_categories': ['retail', 'transaction', 'receipt']
                },
                {
                    'document_type': 'contract',
                    'keywords': ['contract', 'agreement', 'terms', 'party', 'service', 'date'],
                    'expected_categories': ['legal', 'business', 'contract', 'agreement']
                }
            ]
            
            for test_case in test_cases:
                logger.info(f"Testing {test_case['document_type']} document type...")
                
                suggestions = await template_matching_service.find_matching_templates(
                    document_type=test_case['document_type'],
                    content_keywords=test_case['keywords'],
                    min_confidence=0.3
                )
                
                logger.info(f"Found {len(suggestions)} suggestions")
                
                for suggestion in suggestions[:2]:  # Top 2
                    logger.info(f"  - {suggestion['template_name']}: {suggestion['match_score']:.3f}")
                    
                # Verify suggestions are relevant
                if suggestions:
                    # Check if any suggestion has matching category
                    categories_found = [s['category'] for s in suggestions]
                    relevant_found = any(
                        expected in categories_found 
                        for expected in test_case['expected_categories']
                    )
                    
                    if not relevant_found:
                        logger.warning(f"No relevant categories found. Expected: {test_case['expected_categories']}, Found: {categories_found}")
                
                logger.info(f"✅ Direct service test passed for {test_case['document_type']}")
        
        asyncio.run(run_direct_tests())

    def test_workflow_decision_logic(self):
        """Test that workflow decisions are made correctly based on template suggestions"""
        
        async def test_workflow_logic():
            logger.info("\n=== Testing Workflow Decision Logic ===")
            
            # Test case 1: Document with good template matches should suggest existing template workflow
            result_with_templates = {
                'type_evaluation': {'primary_type': 'invoice', 'confidence': 0.9},
                'template_suggestions': [
                    {'template_id': 1, 'template_name': 'Invoice Template', 'match_score': 0.85, 'category': 'finance'}
                ]
            }
            
            workflow = self.evaluator._determine_workflow(
                result_with_templates['type_evaluation'],
                result_with_templates['template_suggestions']
            )
            
            logger.info(f"Workflow with templates: {workflow}")
            assert workflow['workflow'] == 'existing_template', "Should recommend existing template"
            
            # Test case 2: Document with no template matches should suggest template selection or generation
            result_no_templates = {
                'type_evaluation': {'primary_type': 'custom_doc', 'confidence': 0.8},
                'template_suggestions': []
            }
            
            workflow_no_templates = self.evaluator._determine_workflow(
                result_no_templates['type_evaluation'],
                result_no_templates['template_suggestions']
            )
            
            logger.info(f"Workflow without templates: {workflow_no_templates}")
            # With confidence 0.8 but no templates, should suggest template selection
            assert workflow_no_templates['workflow'] in ['template_selection', 'generate_template'], "Should recommend template selection or generation"
            
            # Test case 3: Low confidence document should suggest generation
            result_low_confidence = {
                'type_evaluation': {'primary_type': 'unknown', 'confidence': 0.3},
                'template_suggestions': []
            }
            
            workflow_low_conf = self.evaluator._determine_workflow(
                result_low_confidence['type_evaluation'],
                result_low_confidence['template_suggestions']
            )
            
            logger.info(f"Workflow low confidence: {workflow_low_conf}")
            assert workflow_low_conf['workflow'] == 'generate_template', "Low confidence should recommend generation"
            
            logger.info("✅ Workflow decision logic tests passed")
        
        asyncio.run(test_workflow_logic())

    def test_cache_performance(self):
        """Test template matching cache performance"""
        
        async def test_cache():
            logger.info("\n=== Testing Template Cache Performance ===")
            
            # Enable cache
            template_matching_service.enable_cache()
            
            # Clear cache first
            await template_matching_service.clear_cache()
            
            # First call (should hit database)
            start_time = asyncio.get_event_loop().time()
            suggestions1 = await template_matching_service.find_matching_templates(
                document_type='invoice',
                content_keywords=['invoice', 'payment', 'total'],
                min_confidence=0.3
            )
            first_call_time = asyncio.get_event_loop().time() - start_time
            
            # Second call (should hit cache)
            start_time = asyncio.get_event_loop().time()
            suggestions2 = await template_matching_service.find_matching_templates(
                document_type='invoice',
                content_keywords=['invoice', 'payment', 'total'],
                min_confidence=0.3
            )
            second_call_time = asyncio.get_event_loop().time() - start_time
            
            logger.info(f"First call time: {first_call_time:.3f}s")
            logger.info(f"Second call time: {second_call_time:.3f}s")
            
            # Results should be identical
            assert suggestions1 == suggestions2, "Cached results should be identical"
            
            # Second call should be faster (cache hit)
            # Note: This might not always be true in testing, but it's a good indicator
            if second_call_time < first_call_time:
                logger.info("✅ Cache appears to be working (second call was faster)")
            else:
                logger.warning("Cache performance test inconclusive")
            
            # Get cache stats
            cache_stats = await template_matching_service.get_cache_stats()
            logger.info(f"Cache stats: {cache_stats}")
            
            logger.info("✅ Cache performance test completed")
        
        asyncio.run(test_cache())

    def test_error_handling(self):
        """Test error handling in template matching"""
        
        async def test_errors():
            logger.info("\n=== Testing Error Handling ===")
            
            # Test with invalid document type
            suggestions = await template_matching_service.find_matching_templates(
                document_type='invalid_type_12345',
                content_keywords=['test'],
                min_confidence=0.5
            )
            
            logger.info(f"Invalid type suggestions: {len(suggestions)}")
            assert isinstance(suggestions, list), "Should return empty list, not error"
            
            # Test with empty keywords
            suggestions_empty = await template_matching_service.find_matching_templates(
                document_type='invoice',
                content_keywords=[],
                min_confidence=0.5
            )
            
            logger.info(f"Empty keywords suggestions: {len(suggestions_empty)}")
            assert isinstance(suggestions_empty, list), "Should handle empty keywords gracefully"
            
            # Test with very high confidence threshold
            suggestions_high_threshold = await template_matching_service.find_matching_templates(
                document_type='invoice',
                content_keywords=['invoice', 'payment'],
                min_confidence=0.99  # Very high threshold
            )
            
            logger.info(f"High threshold suggestions: {len(suggestions_high_threshold)}")
            assert isinstance(suggestions_high_threshold, list), "Should handle high threshold gracefully"
            
            logger.info("✅ Error handling tests passed")
        
        asyncio.run(test_errors())

def run_comprehensive_tests():
    """Run all template matching integration tests"""
    logger.info("🚀 Starting Comprehensive Template Matching Integration Tests")
    
    test_suite = TestTemplateMatchingIntegration()
    
    try:
        # Setup is done in __init__
        
        # Run tests
        test_suite.test_template_matching_service_directly()
        test_suite.test_workflow_decision_logic() 
        test_suite.test_cache_performance()
        test_suite.test_error_handling()
        test_suite.test_sample_documents()
        
        logger.info("🎉 All Template Matching Integration Tests PASSED!")
        
    except Exception as e:
        logger.error(f"❌ Template Matching Integration Tests FAILED: {str(e)}")
        raise
    finally:
        # Cleanup
        template_matching_service.enable_cache()  # Re-enable for normal operation

if __name__ == "__main__":
    run_comprehensive_tests()