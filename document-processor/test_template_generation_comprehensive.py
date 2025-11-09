"""
Comprehensive tests for Template Generation Service
Tests both AI-powered and fallback template generation functionality.
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime

# Import the service we're testing
from app.services.template_generation_service import (
    TemplateGenerationService,
    SmartVariable,
    GeneratedTemplate,
    template_generation_service
)

class TestTemplateGenerationService:
    """Test suite for Template Generation Service"""
    
    @pytest.fixture
    def service(self):
        """Create a fresh service instance for each test"""
        return TemplateGenerationService()
    
    @pytest.fixture
    def sample_invoice_content(self):
        """Sample invoice content for testing"""
        return """
        INVOICE

        Invoice Number: INV-2024-001
        Date: March 15, 2024
        
        From:
        ABC Company Inc.
        123 Business St
        New York, NY 10001
        Phone: (555) 123-4567
        Email: billing@abccompany.com
        
        To:
        John Smith
        456 Customer Ave
        Boston, MA 02101
        
        Description                 Quantity    Rate      Amount
        Web Development Services    40 hours    $125/hr   $5,000.00
        Domain Registration         1 year      $15/yr    $15.00
        
        Subtotal: $5,015.00
        Tax (8.25%): $413.74
        Total: $5,428.74
        
        Payment Terms: Net 30
        """
    
    @pytest.fixture
    def sample_receipt_content(self):
        """Sample receipt content for testing"""
        return """
        GROCERY STORE RECEIPT
        
        Store: Fresh Market
        Address: 789 Main St, Anytown, ST 12345
        Phone: (555) 987-6543
        
        Receipt #: R20240315001
        Date: 03/15/2024 2:30 PM
        Cashier: Jane D.
        
        Items:
        Bananas (2 lbs)           $2.98
        Milk (1 gallon)           $3.49
        Bread (1 loaf)            $2.25
        Eggs (1 dozen)            $4.99
        
        Subtotal:                 $13.71
        Tax:                      $0.96
        Total:                    $14.67
        
        Payment: Credit Card ****1234
        Change: $0.00
        
        Thank you for shopping!
        """
    
    @pytest.fixture
    def mock_azure_response(self):
        """Mock Azure OpenAI response for field analysis"""
        return {
            'content': json.dumps({
                "confidence": 0.92,
                "document_type": "invoice",
                "fields": [
                    {
                        "name": "invoice_number",
                        "display_name": "Invoice Number",
                        "type": "text",
                        "description": "Unique identifier for the invoice",
                        "required": True,
                        "sample_value": "INV-2024-001",
                        "keywords": ["invoice", "number", "#"]
                    },
                    {
                        "name": "company_name",
                        "display_name": "Company Name",
                        "type": "text",
                        "description": "Name of the billing company",
                        "required": True,
                        "sample_value": "ABC Company Inc.",
                        "keywords": ["company", "from", "inc"]
                    },
                    {
                        "name": "total_amount",
                        "display_name": "Total Amount",
                        "type": "currency",
                        "description": "Final amount due",
                        "required": True,
                        "sample_value": "$5,428.74",
                        "keywords": ["total", "amount", "due"]
                    },
                    {
                        "name": "date",
                        "display_name": "Invoice Date",
                        "type": "date",
                        "description": "Date the invoice was issued",
                        "required": True,
                        "sample_value": "March 15, 2024",
                        "keywords": ["date", "dated"]
                    },
                    {
                        "name": "customer_email",
                        "display_name": "Customer Email",
                        "type": "email",
                        "description": "Customer contact email",
                        "required": False,
                        "sample_value": "billing@abccompany.com",
                        "keywords": ["email", "@"]
                    }
                ]
            })
        }

class TestAIPoweredGeneration(TestTemplateGenerationService):
    """Test AI-powered template generation with Azure OpenAI"""
    
    @pytest.mark.asyncio
    async def test_generate_template_with_ai_success(self, service, sample_invoice_content, mock_azure_response):
        """Test successful template generation using Azure OpenAI"""
        
        # Mock Azure OpenAI service
        with patch.object(service.azure_service, 'complete', return_value=mock_azure_response['content']):
            with patch('app.services.template_generation_service.ProviderConfig') as mock_config:
                mock_config.return_value.azure_openai_available = True
                
                result = await service.generate_template_from_document(
                    content=sample_invoice_content,
                    document_type='invoice',
                    min_confidence=0.8
                )
        
        # Verify result
        assert result is not None
        assert isinstance(result, GeneratedTemplate)
        assert result.name == "Premium Invoice Template"
        assert result.category == "finance"
        assert result.confidence == 0.92
        assert len(result.smart_variables) == 5
        
        # Check specific fields
        field_names = [var.name for var in result.smart_variables]
        assert 'invoice_number' in field_names
        assert 'total_amount' in field_names
        assert 'date' in field_names
        assert 'customer_email' in field_names
        
        # Verify field types
        amount_field = next(var for var in result.smart_variables if var.name == 'total_amount')
        assert amount_field.type == 'currency'
        assert amount_field.required == True
        assert amount_field.sample_value == "$5,428.74"
    
    @pytest.mark.asyncio
    async def test_generate_template_low_confidence_rejection(self, service, sample_invoice_content):
        """Test that low confidence results are rejected"""
        
        low_confidence_response = {
            'content': json.dumps({
                "confidence": 0.4,  # Below threshold
                "document_type": "invoice", 
                "fields": [
                    {
                        "name": "some_field",
                        "display_name": "Some Field",
                        "type": "text",
                        "description": "Uncertain field",
                        "required": False,
                        "keywords": ["uncertain"]
                    }
                ]
            })
        }
        
        with patch.object(service.azure_service, 'complete', return_value=low_confidence_response['content']):
            with patch('app.services.template_generation_service.ProviderConfig') as mock_config:
                mock_config.return_value.azure_openai_available = True
                
                result = await service.generate_template_from_document(
                    content=sample_invoice_content,
                    document_type='invoice',
                    min_confidence=0.6
                )
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_azure_openai_failure_fallback(self, service, sample_invoice_content):
        """Test fallback to pattern matching when Azure OpenAI fails"""
        
        with patch.object(service.azure_service, 'complete', side_effect=Exception("API Error")):
            with patch('app.services.template_generation_service.ProviderConfig') as mock_config:
                mock_config.return_value.azure_openai_available = True
                
                result = await service.generate_template_from_document(
                    content=sample_invoice_content,
                    document_type='invoice',
                    min_confidence=0.6
                )
        
        # Should still get a result from fallback
        assert result is not None
        assert result.confidence == 0.7  # Fallback confidence
        assert len(result.smart_variables) > 0
    
    @pytest.mark.asyncio
    async def test_invalid_json_response_fallback(self, service, sample_invoice_content):
        """Test handling of invalid JSON response from Azure OpenAI"""
        
        invalid_response = {'content': 'This is not valid JSON'}
        
        with patch.object(service.azure_service, 'complete', return_value=invalid_response['content']):
            with patch('app.services.template_generation_service.ProviderConfig') as mock_config:
                mock_config.return_value.azure_openai_available = True
                
                result = await service.generate_template_from_document(
                    content=sample_invoice_content,
                    document_type='invoice',
                    min_confidence=0.6
                )
        
        # Should fallback and still work
        assert result is not None
        assert result.confidence == 0.7

class TestFallbackGeneration(TestTemplateGenerationService):
    """Test fallback template generation using pattern matching"""
    
    @pytest.mark.asyncio
    async def test_fallback_invoice_generation(self, service, sample_invoice_content):
        """Test fallback generation for invoice documents"""
        
        # Force fallback by making Azure unavailable
        with patch('app.services.template_generation_service.ProviderConfig') as mock_config:
            mock_config.return_value.azure_openai_available = False
            
            result = await service.generate_template_from_document(
                content=sample_invoice_content,
                document_type='invoice',
                min_confidence=0.6
            )
        
        assert result is not None
        assert result.confidence == 0.7
        assert result.category == "finance"
        assert "Invoice Template" in result.name
        
        # Check that invoice-specific fields are detected
        field_names = [var.name for var in result.smart_variables]
        expected_fields = ['invoice_number', 'total_amount', 'date', 'company_name']
        
        # At least some expected fields should be present
        found_fields = [field for field in expected_fields if field in field_names]
        assert len(found_fields) >= 3
    
    @pytest.mark.asyncio
    async def test_fallback_receipt_generation(self, service, sample_receipt_content):
        """Test fallback generation for receipt documents"""
        
        with patch('app.services.template_generation_service.ProviderConfig') as mock_config:
            mock_config.return_value.azure_openai_available = False
            
            result = await service.generate_template_from_document(
                content=sample_receipt_content,
                document_type='receipt',
                min_confidence=0.6
            )
        
        assert result is not None
        assert result.category == "finance"
        assert "Receipt Template" in result.name
        
        # Check receipt-specific fields
        field_names = [var.name for var in result.smart_variables]
        expected_fields = ['receipt_number', 'total_amount', 'date', 'store_name']
        
        found_fields = [field for field in expected_fields if field in field_names]
        assert len(found_fields) >= 2
    
    @pytest.mark.asyncio
    async def test_fallback_contract_generation(self, service):
        """Test fallback generation for contract documents"""
        
        contract_content = """
        SERVICE AGREEMENT
        
        Contract Number: SA-2024-045
        
        This agreement between:
        Client: XYZ Corporation
        Service Provider: Professional Services LLC
        
        Start Date: April 1, 2024
        End Date: March 31, 2025
        
        Contract Value: $125,000
        
        Terms and conditions...
        """
        
        with patch('app.services.template_generation_service.ProviderConfig') as mock_config:
            mock_config.return_value.azure_openai_available = False
            
            result = await service.generate_template_from_document(
                content=contract_content,
                document_type='contract',
                min_confidence=0.6
            )
        
        assert result is not None
        assert result.category == "legal"
        assert "Contract Template" in result.name
        
        field_names = [var.name for var in result.smart_variables]
        expected_fields = ['contract_number', 'start_date', 'end_date', 'contract_value']
        
        found_fields = [field for field in expected_fields if field in field_names]
        assert len(found_fields) >= 2

class TestFieldTypeDetection(TestTemplateGenerationService):
    """Test field type detection and validation pattern generation"""
    
    def test_determine_field_type_currency(self, service):
        """Test currency field type detection"""
        assert service._determine_field_type('total_amount') == 'currency'
        assert service._determine_field_type('price') == 'currency'
        assert service._determine_field_type('cost') == 'currency'
        assert service._determine_field_type('contract_value') == 'currency'
    
    def test_determine_field_type_date(self, service):
        """Test date field type detection"""
        assert service._determine_field_type('invoice_date') == 'date'
        assert service._determine_field_type('start_date') == 'date'
        assert service._determine_field_type('created_time') == 'date'
    
    def test_determine_field_type_email_phone(self, service):
        """Test email and phone field type detection"""
        assert service._determine_field_type('customer_email') == 'email'
        assert service._determine_field_type('contact_phone') == 'phone'
        assert service._determine_field_type('telephone') == 'phone'
    
    def test_determine_field_type_numbers(self, service):
        """Test number field type detection"""
        assert service._determine_field_type('invoice_number') == 'text'  # IDs are text
        assert service._determine_field_type('receipt_number') == 'text'
        assert service._determine_field_type('quantity') == 'number'
        assert service._determine_field_type('count') == 'number'
    
    def test_extract_simple_sample_currency(self, service):
        """Test currency value extraction"""
        content = "Total: $1,234.56"
        sample = service._extract_simple_sample(content, ['total'], 'currency')
        assert sample == "$1,234.56"
    
    def test_extract_simple_sample_date(self, service):
        """Test date value extraction"""
        content = "Date: 03/15/2024"
        sample = service._extract_simple_sample(content, ['date'], 'date')
        assert sample == "03/15/2024"
    
    def test_extract_simple_sample_email(self, service):
        """Test email value extraction"""
        content = "Contact: support@company.com"
        sample = service._extract_simple_sample(content, ['contact'], 'email')
        assert sample == "support@company.com"
    
    def test_extract_simple_sample_text(self, service):
        """Test text value extraction"""
        content = "Company: ABC Corporation Inc"
        sample = service._extract_simple_sample(content, ['company'], 'text')
        assert sample == "ABC Corporation Inc"

class TestTemplateNaming(TestTemplateGenerationService):
    """Test template naming and categorization"""
    
    def test_generate_template_name_high_confidence(self, service):
        """Test template name generation for high confidence"""
        analysis = {'confidence': 0.95}
        name = service._generate_template_name('invoice', analysis)
        assert name == "Premium Invoice Template"
    
    def test_generate_template_name_medium_confidence(self, service):
        """Test template name generation for medium confidence"""
        analysis = {'confidence': 0.75}
        name = service._generate_template_name('receipt', analysis)
        assert name == "Basic Receipt Template"
    
    def test_generate_template_name_low_confidence(self, service):
        """Test template name generation for low confidence"""
        analysis = {'confidence': 0.65}
        name = service._generate_template_name('contract', analysis)
        assert name == "Simple Contract Template"
    
    def test_map_document_type_to_category(self, service):
        """Test document type to category mapping"""
        assert service._map_document_type_to_category('invoice') == 'finance'
        assert service._map_document_type_to_category('receipt') == 'finance'
        assert service._map_document_type_to_category('contract') == 'legal'
        assert service._map_document_type_to_category('agreement') == 'legal'
        assert service._map_document_type_to_category('report') == 'business'
        assert service._map_document_type_to_category('unknown_type') == 'general'
    
    def test_generate_template_description(self, service):
        """Test template description generation"""
        smart_vars = [
            SmartVariable('field1', 'Field 1', 'text', 'Test field', True, []),
            SmartVariable('amount', 'Amount', 'currency', 'Money field', True, []),
            SmartVariable('email', 'Email', 'email', 'Email field', False, [])
        ]
        
        description = service._generate_template_description('invoice', smart_vars)
        
        assert 'invoice documents' in description
        assert '3 extractable fields' in description
        assert 'currency' in description
        assert 'email' in description
        assert 'AI analysis' in description

class TestSmartVariableCreation(TestTemplateGenerationService):
    """Test smart variable creation from field analysis"""
    
    @pytest.mark.asyncio
    async def test_create_smart_variables(self, service):
        """Test creation of smart variables from field analysis"""
        
        fields = [
            {
                'name': 'invoice_number',
                'display_name': 'Invoice Number',
                'type': 'text',
                'description': 'Invoice identifier',
                'required': True,
                'sample_value': 'INV-001',
                'keywords': ['invoice', 'number']
            },
            {
                'name': 'total_amount',
                'display_name': 'Total Amount',
                'type': 'currency',
                'description': 'Total due',
                'required': True,
                'sample_value': '$100.00',
                'keywords': ['total', 'amount']
            }
        ]
        
        smart_vars = await service._create_smart_variables(fields, "sample content")
        
        assert len(smart_vars) == 2
        
        # Check first variable
        inv_var = smart_vars[0]
        assert inv_var.name == 'invoice_number'
        assert inv_var.display_name == 'Invoice Number'
        assert inv_var.type == 'text'
        assert inv_var.required == True
        assert inv_var.sample_value == 'INV-001'
        assert 'invoice' in inv_var.extraction_hints
        
        # Check second variable
        amt_var = smart_vars[1]
        assert amt_var.name == 'total_amount'
        assert amt_var.type == 'currency'
        assert amt_var.validation_pattern is not None  # Should have currency pattern

class TestFullIntegration(TestTemplateGenerationService):
    """Integration tests for complete template generation workflow"""
    
    @pytest.mark.asyncio
    async def test_end_to_end_invoice_generation(self, service, sample_invoice_content, mock_azure_response):
        """Test complete invoice template generation workflow"""
        
        with patch.object(service.azure_service, 'complete', return_value=mock_azure_response['content']):
            with patch('app.services.template_generation_service.ProviderConfig') as mock_config:
                mock_config.return_value.azure_openai_available = True
                
                # Generate template
                result = await service.generate_template_from_document(
                    content=sample_invoice_content,
                    document_type='invoice',
                    metadata={'file_name': 'test_invoice.pdf'},
                    min_confidence=0.8
                )
        
        # Verify complete result
        assert result is not None
        assert isinstance(result, GeneratedTemplate)
        
        # Test serialization
        result_dict = service.to_dict(result)
        assert isinstance(result_dict, dict)
        assert 'smart_variables' in result_dict
        assert 'generation_metadata' in result_dict
        assert 'sample_values' in result_dict
        
        # Verify metadata
        metadata = result.generation_metadata
        assert metadata['document_type'] == 'invoice'
        assert metadata['ai_model'] == 'gpt-4'
        assert metadata['field_count'] == len(result.smart_variables)
        assert 'timestamp' in metadata
        
        # Test sample values
        assert len(result.sample_values) > 0
        if 'total_amount' in result.sample_values:
            assert '$' in result.sample_values['total_amount']
    
    @pytest.mark.asyncio 
    async def test_end_to_end_fallback_generation(self, service, sample_receipt_content):
        """Test complete receipt template generation with fallback"""
        
        # Force fallback by making Azure unavailable
        with patch('app.services.template_generation_service.ProviderConfig') as mock_config:
            mock_config.return_value.azure_openai_available = False
            
            result = await service.generate_template_from_document(
                content=sample_receipt_content,
                document_type='receipt',
                min_confidence=0.6
            )
        
        # Should still work with pattern matching
        assert result is not None
        assert result.category == 'finance'
        assert result.confidence == 0.7
        assert len(result.smart_variables) > 0
        
        # Test that it's serializable
        result_dict = service.to_dict(result)
        assert 'generation_metadata' in result_dict
        assert result_dict['generation_metadata']['generation_method'] == 'azure_openai_analysis'
    
    @pytest.mark.asyncio
    async def test_global_service_instance(self, sample_invoice_content):
        """Test that global service instance works correctly"""
        
        with patch('app.services.template_generation_service.ProviderConfig') as mock_config:
            mock_config.return_value.azure_openai_available = False
            
            result = await template_generation_service.generate_template_from_document(
                content=sample_invoice_content,
                document_type='invoice',
                min_confidence=0.6
            )
        
        assert result is not None
        assert isinstance(result, GeneratedTemplate)


# Test runners for different scenarios
if __name__ == "__main__":
    # Run tests with verbose output
    pytest.main([__file__, "-v", "--tb=short"])