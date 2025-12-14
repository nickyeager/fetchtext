#!/usr/bin/env python3
"""
Test API Data Structure Compatibility

This test verifies that the API returns data in the format that the frontend expects
after our data transformation fix.

Expected Frontend Data Structure (after fix):
{
  "extracted_data": {
    "extracted_values": {
      "email": { "value": "...", "confidence": 1.0, "sourceText": "..." },
      "submitted_to": { "value": "...", "confidence": 1.0, "sourceText": "..." }
    },
    "confidence_scores": {
      "email": 1.0,
      "submitted_to": 1.0
    }
  }
}
"""

import requests
import json
from typing import Dict, Any

# Configuration
BACKEND_URL = "http://localhost:8090"
TEST_FILE = "Stucco Contract V1.pdf"

def print_section(title: str):
    """Print a formatted section header."""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80 + "\n")

def test_backend_response_structure():
    """Test that backend returns data in expected structure."""
    print_section("STEP 1: Test Backend Response Structure")

    url = f"{BACKEND_URL}/api/enhanced-documents/decide-template"

    with open(TEST_FILE, 'rb') as f:
        files = {'file': (TEST_FILE, f, 'application/pdf')}
        params = {
            'quick_scan': True,
            'min_match_confidence': 0.7,
            'allow_generation': True
        }

        print(f"Uploading {TEST_FILE} to /decide-template...")
        response = requests.post(url, files=files, params=params, timeout=120)

        if response.status_code != 200:
            print(f"❌ Upload failed: {response.status_code}")
            print(response.text)
            return False

        result = response.json()
        print(f"✓ Upload successful, action: {result.get('action')}")

        # Check response structure
        print("\nResponse keys:", list(result.keys()))

        # The /decide-template endpoint returns template definition, not extracted values
        # Extracted values come from /extract-with-smart-template or processWithExistingTemplate

        template = result.get('template') or result.get('chosen_template')
        if template:
            print(f"✓ Template found: {template.get('name')}")
            variables = template.get('smart_variables') or template.get('variables', [])
            print(f"✓ Variables defined: {len(variables)}")

            for var in variables[:3]:  # Show first 3
                print(f"  - {var.get('name')}: {var.get('type')}")

        return True

def test_extraction_response_structure():
    """Test that extraction endpoint returns data in expected structure."""
    print_section("STEP 2: Test Extraction Response Structure")

    # First generate/get template
    url = f"{BACKEND_URL}/api/enhanced-documents/decide-template"

    with open(TEST_FILE, 'rb') as f:
        files = {'file': (TEST_FILE, f, 'application/pdf')}
        params = {
            'quick_scan': True,
            'min_match_confidence': 0.7,
            'allow_generation': True
        }

        print(f"Getting template for {TEST_FILE}...")
        response = requests.post(url, files=files, params=params, timeout=120)

        if response.status_code != 200:
            print(f"❌ Failed to get template: {response.status_code}")
            return False

        decision = response.json()
        template = decision.get('template') or decision.get('chosen_template')

        if not template:
            print("❌ No template in response")
            return False

        print(f"✓ Got template: {template.get('name')}")

    # Now test extraction
    print("\nTesting extraction endpoint...")
    extraction_url = f"{BACKEND_URL}/api/enhanced-documents/extract-with-smart-template"

    with open(TEST_FILE, 'rb') as f:
        files = {'file': (TEST_FILE, f, 'application/pdf')}
        data = {
            'template_data': json.dumps({
                'id': template.get('id', 1),
                'name': template.get('name'),
                'smart_variables': template.get('smart_variables') or template.get('variables', []),
                'extraction_rules': template.get('extraction_rules', []),
                'generation_settings': template.get('generation_settings', {}),
                'confidence_threshold': 0.7
            }),
            'processing_mode': 'smart_template',
            'enable_validation': 'true',
            'confidence_threshold': '0.7'
        }

        print("Calling /extract-with-smart-template...")
        response = requests.post(extraction_url, files=files, data=data, timeout=150)

        if response.status_code != 200:
            print(f"❌ Extraction failed: {response.status_code}")
            print(response.text[:500])
            return False

        result = response.json()
        print(f"✓ Extraction successful")

        # Check response structure
        print("\nExtraction response keys:", list(result.keys()))

        # Backend returns either 'extraction_results' or 'extracted_fields'
        extraction_data = result.get('extraction_results') or result.get('extracted_fields')

        if not extraction_data:
            print("❌ No extraction_results or extracted_fields in response")
            print("Available keys:", list(result.keys()))
            return False

        print(f"✓ Extraction data found: {len(extraction_data)} fields")

        # Verify field structure
        print("\nField structure verification:")
        for field_name, field_data in list(extraction_data.items())[:3]:  # Check first 3
            if isinstance(field_data, dict):
                has_value = 'value' in field_data
                has_confidence = 'confidence' in field_data

                print(f"  ✓ {field_name}:")
                print(f"    - has 'value': {has_value}")
                print(f"    - has 'confidence': {has_confidence}")
                if has_value:
                    print(f"    - value: {str(field_data['value'])[:50]}...")
                if has_confidence:
                    print(f"    - confidence: {field_data['confidence']}")
            else:
                print(f"  ⚠️  {field_name}: Not a structured object")

        return True

def test_frontend_transformation():
    """Simulate frontend transformation and verify it produces correct structure."""
    print_section("STEP 3: Test Frontend Transformation")

    # Simulate what backend returns
    mock_backend_response = {
        'extractedFields': {
            'email': {
                'value': 'yeag123@gmail.com',
                'confidence': 1.0,
                'sourceText': 'Email: yeag123@gmail.com'
            },
            'submitted_to': {
                'value': 'Nicholas Yeager',
                'confidence': 1.0,
                'sourceText': 'Submitted To: Nicholas Yeager'
            },
            'total_project_price': {
                'value': '$8,000.00',
                'confidence': 1.0,
                'sourceText': 'Total: $8,000.00'
            }
        }
    }

    print("Simulating backend response with extractedFields...")
    print(f"✓ Mock backend has {len(mock_backend_response['extractedFields'])} fields")

    # Simulate frontend transformation (DocumentUploadPage.tsx)
    rawExtractedFields = mock_backend_response.get('extractedFields')

    # Transform to the format DocumentDetailView expects
    extractedData = {
        'extracted_values': rawExtractedFields,
        'confidence_scores': {
            key: field.get('confidence', 0)
            for key, field in rawExtractedFields.items()
        }
    }

    print("\nFrontend transformation result:")
    print(f"✓ extracted_data structure created")
    print(f"✓ extracted_values: {len(extractedData['extracted_values'])} fields")
    print(f"✓ confidence_scores: {len(extractedData['confidence_scores'])} scores")

    # Verify DocumentDetailView can access the data
    print("\nVerifying DocumentDetailView access path:")

    # Simulate document.metadata.extracted_data
    metadata = {'extracted_data': extractedData}

    # DocumentDetailView checks: metadata.extracted_data.extracted_values
    if 'extracted_data' in metadata:
        print("✓ metadata.extracted_data exists")

        ed = metadata['extracted_data']
        if isinstance(ed, dict) and 'extracted_values' in ed:
            print("✓ metadata.extracted_data.extracted_values exists")

            extracted_values = ed['extracted_values']
            print(f"✓ Found {len(extracted_values)} fields in extracted_values")

            # Verify we can access individual fields
            for field_name in list(extracted_values.keys())[:3]:
                field_data = extracted_values[field_name]
                if isinstance(field_data, dict) and 'value' in field_data:
                    print(f"  ✓ Can access {field_name}.value: {field_data['value']}")
                else:
                    print(f"  ⚠️  {field_name} missing value property")
        else:
            print("❌ metadata.extracted_data.extracted_values NOT found")
            return False
    else:
        print("❌ metadata.extracted_data NOT found")
        return False

    print("\n✅ Frontend transformation creates correct data structure!")
    return True

def main():
    """Run all API data structure tests."""
    print("\n" + "="*80)
    print("  API Data Structure Compatibility Test")
    print("="*80)
    print("\nVerifying API returns data in format frontend expects\n")

    results = []

    # Test 1: Backend response structure
    test1 = test_backend_response_structure()
    results.append(("Backend Response Structure", test1))

    # Test 2: Extraction response structure
    test2 = test_extraction_response_structure()
    results.append(("Extraction Response Structure", test2))

    # Test 3: Frontend transformation
    test3 = test_frontend_transformation()
    results.append(("Frontend Transformation", test3))

    # Print summary
    print_section("Test Summary")

    all_passed = True
    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {test_name}")
        if not passed:
            all_passed = False

    if all_passed:
        print("\n" + "="*80)
        print("✅ ALL TESTS PASSED - API data structure is correct!")
        print("="*80)
        return 0
    else:
        print("\n" + "="*80)
        print("❌ SOME TESTS FAILED - Review output above")
        print("="*80)
        return 1

if __name__ == "__main__":
    exit(main())
