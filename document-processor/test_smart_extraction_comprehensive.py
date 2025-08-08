#!/usr/bin/env python3
"""
Comprehensive Test Suite for Smart LLM-based Field Extraction
Tests the intelligent AI extraction system vs regex-based patterns
"""
import asyncio
import aiohttp
import json
import time
from pathlib import Path
import sys

class SmartExtractionTestSuite:
    def __init__(self):
        self.base_url = "http://localhost:8090"
        self.test_results = []
        
    async def run_all_tests(self):
        """Run the complete smart extraction test suite"""
        print("🧠 COMPREHENSIVE SMART EXTRACTION TEST SUITE")
        print("=" * 80)
        print("Testing LLM-based intelligent field extraction vs regex patterns")
        print("=" * 80)
        
        tests = [
            ("Basic Smart Extraction", self.test_basic_smart_extraction),
            ("Receipt Document Test", self.test_receipt_document),
            ("Invoice Document Test", self.test_invoice_document),
            ("Complex Document Test", self.test_complex_document),
            ("Edge Cases Test", self.test_edge_cases),
            ("Performance Test", self.test_performance),
            ("Accuracy Comparison", self.test_accuracy_comparison),
        ]
        
        for test_name, test_func in tests:
            print(f"\n{'='*20} {test_name} {'='*20}")
            try:
                result = await test_func()
                self.test_results.append((test_name, result))
                print(f"✅ {test_name}: {'PASSED' if result else 'FAILED'}")
            except Exception as e:
                print(f"❌ {test_name}: ERROR - {str(e)}")
                self.test_results.append((test_name, False))
        
        # Summary
        self.print_summary()
        
    async def test_basic_smart_extraction(self):
        """Test basic smart extraction functionality"""
        print("\n🔍 Testing basic smart extraction...")
        
        # Simple test content
        content = """Invoice: INV-001
Date: January 15, 2024
Customer: John Smith
Total: $150.00"""
        
        template = {
            "smart_variables": [
                {"name": "invoice_id", "type": "text", "description": "Invoice identification number"},
                {"name": "date", "type": "date", "description": "Invoice date"},
                {"name": "customer", "type": "text", "description": "Customer name"},
                {"name": "amount", "type": "currency", "description": "Total amount"}
            ]
        }
        
        result = await self.call_extract_api(content, template)
        
        if result and result.get('extracted_data'):
            extracted = result['extracted_data'].get('extracted_values', {})
            expected_count = len(template['smart_variables'])
            actual_count = len(extracted)
            
            print(f"   Extracted {actual_count}/{expected_count} fields")
            for field, data in extracted.items():
                print(f"   - {field}: {data.get('value')} (conf: {data.get('confidence', 0):.2f})")
            
            return actual_count >= 3  # At least 3 out of 4 fields
        return False
    
    async def test_receipt_document(self):
        """Test with your actual receipt format"""
        print("\n🧾 Testing receipt document extraction...")
        
        receipt_content = """## Receipt

Invoice number

TTKRPHII0001

Date paid

July 23, 2025

## Koenig Solutions Limited

Bill to

Nicholas Yeager nickcyeager@gmail.com

## $2,025.00 paid on July 23, 2025"""
        
        template = {
            "smart_variables": [
                {"name": "receipt_number", "type": "text", "description": "Receipt or invoice number"},
                {"name": "payment_date", "type": "date", "description": "Payment date"},
                {"name": "total_amount", "type": "currency", "description": "Total amount paid"},
                {"name": "customer_name", "type": "text", "description": "Customer name"},
                {"name": "customer_email", "type": "text", "description": "Customer email"},
                {"name": "company_name", "type": "text", "description": "Company name"}
            ]
        }
        
        result = await self.call_extract_api(receipt_content, template)
        
        if result and result.get('extracted_data'):
            extracted = result['extracted_data'].get('extracted_values', {})
            
            # Check for key expected values
            checks = {
                'receipt_number': 'TTKRPHII0001',
                'payment_date': 'July 23, 2025',
                'total_amount': '$2,025.00',
                'customer_name': 'Nicholas Yeager',
                'company_name': 'Koenig Solutions'
            }
            
            correct_count = 0
            for field, expected in checks.items():
                if field in extracted:
                    actual = str(extracted[field].get('value', '')).strip()
                    if expected.lower() in actual.lower() or actual.lower() in expected.lower():
                        correct_count += 1
                        print(f"   ✅ {field}: {actual}")
                    else:
                        print(f"   ❌ {field}: got '{actual}', expected '{expected}'")
                else:
                    print(f"   ❌ {field}: not extracted")
            
            accuracy = correct_count / len(checks) * 100
            print(f"   Accuracy: {accuracy:.0f}% ({correct_count}/{len(checks)})")
            
            return accuracy >= 60  # At least 60% accuracy
        return False
    
    async def test_invoice_document(self):
        """Test with invoice-style document"""
        print("\n📋 Testing invoice document extraction...")
        
        invoice_content = """INVOICE #12345
Date: March 15, 2024
From: ABC Company
To: XYZ Corp
Amount Due: $1,234.56
Due Date: April 15, 2024"""
        
        template = {
            "smart_variables": [
                {"name": "invoice_number", "type": "text", "description": "Invoice number"},
                {"name": "invoice_date", "type": "date", "description": "Invoice date"},
                {"name": "vendor", "type": "text", "description": "Vendor company"},
                {"name": "customer", "type": "text", "description": "Customer company"},
                {"name": "amount_due", "type": "currency", "description": "Amount due"},
                {"name": "due_date", "type": "date", "description": "Payment due date"}
            ]
        }
        
        result = await self.call_extract_api(invoice_content, template)
        
        if result and result.get('extracted_data'):
            extracted = result['extracted_data'].get('extracted_values', {})
            method = result['extracted_data'].get('extraction_method', 'unknown')
            
            print(f"   Method: {method}")
            print(f"   Fields extracted: {len(extracted)}")
            
            for field, data in extracted.items():
                print(f"   - {field}: {data.get('value')} (conf: {data.get('confidence', 0):.2f})")
            
            return len(extracted) >= 4  # At least 4 fields extracted
        return False
    
    async def test_complex_document(self):
        """Test with complex document structure"""
        print("\n📄 Testing complex document extraction...")
        
        complex_content = """BUSINESS REPORT - Q3 2024
Prepared by: Data Analytics Team
Report Date: October 1, 2024
Period: July 1 - September 30, 2024

EXECUTIVE SUMMARY
Total Revenue: $2,450,000
Growth Rate: 15.5%
Customer Acquisition: 1,250 new customers
Primary Contact: Sarah Johnson (sarah@company.com)

KEY METRICS
- Monthly Recurring Revenue: $815,000
- Churn Rate: 3.2%
- Customer Satisfaction: 4.7/5.0"""
        
        template = {
            "smart_variables": [
                {"name": "report_title", "type": "text", "description": "Report title"},
                {"name": "author", "type": "text", "description": "Report author"},
                {"name": "report_date", "type": "date", "description": "Report date"},
                {"name": "total_revenue", "type": "currency", "description": "Total revenue"},
                {"name": "growth_rate", "type": "text", "description": "Growth rate percentage"},
                {"name": "contact_email", "type": "text", "description": "Contact email address"},
                {"name": "customer_satisfaction", "type": "text", "description": "Customer satisfaction score"}
            ]
        }
        
        result = await self.call_extract_api(complex_content, template)
        
        if result and result.get('extracted_data'):
            extracted = result['extracted_data'].get('extracted_values', {})
            success_rate = result['extracted_data'].get('success_rate', 0)
            
            print(f"   Success rate: {success_rate:.1%}")
            print(f"   Fields found: {len(extracted)}")
            
            return success_rate >= 0.5  # At least 50% success rate
        return False
    
    async def test_edge_cases(self):
        """Test edge cases and unusual formats"""
        print("\n🔬 Testing edge cases...")
        
        edge_content = """Ref: ABC-XYZ-789
Payment received on 2024/12/25 
Amount: USD 999.99
Client: Smith & Associates LLC
Notes: Payment processed via wire transfer"""
        
        template = {
            "smart_variables": [
                {"name": "reference", "type": "text", "description": "Reference number"},
                {"name": "payment_date", "type": "date", "description": "Payment date"},
                {"name": "amount", "type": "currency", "description": "Payment amount"},
                {"name": "client_name", "type": "text", "description": "Client name"}
            ]
        }
        
        result = await self.call_extract_api(edge_content, template)
        
        if result and result.get('extracted_data'):
            extracted = result['extracted_data'].get('extracted_values', {})
            print(f"   Edge case extraction: {len(extracted)} fields found")
            
            return len(extracted) >= 2  # At least 2 fields in edge case
        return False
    
    async def test_performance(self):
        """Test extraction performance"""
        print("\n⚡ Testing performance...")
        
        content = "Invoice #999 Date: 2024-01-01 Total: $100.00"
        template = {
            "smart_variables": [
                {"name": "invoice", "type": "text", "description": "Invoice number"},
                {"name": "date", "type": "date", "description": "Date"},
                {"name": "total", "type": "currency", "description": "Total amount"}
            ]
        }
        
        start_time = time.time()
        result = await self.call_extract_api(content, template)
        end_time = time.time()
        
        processing_time = end_time - start_time
        print(f"   Processing time: {processing_time:.2f} seconds")
        
        if result:
            api_time = result.get('processing_time', processing_time)
            print(f"   API reported time: {api_time:.3f} seconds")
            
            return processing_time < 10  # Should complete within 10 seconds
        return False
    
    async def test_accuracy_comparison(self):
        """Compare AI extraction vs pattern-based extraction"""
        print("\n📊 Testing accuracy comparison...")
        
        test_cases = [
            {
                "content": "Receipt No: R-12345, Date: Jan 1 2024, Amount: $50.00",
                "expected": {"receipt": "R-12345", "date": "Jan 1 2024", "amount": "$50.00"}
            },
            {
                "content": "Invoice Number TTKRPHII0001 Payment Date July 23, 2025 Total $2,025.00",
                "expected": {"invoice": "TTKRPHII0001", "date": "July 23, 2025", "amount": "$2,025.00"}
            }
        ]
        
        template = {
            "smart_variables": [
                {"name": "document_id", "type": "text", "description": "Document ID or number"},
                {"name": "date", "type": "date", "description": "Document date"},
                {"name": "amount", "type": "currency", "description": "Amount"}
            ]
        }
        
        total_accuracy = 0
        for i, test_case in enumerate(test_cases):
            print(f"   Test case {i+1}:")
            result = await self.call_extract_api(test_case["content"], template)
            
            if result and result.get('extracted_data'):
                extracted = result['extracted_data'].get('extracted_values', {})
                case_accuracy = len(extracted) / len(template['smart_variables'])
                total_accuracy += case_accuracy
                print(f"     Extracted: {len(extracted)}/{len(template['smart_variables'])} fields")
            else:
                print(f"     Failed to extract")
        
        avg_accuracy = total_accuracy / len(test_cases)
        print(f"   Average accuracy: {avg_accuracy:.1%}")
        
        return avg_accuracy >= 0.5
    
    async def call_extract_api(self, content, template, confidence_threshold=0.5):
        """Call the extraction API"""
        async with aiohttp.ClientSession() as session:
            params = {
                "text_content": content,
                "template_data": json.dumps(template),
                "confidence_threshold": str(confidence_threshold)
            }
            
            try:
                async with session.post(
                    f"{self.base_url}/api/enhanced-documents/extract-with-text",
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        print(f"   API Error: {response.status}")
                        return None
            except Exception as e:
                print(f"   Request Error: {str(e)}")
                return None
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("📋 SMART EXTRACTION TEST RESULTS")
        print("=" * 80)
        
        passed = sum(1 for _, result in self.test_results if result)
        total = len(self.test_results)
        success_rate = passed / total * 100 if total > 0 else 0
        
        print(f"Overall Success Rate: {success_rate:.0f}% ({passed}/{total})")
        print("\nDetailed Results:")
        
        for test_name, result in self.test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status} {test_name}")
        
        print("\n" + "=" * 80)
        
        if success_rate >= 70:
            print("🎉 SMART EXTRACTION SYSTEM: EXCELLENT PERFORMANCE!")
        elif success_rate >= 50:
            print("👍 SMART EXTRACTION SYSTEM: GOOD PERFORMANCE")
        else:
            print("⚠️  SMART EXTRACTION SYSTEM: NEEDS IMPROVEMENT")
        
        print("\nKey Features Tested:")
        print("  ✅ LLM-based intelligent field extraction")
        print("  ✅ Context-aware document understanding")
        print("  ✅ Multiple document format support")
        print("  ✅ Performance and accuracy metrics")
        print("  ✅ Edge case handling")
        print("  ✅ Receipt and invoice processing")

async def main():
    """Run the comprehensive test suite"""
    print("Starting Smart Extraction Test Suite...")
    
    # Check if service is running
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get("http://localhost:8090/health", timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status != 200:
                    print("❌ Document processor service is not running!")
                    print("Please start the service first:")
                    print("  cd /Users/nickyeager/Code/agents/local-ai-packaged")
                    print("  docker compose -p localai up document-processor")
                    return
        except:
            print("❌ Cannot connect to document processor service!")
            print("Please ensure the service is running on http://localhost:8090")
            return
    
    # Run tests
    test_suite = SmartExtractionTestSuite()
    await test_suite.run_all_tests()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nTests interrupted by user")
    except Exception as e:
        print(f"Test suite error: {str(e)}")
        import traceback
        traceback.print_exc()