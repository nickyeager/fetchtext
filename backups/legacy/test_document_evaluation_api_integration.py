#!/usr/bin/env python3
"""
API Integration test for document evaluation timeout fix

Tests the actual HTTP API endpoint to ensure timeout handling works in production.
"""
import requests
import time
import tempfile
from pathlib import Path

def create_test_invoice():
    """Create a test invoice file"""
    content = """
ACME Corporation
Invoice #12345

Bill To:
John Smith
123 Main Street
Anytown, ST 12345

Date: January 15, 2024
Due Date: February 15, 2024

Description                 Quantity    Unit Price    Amount
Web Development Services    1           $2,500.00     $2,500.00
Domain Registration        1           $15.00        $15.00
Hosting (1 year)          1           $120.00       $120.00

                                       Subtotal:     $2,635.00
                                       Tax (8%):     $210.80
                                       TOTAL:        $2,845.80

Payment Terms: Net 30 days
Thank you for your business!
"""
    
    temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
    temp_file.write(content)
    temp_file.close()
    return Path(temp_file.name)

def test_document_evaluation_api():
    """Test the document evaluation API endpoint"""
    
    base_url = "http://localhost:8090"
    endpoint = f"{base_url}/api/enhanced-documents/evaluate-document-type"
    
    # Check if service is running
    try:
        health_response = requests.get(f"{base_url}/health", timeout=5)
        if health_response.status_code != 200:
            print("❌ Document processor service is not running")
            return False
    except requests.exceptions.RequestException:
        print("❌ Document processor service is not accessible at http://localhost:8090")
        print("   Please start services with: python start_services.py --profile cpu")
        return False
    
    print("✅ Document processor service is running")
    
    # Create test file
    test_file_path = create_test_invoice()
    
    try:
        print("🧪 Testing document evaluation API...")
        
        # Test with timeout-resistant parameters
        with open(test_file_path, 'rb') as f:
            files = {'file': ('test_invoice.txt', f, 'text/plain')}
            params = {
                'quick_scan': True,  # Use quick scan to reduce processing time
                'include_confidence_scores': True,
                'suggest_templates': True
            }
            
            start_time = time.time()
            
            # Make request with 70-second timeout (longer than frontend 60s to test backend handling)
            response = requests.post(
                endpoint,
                files=files,
                params=params,
                timeout=70
            )
            
            elapsed_time = time.time() - start_time
            
            print(f"⏱️  Request completed in {elapsed_time:.2f} seconds")
            
            if response.status_code == 200:
                result = response.json()
                
                # Validate response structure
                assert 'document_info' in result
                assert 'type_evaluation' in result
                assert 'template_suggestions' in result
                assert 'processing_recommendations' in result
                
                # Validate document type detection
                type_eval = result['type_evaluation']
                assert type_eval['primary_type'] in ['invoice', 'unknown']  # Should detect as invoice or fallback
                
                print(f"✅ Document type detected: {type_eval['primary_type']}")
                print(f"✅ Confidence: {type_eval['confidence']:.2f}")
                print(f"✅ Detection method: {type_eval['detection_method']}")
                print(f"✅ Template suggestions: {len(result['template_suggestions'])}")
                
                # Test passed
                return True
            else:
                print(f"❌ API returned error: {response.status_code} - {response.text}")
                return False
                
    except requests.exceptions.Timeout:
        print("❌ Request timed out after 70 seconds - backend timeout fix not working")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False
    finally:
        # Cleanup test file
        test_file_path.unlink(missing_ok=True)

def test_frontend_timeout_simulation():
    """Test the frontend timeout scenario specifically"""
    
    print("\n🧪 Testing frontend timeout scenario (60 second limit)...")
    
    base_url = "http://localhost:8090"
    endpoint = f"{base_url}/api/enhanced-documents/evaluate-document-type"
    
    # Create test file
    test_file_path = create_test_invoice()
    
    try:
        with open(test_file_path, 'rb') as f:
            files = {'file': ('test_invoice.txt', f, 'text/plain')}
            params = {
                'quick_scan': True,
                'include_confidence_scores': True,
                'suggest_templates': True
            }
            
            start_time = time.time()
            
            # Use 60-second timeout like the frontend
            response = requests.post(
                endpoint,
                files=files,
                params=params,
                timeout=60  # Same as frontend timeout
            )
            
            elapsed_time = time.time() - start_time
            
            if elapsed_time < 60 and response.status_code == 200:
                print(f"✅ Frontend timeout scenario handled successfully ({elapsed_time:.2f}s)")
                result = response.json()
                
                # Even if processing times out internally, we should get a valid response
                if result['type_evaluation']['detection_method'] == 'filename_pattern':
                    print("✅ Fallback detection method used (expected behavior)")
                else:
                    print("✅ Full processing completed within timeout")
                
                return True
            else:
                print(f"❌ Request took too long ({elapsed_time:.2f}s) or failed")
                return False
                
    except requests.exceptions.Timeout:
        print("❌ Request still timing out at 60 seconds - fix may not be complete")
        return False
    finally:
        test_file_path.unlink(missing_ok=True)

def main():
    """Run API integration tests"""
    
    print("🚀 Document Evaluation API Integration Tests")
    print("=" * 50)
    
    # Test basic API functionality
    basic_test_passed = test_document_evaluation_api()
    
    # Test frontend timeout scenario
    timeout_test_passed = test_frontend_timeout_simulation()
    
    print("\n📊 Test Summary:")
    print(f"Basic API Test: {'✅ PASSED' if basic_test_passed else '❌ FAILED'}")
    print(f"Timeout Handling Test: {'✅ PASSED' if timeout_test_passed else '❌ FAILED'}")
    
    if basic_test_passed and timeout_test_passed:
        print("\n🎉 All integration tests passed!")
        print("The document evaluation timeout fix is working correctly.")
        print("\nConfiguration:")
        print("- DOCUMENT_PROCESSING_TIMEOUT: Set to adjust document processing timeout (default: 45s)")
        print("- TEMPLATE_QUERY_TIMEOUT: Set to adjust template query timeout (default: 10s)")
        return True
    else:
        print("\n⚠️  Some tests failed. Please check the implementation.")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)