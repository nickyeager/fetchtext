import pytest
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
import json

from app.main import app
from app.services.document_evaluator import document_evaluator

client = TestClient(app)


class TestDocumentTypeDetection:
    """Test suite for document type evaluation endpoint"""
    
    @pytest.fixture
    def sample_documents(self):
        """Provide sample documents for testing"""
        return {
            'invoice_html': self._create_sample_invoice_html(),
            'contract_html': self._create_sample_contract_html(),
            'receipt_text': self._create_sample_receipt_text(),
            'report_html': self._create_sample_report_html(),
            'unknown_text': self._create_unknown_document(),
            'unsupported_file': self._create_unsupported_file()
        }
    
    def _create_sample_invoice_html(self) -> Path:
        """Create a sample invoice HTML file"""
        content = '''
        <!DOCTYPE html>
        <html>
        <head><title>Invoice</title></head>
        <body>
            <h1>INVOICE</h1>
            <p><strong>ABC Company Inc.</strong></p>
            <p>Invoice #: INV-2024-001</p>
            <p>Date: January 15, 2024</p>
            <p>Due Date: February 15, 2024</p>
            <p>Bill To: John Customer</p>
            <table>
                <tr><th>Description</th><th>Amount</th></tr>
                <tr><td>Consulting Services</td><td>$1,500.00</td></tr>
                <tr><td>Software License</td><td>$500.00</td></tr>
            </table>
            <p><strong>Total Due: $2,000.00</strong></p>
            <p>Payment Terms: Net 30 days</p>
        </body>
        </html>
        '''
        return self._create_temp_file(content, '.html')
    
    def _create_sample_contract_html(self) -> Path:
        """Create a sample contract HTML file"""
        content = '''
        <!DOCTYPE html>
        <html>
        <head><title>Service Agreement</title></head>
        <body>
            <h1>SERVICE AGREEMENT</h1>
            <p>This agreement is entered into between Party A and Party B.</p>
            <p>WHEREAS, Party A agrees to provide services...</p>
            <p>WHEREAS, Party B agrees to pay for services...</p>
            <p>The terms of this contract are as follows:</p>
            <ol>
                <li>Scope of services</li>
                <li>Payment terms</li>
                <li>Duration of agreement</li>
                <li>Termination clause</li>
            </ol>
            <p>Signature: ___________________ Date: ___________</p>
            <p>Signature: ___________________ Date: ___________</p>
        </body>
        </html>
        '''
        return self._create_temp_file(content, '.html')
    
    def _create_sample_receipt_text(self) -> Path:
        """Create a sample receipt text file"""
        content = '''
        WALMART SUPERCENTER
        123 Main Street
        Anytown, ST 12345
        Phone: (555) 123-4567
        
        RECEIPT
        Transaction ID: 1234567890
        Date: 07/29/2024
        Time: 14:30:25
        Cashier: Jane D.
        
        ITEMS PURCHASED:
        Milk (1 gal)         $3.99
        Bread               $2.49
        Eggs (12 ct)        $2.99
        Bananas (2 lbs)     $1.98
        
        Subtotal:           $11.45
        Tax:                $0.92
        TOTAL:              $12.37
        
        Payment Method: VISA ****1234
        Change: $0.00
        
        Thank you for shopping with us!
        '''
        return self._create_temp_file(content, '.txt')
    
    def _create_sample_report_html(self) -> Path:
        """Create a sample business report HTML file"""
        content = '''
        <!DOCTYPE html>
        <html>
        <head><title>Quarterly Business Report</title></head>
        <body>
            <h1>Q1 2024 BUSINESS REPORT</h1>
            <p>Prepared by: John Analyst</p>
            <p>Report Date: April 1, 2024</p>
            
            <h2>Executive Summary</h2>
            <p>This report presents our analysis of Q1 2024 performance...</p>
            
            <h2>Key Findings</h2>
            <ul>
                <li>Revenue increased by 15%</li>
                <li>Customer satisfaction improved</li>
                <li>Market share expanded</li>
            </ul>
            
            <h2>Analysis</h2>
            <p>Our detailed analysis shows significant growth...</p>
            
            <h2>Recommendations</h2>
            <p>Based on our findings, we recommend...</p>
            
            <h2>Conclusion</h2>
            <p>In conclusion, the company has performed well...</p>
        </body>
        </html>
        '''
        return self._create_temp_file(content, '.html')
    
    def _create_unknown_document(self) -> Path:
        """Create an unknown document type"""
        content = '''
        Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        Ut enim ad minim veniam, quis nostrud exercitation ullamco
        laboris nisi ut aliquip ex ea commodo consequat.
        '''
        return self._create_temp_file(content, '.txt')
    
    def _create_unsupported_file(self) -> Path:
        """Create an unsupported file type"""
        content = b'\\x89PNG\\r\\n\\x1a\\n\\x00\\x00\\x00\\rIHDR'  # Fake PNG header
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.xyz')
        temp_file.write(content)
        temp_file.close()
        return Path(temp_file.name)
    
    def _create_temp_file(self, content: str, suffix: str) -> Path:
        """Helper to create temporary files"""
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode='w')
        temp_file.write(content)
        temp_file.close()
        return Path(temp_file.name)
    
    def test_invoice_detection_quick_scan(self, sample_documents):
        """Test accurate invoice detection with quick scan"""
        file_path = sample_documents['invoice_html']
        
        with open(file_path, 'rb') as f:
            response = client.post(
                "/api/enhanced-documents/evaluate-document-type",
                files={"file": ("invoice.html", f, "text/html")},
                params={"quick_scan": True, "suggest_templates": True}
            )
        
        assert response.status_code == 200
        result = response.json()
        
        # Verify document info
        assert result['document_info']['format_supported'] is True
        assert result['document_info']['file_extension'] == '.html'
        
        # Verify type detection
        assert result['type_evaluation']['primary_type'] == 'invoice'
        assert result['type_evaluation']['confidence'] > 0.6
        assert result['type_evaluation']['detection_method'] == 'quick_pattern_matching'
        
        # Verify template suggestions
        assert len(result['template_suggestions']) > 0
        assert result['template_suggestions'][0]['category'] == 'Financial'
        assert result['template_suggestions'][0]['match_score'] > 0.5
        
        # Verify processing recommendations
        assert result['processing_recommendations']['workflow'] in ['existing_template', 'template_selection']
        assert 'template' in result['processing_recommendations']['suggested_action'].lower()
        
        # Cleanup
        file_path.unlink()
    
    def test_contract_detection(self, sample_documents):
        """Test accurate contract detection"""
        file_path = sample_documents['contract_html']
        
        with open(file_path, 'rb') as f:
            response = client.post(
                "/api/enhanced-documents/evaluate-document-type",
                files={"file": ("contract.html", f, "text/html")},
                params={"quick_scan": True}
            )
        
        assert response.status_code == 200
        result = response.json()
        
        assert result['type_evaluation']['primary_type'] == 'contract'
        assert result['type_evaluation']['confidence'] > 0.5
        
        # Should suggest legal templates
        if result['template_suggestions']:
            assert result['template_suggestions'][0]['category'] == 'Legal'
        
        # Cleanup
        file_path.unlink()
    
    def test_receipt_detection(self, sample_documents):
        """Test receipt detection"""
        file_path = sample_documents['receipt_text']
        
        with open(file_path, 'rb') as f:
            response = client.post(
                "/api/enhanced-documents/evaluate-document-type",
                files={"file": ("receipt.txt", f, "text/plain")},
                params={"quick_scan": True}
            )
        
        assert response.status_code == 200
        result = response.json()
        
        # Should detect as receipt or invoice (both are valid for retail receipts)
        assert result['type_evaluation']['primary_type'] in ['receipt', 'invoice']
        assert result['type_evaluation']['confidence'] > 0.4
        
        # Cleanup
        file_path.unlink()
    
    def test_business_report_detection(self, sample_documents):
        """Test business report detection"""
        file_path = sample_documents['report_html']
        
        with open(file_path, 'rb') as f:
            response = client.post(
                "/api/enhanced-documents/evaluate-document-type",
                files={"file": ("report.html", f, "text/html")},
                params={"quick_scan": True}
            )
        
        assert response.status_code == 200
        result = response.json()
        
        assert result['type_evaluation']['primary_type'] == 'report'
        assert result['type_evaluation']['confidence'] > 0.5
        
        # Should suggest business templates
        if result['template_suggestions']:
            assert result['template_suggestions'][0]['category'] == 'Business'
        
        # Cleanup
        file_path.unlink()
    
    def test_unknown_document_handling(self, sample_documents):
        """Test handling of unknown document types"""
        file_path = sample_documents['unknown_text']
        
        with open(file_path, 'rb') as f:
            response = client.post(
                "/api/enhanced-documents/evaluate-document-type",
                files={"file": ("random.txt", f, "text/plain")},
                params={"quick_scan": True}
            )
        
        assert response.status_code == 200
        result = response.json()
        
        assert result['type_evaluation']['primary_type'] == 'unknown'
        assert result['type_evaluation']['confidence'] == 0.0
        assert result['processing_recommendations']['workflow'] == 'generate_template'
        assert 'generate' in result['processing_recommendations']['suggested_action'].lower()
        
        # Cleanup
        file_path.unlink()
    
    def test_unsupported_file_format(self, sample_documents):
        """Test unsupported file format handling"""
        file_path = sample_documents['unsupported_file']
        
        with open(file_path, 'rb') as f:
            response = client.post(
                "/api/enhanced-documents/evaluate-document-type",
                files={"file": ("test.xyz", f, "application/xyz")},
                params={"quick_scan": True}
            )
        
        assert response.status_code == 200
        result = response.json()
        
        assert result['document_info']['format_supported'] is False
        assert result['type_evaluation']['primary_type'] == 'unsupported'
        assert result['processing_recommendations']['workflow'] == 'unsupported'
        
        # Cleanup
        file_path.unlink()
    
    def test_confidence_based_recommendations(self, sample_documents):
        """Test confidence-based workflow recommendations"""
        # Test with high-confidence document (invoice)
        file_path = sample_documents['invoice_html']
        
        with open(file_path, 'rb') as f:
            response = client.post(
                "/api/enhanced-documents/evaluate-document-type",
                files={"file": ("invoice.html", f, "text/html")},
                params={"quick_scan": True}
            )
        
        result = response.json()
        confidence = result['type_evaluation']['confidence']
        
        if confidence > 0.8:
            assert result['processing_recommendations']['workflow'] == 'existing_template'
            assert result['processing_recommendations']['confidence_level'] == 'high'
        elif confidence > 0.6:
            assert result['processing_recommendations']['workflow'] == 'template_selection'
            assert result['processing_recommendations']['confidence_level'] == 'medium'
        else:
            assert result['processing_recommendations']['workflow'] == 'generate_template'
            assert result['processing_recommendations']['confidence_level'] == 'low'
        
        # Cleanup
        file_path.unlink()
    
    def test_template_matching_accuracy(self, sample_documents):
        """Test template suggestion accuracy"""
        file_path = sample_documents['invoice_html']
        
        with open(file_path, 'rb') as f:
            response = client.post(
                "/api/enhanced-documents/evaluate-document-type",
                files={"file": ("invoice.html", f, "text/html")},
                params={"suggest_templates": True}
            )
        
        result = response.json()
        templates = result['template_suggestions']
        
        # Should have template suggestions for invoice
        assert len(templates) > 0
        
        # First template should have highest match score
        if len(templates) > 1:
            assert templates[0]['match_score'] >= templates[1]['match_score']
        
        # All templates should be relevant to detected type
        for template in templates:
            assert template['category'] in ['Financial', 'Business']
            assert template['match_score'] > 0.4
            assert template['field_count'] > 0
        
        # Cleanup
        file_path.unlink()
    
    @pytest.mark.parametrize("quick_scan", [True, False])
    def test_scan_modes(self, sample_documents, quick_scan):
        """Test quick vs detailed scan modes"""
        file_path = sample_documents['report_html']
        
        with open(file_path, 'rb') as f:
            response = client.post(
                "/api/enhanced-documents/evaluate-document-type",
                files={"file": ("report.html", f, "text/html")},
                params={"quick_scan": quick_scan}
            )
        
        assert response.status_code == 200
        result = response.json()
        
        # Both modes should detect the document
        assert result['type_evaluation']['primary_type'] is not None
        
        # Should have content preview
        assert 'content_preview' in result
        assert 'key_phrases' in result['content_preview']
        
        # Metadata should reflect scan mode
        assert result['evaluation_metadata']['quick_scan'] == quick_scan
        
        # Cleanup
        file_path.unlink()
    
    def test_parameter_filtering(self, sample_documents):
        """Test parameter-based result filtering"""
        file_path = sample_documents['invoice_html']
        
        # Test without confidence scores
        with open(file_path, 'rb') as f:
            response = client.post(
                "/api/enhanced-documents/evaluate-document-type",
                files={"file": ("invoice.html", f, "text/html")},
                params={"include_confidence_scores": False}
            )
        
        result = response.json()
        assert 'alternative_types' not in result['type_evaluation']
        
        # Test without template suggestions
        with open(file_path, 'rb') as f:
            response = client.post(
                "/api/enhanced-documents/evaluate-document-type",
                files={"file": ("invoice.html", f, "text/html")},
                params={"suggest_templates": False}
            )
        
        result = response.json()
        assert result['template_suggestions'] == []
        
        # Cleanup
        file_path.unlink()
    
    def test_content_preview_extraction(self, sample_documents):
        """Test content preview extraction"""
        file_path = sample_documents['invoice_html']
        
        with open(file_path, 'rb') as f:
            response = client.post(
                "/api/enhanced-documents/evaluate-document-type",
                files={"file": ("invoice.html", f, "text/html")}
            )
        
        result = response.json()
        preview = result['content_preview']
        
        # Should detect table presence
        assert preview['has_tables'] is True
        
        # Should extract key phrases
        assert len(preview['key_phrases']) > 0
        assert any('invoice' in phrase.lower() for phrase in preview['key_phrases'])
        
        # Should have basic metadata
        assert preview['page_count'] >= 1
        assert preview['detected_language'] in ['en', 'unknown']
        
        # Cleanup
        file_path.unlink()
    
    def test_error_handling(self):
        """Test error handling for invalid inputs"""
        # Test missing file
        response = client.post("/api/enhanced-documents/evaluate-document-type")
        assert response.status_code == 422  # Validation error
        
        # Test empty file
        response = client.post(
            "/api/enhanced-documents/evaluate-document-type",
            files={"file": ("", b"", "")}
        )
        assert response.status_code == 400
        assert "no file provided" in response.json()['detail'].lower()
    
    def test_evaluation_metadata(self, sample_documents):
        """Test evaluation metadata is properly included"""
        file_path = sample_documents['invoice_html']
        
        with open(file_path, 'rb') as f:
            response = client.post(
                "/api/enhanced-documents/evaluate-document-type",
                files={"file": ("invoice.html", f, "text/html")},
                params={"quick_scan": False, "include_confidence_scores": True}
            )
        
        result = response.json()
        metadata = result['evaluation_metadata']
        
        assert 'evaluation_time' in metadata
        assert metadata['quick_scan'] is False
        assert metadata['include_confidence_scores'] is True
        assert metadata['evaluation_version'] == '1.0.0'
        
        # Cleanup
        file_path.unlink()


class TestDocumentEvaluatorService:
    """Test the DocumentEvaluator service directly"""
    
    def test_pattern_score_calculation(self):
        """Test pattern matching score calculation"""
        evaluator = document_evaluator
        
        # High match
        content = "This is an invoice with total amount due and payment terms"
        keywords = ['invoice', 'total', 'amount', 'payment']
        score = evaluator._calculate_pattern_score(content, keywords)
        assert score == 1.0  # All keywords found
        
        # Partial match
        content = "This is an invoice document"
        keywords = ['invoice', 'total', 'amount', 'payment']  
        score = evaluator._calculate_pattern_score(content, keywords)
        assert score == 0.25  # 1 out of 4 keywords found
        
        # No match
        content = "This is just some random text"
        keywords = ['invoice', 'total', 'amount', 'payment']
        score = evaluator._calculate_pattern_score(content, keywords)
        assert score == 0.0
    
    def test_key_phrase_extraction(self):
        """Test key phrase extraction"""
        evaluator = document_evaluator
        
        text = "Invoice number 12345 total amount $500.00 due date February payment terms net 30"
        phrases = evaluator._extract_key_phrases(text, limit=5)
        
        assert len(phrases) <= 5
        assert 'invoice' in phrases or 'number' in phrases
        # Should filter out short words and common stop words
        assert 'the' not in phrases
        assert 'and' not in phrases
    
    def test_workflow_determination(self):
        """Test workflow determination logic"""
        evaluator = document_evaluator
        
        # High confidence with good template
        type_eval = {'confidence': 0.9}
        templates = [{'match_score': 0.85, 'template_name': 'Test Template'}]
        
        workflow = evaluator._determine_workflow(type_eval, templates)
        assert workflow['workflow'] == 'existing_template'
        assert workflow['confidence_level'] == 'high'
        
        # Medium confidence
        type_eval = {'confidence': 0.7}
        templates = []
        
        workflow = evaluator._determine_workflow(type_eval, templates)
        assert workflow['workflow'] == 'template_selection'
        assert workflow['confidence_level'] == 'medium'
        
        # Low confidence
        type_eval = {'confidence': 0.4}
        templates = []
        
        workflow = evaluator._determine_workflow(type_eval, templates)
        assert workflow['workflow'] == 'generate_template'
        assert workflow['confidence_level'] == 'low'


if __name__ == "__main__":
    pytest.main([__file__, "-v"])