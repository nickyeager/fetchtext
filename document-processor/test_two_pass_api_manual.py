#!/usr/bin/env python3
"""Manual test script to verify two-pass API integration is working."""

import requests
import json
import sys

# Test configuration
BASE_URL = "http://localhost:8090"
ENDPOINTS = [
    "/api/enhanced-documents/extract-with-text",
    # Note: extract-with-smart-template requires file upload, tested separately
]

def test_extract_with_text_two_pass():
    """Test the extract-with-text endpoint with two-pass parameter."""
    print("\n" + "=" * 80)
    print("TEST 1: /extract-with-text with use_two_pass=true")
    print("=" * 80)

    # Test document
    test_text = """
    INVOICE

    Invoice Number: INV-2024-001
    Date: January 11, 2026

    Bill To:
    Acme Corporation
    123 Main Street
    New York, NY 10001

    Items:
    - Software License: $1,500.00
    - Support Services: $500.00

    Total Amount Due: $2,000.00
    Payment Terms: Net 30
    """

    # Template variables to extract
    template_data = {
        "smart_variables": [
            {"name": "invoice_number", "type": "text", "description": "The invoice number"},
            {"name": "invoice_date", "type": "date", "description": "The date of the invoice"},
            {"name": "customer_name", "type": "text", "description": "The company name being billed"},
            {"name": "total_amount", "type": "currency", "description": "The total amount due"}
        ]
    }

    # Test with two-pass extraction
    params = {
        "text_content": test_text,
        "template_data": json.dumps(template_data),
        "confidence_threshold": 0.6,
        "use_two_pass": True
    }

    print(f"\nCalling API endpoint: {BASE_URL}/api/enhanced-documents/extract-with-text")
    print(f"Two-pass enabled: {params['use_two_pass']}")
    print(f"Template variables: {len(template_data['smart_variables'])}")

    try:
        response = requests.post(
            f"{BASE_URL}/api/enhanced-documents/extract-with-text",
            params=params,
            timeout=30
        )

        print(f"\nResponse status: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print("\n✓ SUCCESS - Two-pass extraction completed")
            print(f"\nExtraction method: {result.get('extraction_method')}")

            extracted_data = result.get('extracted_data', {})
            print(f"Extraction stats:")
            print(f"  - Method: {extracted_data.get('extraction_method', 'N/A')}")
            print(f"  - Fields requested: {extracted_data.get('total_fields_requested', 0)}")
            print(f"  - Fields extracted: {extracted_data.get('fields_extracted', 0)}")
            print(f"  - Success rate: {extracted_data.get('success_rate', 0):.1%}")
            print(f"  - Processing time: {extracted_data.get('processing_time_ms', 0)}ms")

            # Check for pass stats (specific to two-pass)
            if 'pass_stats' in extracted_data:
                print(f"\nTwo-pass statistics:")
                pass_stats = extracted_data['pass_stats']
                print(f"  - Pass 1 (high confidence): {pass_stats.get('pass1_high_confidence', 0)} fields")
                print(f"  - Pass 2 (refined): {pass_stats.get('pass2_refined', 0)} fields")

            # Show extracted values
            extracted_values = extracted_data.get('extracted_values', {})
            if extracted_values:
                print(f"\nExtracted values:")
                for field_name, field_data in extracted_values.items():
                    value = field_data.get('value', 'N/A') if isinstance(field_data, dict) else field_data
                    confidence = field_data.get('confidence', 'N/A') if isinstance(field_data, dict) else 'N/A'
                    print(f"  - {field_name}: {value} (confidence: {confidence})")

            return True
        else:
            print(f"\n✗ FAILED - Status {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False

    except Exception as e:
        print(f"\n✗ ERROR: {str(e)}")
        return False


def test_extract_with_text_standard():
    """Test the extract-with-text endpoint with standard extraction (two-pass=false)."""
    print("\n" + "=" * 80)
    print("TEST 2: /extract-with-text with use_two_pass=false (default)")
    print("=" * 80)

    test_text = "Invoice INV-001 from Test Corp, Total: $500.00"

    template_data = {
        "smart_variables": [
            {"name": "invoice_number", "type": "text"},
            {"name": "vendor", "type": "text"}
        ]
    }

    params = {
        "text_content": test_text,
        "template_data": json.dumps(template_data),
        "use_two_pass": False  # Explicitly set to false
    }

    print(f"\nCalling API endpoint: {BASE_URL}/api/enhanced-documents/extract-with-text")
    print(f"Two-pass enabled: {params['use_two_pass']}")

    try:
        response = requests.post(
            f"{BASE_URL}/api/enhanced-documents/extract-with-text",
            params=params,
            timeout=30
        )

        print(f"\nResponse status: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            extracted_data = result.get('extracted_data', {})
            method = extracted_data.get('extraction_method', 'unknown')

            print(f"\n✓ SUCCESS - Standard extraction completed")
            print(f"Extraction method: {method}")

            # Standard extraction should NOT have pass_stats
            if 'pass_stats' in extracted_data:
                print("\n⚠ WARNING: Standard extraction returned pass_stats (should only be in two-pass)")
                return False
            else:
                print("✓ Correctly using standard extraction (no pass_stats)")

            return True
        else:
            print(f"\n✗ FAILED - Status {response.status_code}")
            return False

    except Exception as e:
        print(f"\n✗ ERROR: {str(e)}")
        return False


def main():
    """Run all manual tests."""
    print("\n" + "=" * 80)
    print("TWO-PASS API INTEGRATION MANUAL TESTS")
    print("=" * 80)
    print(f"\nTesting against: {BASE_URL}")

    # Check if service is available
    try:
        health_response = requests.get(f"{BASE_URL}/health", timeout=5)
        if health_response.status_code != 200:
            print(f"\n✗ Service not available at {BASE_URL}")
            print("Please ensure document-processor is running: docker compose -p localai ps document-processor")
            sys.exit(1)
        print("✓ Service is available")
    except Exception as e:
        print(f"\n✗ Cannot connect to service: {e}")
        print("Please ensure document-processor is running.")
        sys.exit(1)

    # Run tests
    results = []
    results.append(("Two-pass extraction", test_extract_with_text_two_pass()))
    results.append(("Standard extraction", test_extract_with_text_standard()))

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status} - {test_name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n✓ All tests passed! Two-pass API integration is working correctly.")
        sys.exit(0)
    else:
        print(f"\n✗ {total - passed} test(s) failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
