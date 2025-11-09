#!/usr/bin/env python3
"""
Comprehensive test for document evaluation timeout fix

Tests both the timeout handling and fallback mechanisms in document evaluation.
"""
import asyncio
import tempfile
import time
import pytest
import requests
from pathlib import Path
from unittest.mock import patch, AsyncMock

# Import the service
from app.services.document_evaluator import document_evaluator

class TestDocumentEvaluationTimeoutFix:
    """Test document evaluation timeout handling and fallback behavior"""
    
    def setup_method(self):
        """Setup test environment"""
        self.test_files = {}
        self.temp_dir = Path(tempfile.mkdtemp())
    
    def teardown_method(self):
        """Cleanup test files"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def create_test_file(self, filename: str, content: str = "Test content") -> Path:
        """Create a test file"""
        file_path = self.temp_dir / filename
        file_path.write_text(content)
        return file_path
    
    @pytest.mark.asyncio
    async def test_document_processing_timeout_handling(self):
        """Test that document processing timeout is handled correctly"""
        
        # Create a test PDF file (mock)
        test_file = self.create_test_file("test_invoice.pdf", "Invoice content")
        
        # Mock enhanced_docling_service to simulate timeout
        with patch('app.services.document_evaluator.enhanced_docling_service.process_document') as mock_process:
            # Simulate a timeout by making it sleep longer than the timeout
            async def slow_process(*args, **kwargs):
                await asyncio.sleep(50)  # Longer than default 45s timeout
                return {'status': 'completed', 'content': {'text': 'Invoice content'}}
            
            mock_process.side_effect = slow_process
            
            # Test evaluation with timeout
            result = await document_evaluator.evaluate_document(
                test_file, 
                "test_invoice.pdf", 
                "application/pdf", 
                quick_scan=True
            )
            
            # Should fallback to filename-based detection
            assert result['type_evaluation']['primary_type'] == 'invoice'
            assert result['type_evaluation']['detection_method'] == 'filename_pattern'
            assert result['type_evaluation']['confidence'] == 0.7
    
    @pytest.mark.asyncio
    async def test_template_query_timeout_handling(self):
        """Test that template query timeout is handled correctly"""
        
        test_file = self.create_test_file("test_invoice.txt", 
                                          "Invoice #12345\nTotal: $100.00\nDue Date: 2024-01-15")
        
        # Mock requests.get to simulate timeout
        with patch('requests.get') as mock_get:
            # Simulate timeout
            mock_get.side_effect = requests.exceptions.Timeout("Request timed out")
            
            result = await document_evaluator.evaluate_document(
                test_file,
                "test_invoice.txt", 
                "text/plain",
                quick_scan=True
            )
            
            # Should still work but with empty template suggestions
            assert result['type_evaluation']['primary_type'] == 'invoice'
            assert result['template_suggestions'] == []
    
    @pytest.mark.asyncio
    async def test_configuration_variables(self):
        """Test that timeout configuration variables work"""
        
        # Test default values
        assert document_evaluator.document_processing_timeout == 45.0
        assert document_evaluator.template_query_timeout == 10.0
        
        # Test with environment variables
        import os
        with patch.dict(os.environ, {
            'DOCUMENT_PROCESSING_TIMEOUT': '30.0',
            'TEMPLATE_QUERY_TIMEOUT': '5.0'
        }):
            from app.services.document_evaluator import DocumentEvaluator
            test_evaluator = DocumentEvaluator()
            assert test_evaluator.document_processing_timeout == 30.0
            assert test_evaluator.template_query_timeout == 5.0
    
    @pytest.mark.asyncio
    async def test_successful_evaluation_flow(self):
        """Test normal evaluation flow without timeouts"""
        
        test_file = self.create_test_file("test_receipt.txt", 
                                          "Store: SuperMart\nTotal: $45.67\nDate: 2024-01-15")
        
        # Mock successful processing
        with patch('app.services.document_evaluator.enhanced_docling_service.process_document') as mock_process:
            mock_process.return_value = {
                'status': 'completed',
                'content': {'text': 'Store: SuperMart\nTotal: $45.67\nDate: 2024-01-15'},
                'metadata': {'pages': 1}
            }
            
            # Mock successful template query
            with patch('requests.get') as mock_get:
                mock_response = AsyncMock()
                mock_response.status_code = 200
                mock_response.json.return_value = [
                    {
                        'id': 1,
                        'name': 'Receipt Template',
                        'category': 'receipt',
                        'description': 'Standard receipt processing',
                        'smart_variables': [],
                        'usage_count': 10
                    }
                ]
                mock_response.raise_for_status = AsyncMock()
                mock_get.return_value = mock_response
                
                result = await document_evaluator.evaluate_document(
                    test_file,
                    "test_receipt.txt",
                    "text/plain",
                    quick_scan=True
                )
                
                # Should detect receipt type
                assert result['type_evaluation']['primary_type'] == 'receipt'
                assert result['type_evaluation']['confidence'] > 0.7
                assert len(result['template_suggestions']) > 0
                assert result['template_suggestions'][0]['template_name'] == 'Receipt Template'
    
    @pytest.mark.asyncio
    async def test_unsupported_format_handling(self):
        """Test handling of unsupported file formats"""
        
        test_file = self.create_test_file("test.xyz", "Unknown format content")
        
        result = await document_evaluator.evaluate_document(
            test_file,
            "test.xyz",
            "application/octet-stream",
            quick_scan=True
        )
        
        assert result['type_evaluation']['primary_type'] == 'unsupported'
        assert result['type_evaluation']['confidence'] == 1.0
        assert result['processing_recommendations']['workflow'] == 'unsupported'
    
    @pytest.mark.asyncio
    async def test_fallback_detection_methods(self):
        """Test various fallback detection methods"""
        
        test_cases = [
            ("contract_agreement.pdf", "contract", 0.7),
            ("resume_john_doe.docx", "resume", 0.8),
            ("sales_report.txt", "report", 0.6),
            ("unknown_file.pdf", "unknown", 0.0)
        ]
        
        for filename, expected_type, expected_confidence in test_cases:
            test_file = self.create_test_file(filename, "Test content")
            
            # Mock processing to fail so it falls back to filename detection
            with patch('app.services.document_evaluator.enhanced_docling_service.process_document') as mock_process:
                mock_process.return_value = {'status': 'failed'}
                
                result = await document_evaluator.evaluate_document(
                    test_file,
                    filename,
                    "application/pdf",
                    quick_scan=True
                )
                
                assert result['type_evaluation']['primary_type'] == expected_type
                assert result['type_evaluation']['confidence'] == expected_confidence
                assert result['type_evaluation']['detection_method'] == 'filename_pattern'

    def test_pattern_scoring_algorithm(self):
        """Test the pattern scoring algorithm used for document type detection"""
        
        test_text = "Invoice #12345 from ACME Corp. Total amount due: $1,234.56. Payment due by January 31, 2024."
        
        # Test invoice detection
        invoice_keywords = ['invoice', 'bill', 'payment', 'due', 'total', 'amount', 'tax']
        score = document_evaluator._calculate_pattern_score(test_text, invoice_keywords)
        assert score > 0.8  # Should be high confidence for invoice
        
        # Test contract detection on invoice text (should be low)
        contract_keywords = ['agreement', 'contract', 'terms', 'party', 'signature', 'whereas']
        score = document_evaluator._calculate_pattern_score(test_text, contract_keywords)
        assert score < 0.3  # Should be low confidence for contract
    
    def test_key_phrase_extraction(self):
        """Test key phrase extraction functionality"""
        
        test_text = """
        Invoice #12345
        ACME Corporation
        Total Amount: $1,234.56
        Payment Due Date: January 31, 2024
        Customer: John Smith
        """
        
        phrases = document_evaluator._extract_key_phrases(test_text, limit=5)
        
        # Should extract meaningful terms
        expected_phrases = ['invoice', 'acme', 'corporation', 'total', 'amount']
        for phrase in expected_phrases:
            assert any(phrase in p.lower() for p in phrases), f"Expected phrase '{phrase}' not found in {phrases}"

async def run_comprehensive_test():
    """Run all tests and report results"""
    
    print("🧪 Running comprehensive document evaluation timeout fix tests...")
    
    test_instance = TestDocumentEvaluationTimeoutFix()
    test_methods = [method for method in dir(test_instance) if method.startswith('test_')]
    
    passed = 0
    failed = 0
    
    for method_name in test_methods:
        try:
            test_instance.setup_method()
            method = getattr(test_instance, method_name)
            
            if asyncio.iscoroutinefunction(method):
                await method()
            else:
                method()
            
            print(f"✅ {method_name}")
            passed += 1
        except Exception as e:
            print(f"❌ {method_name}: {str(e)}")
            failed += 1
        finally:
            test_instance.teardown_method()
    
    print(f"\n📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All timeout fix tests passed! The document evaluation should now handle timeouts gracefully.")
    else:
        print(f"⚠️  {failed} tests failed. Please review the implementation.")
    
    return failed == 0

if __name__ == "__main__":
    success = asyncio.run(run_comprehensive_test())
    exit(0 if success else 1)