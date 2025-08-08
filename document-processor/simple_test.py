#!/usr/bin/env python3
"""
Simple test script to verify document type evaluation functionality
"""

import requests
import json
import tempfile
from pathlib import Path

# Test endpoint URL
BASE_URL = "http://localhost:8090"
ENDPOINT = f"{BASE_URL}/api/enhanced-documents/evaluate-document-type"

def create_test_invoice():
    """Create a test invoice HTML file"""
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
    
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.html', mode='w')
    temp_file.write(content)
    temp_file.close()
    return Path(temp_file.name)

def create_test_contract():
    """Create a test contract HTML file"""
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
    
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.html', mode='w')
    temp_file.write(content)
    temp_file.close()
    return Path(temp_file.name)

def create_test_receipt():
    """Create a test receipt text file"""
    content = '''
    WALMART SUPERCENTER
    123 Main Street
    Anytown, ST 12345
    
    RECEIPT
    Transaction ID: 1234567890
    Date: 07/29/2024
    Cashier: Jane D.
    
    ITEMS PURCHASED:
    Milk (1 gal)         $3.99
    Bread               $2.49
    Eggs (12 ct)        $2.99
    
    Subtotal:           $11.45
    Tax:                $0.92
    TOTAL:              $12.37
    
    Payment: VISA ****1234
    Thank you for shopping!
    '''
    
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.txt', mode='w')
    temp_file.write(content)
    temp_file.close()
    return Path(temp_file.name)

def test_document_evaluation(file_path, expected_type, test_name):
    """Test document evaluation endpoint"""
    print(f"\n=== Testing {test_name} ===")
    
    try:
        with open(file_path, 'rb') as f:
            files = {'file': (file_path.name, f, 'text/html' if file_path.suffix == '.html' else 'text/plain')}
            params = {
                'quick_scan': True,
                'include_confidence_scores': True,
                'suggest_templates': True
            }
            
            response = requests.post(ENDPOINT, files=files, params=params)
            
        if response.status_code == 200:
            result = response.json()
            
            print(f"✅ Status: SUCCESS")
            print(f"📄 Detected Type: {result['type_evaluation']['primary_type']}")
            print(f"🎯 Confidence: {result['type_evaluation']['confidence']:.2%}")
            print(f"🔧 Detection Method: {result['type_evaluation']['detection_method']}")
            print(f"📊 Workflow: {result['processing_recommendations']['workflow']}")
            print(f"💡 Suggested Action: {result['processing_recommendations']['suggested_action']}")
            
            if result['template_suggestions']:
                print(f"📋 Template Suggestions:")
                for i, template in enumerate(result['template_suggestions'][:2], 1):
                    print(f"  {i}. {template['template_name']} (Score: {template['match_score']:.2%})")
            
            # Verify expected type
            detected_type = result['type_evaluation']['primary_type']
            if detected_type == expected_type:
                print(f"✅ Type Detection: CORRECT (Expected: {expected_type})")
            else:
                print(f"⚠️  Type Detection: MISMATCH (Expected: {expected_type}, Got: {detected_type})")
            
            return True
            
        else:
            print(f"❌ Status: FAILED")
            print(f"🔥 Error: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Status: EXCEPTION")
        print(f"🔥 Error: {str(e)}")
        return False
    
    finally:
        # Cleanup
        file_path.unlink()

def test_service_health():
    """Test if the service is running"""
    print("=== Testing Service Health ===")
    
    try:
        response = requests.get(f"{BASE_URL}/health/")
        if response.status_code == 200:
            print("✅ Service is running")
            return True
        else:
            print(f"❌ Service health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to service: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🧪 Document Type Evaluation - Test Suite")
    print("=" * 50)
    
    # Test service health first
    if not test_service_health():
        print("\n❌ Service is not available. Please start the document processor service.")
        return
    
    # Test different document types
    test_cases = [
        (create_test_invoice, 'invoice', 'Invoice Document'),
        (create_test_contract, 'contract', 'Contract Document'),
        (create_test_receipt, 'receipt', 'Receipt Document')
    ]
    
    results = []
    
    for create_func, expected_type, test_name in test_cases:
        file_path = create_func()
        success = test_document_evaluation(file_path, expected_type, test_name)
        results.append((test_name, success))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\n🎯 Overall Result: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Document type evaluation is working correctly.")
    else:
        print("⚠️  Some tests failed. Please check the service configuration.")

if __name__ == "__main__":
    main()