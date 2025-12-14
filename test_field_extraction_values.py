#!/usr/bin/env python3
"""
TDD Test: Field Value Extraction

RED PHASE: This test will FAIL because backend returns "No extraction found" instead of actual values.

Expected behavior:
- Extract actual field values from document
- NOT return "No extraction found for X"
- Confidence should be > 0.1 for successfully extracted fields

Test will verify:
1. Template generation creates fields
2. Field extraction returns ACTUAL VALUES (not "No extraction found")
3. At least 50% of fields have real values extracted
"""

import requests
import json
import sys

BACKEND_URL = "http://localhost:8090"
TEST_FILE = "Stucco Contract V1.pdf"

def test_field_extraction_returns_actual_values():
    """
    RED PHASE TEST - This should FAIL initially

    Verifies that field extraction returns actual values from the document,
    not placeholder "No extraction found" messages.
    """
    print("\n" + "="*80)
    print("TDD TEST: Field Value Extraction")
    print("="*80)
    print("\nRED PHASE: Expecting this test to FAIL initially\n")

    # Step 1: Generate template
    print("Step 1: Generating template...")
    with open(TEST_FILE, 'rb') as f:
        response = requests.post(
            f"{BACKEND_URL}/api/enhanced-documents/decide-template",
            files={'file': (TEST_FILE, f, 'application/pdf')},
            params={
                'quick_scan': True,
                'min_match_confidence': 0.7,
                'allow_generation': True
            },
            timeout=120
        )

    if response.status_code != 200:
        print(f"❌ Template generation failed: {response.status_code}")
        return False

    result = response.json()
    template = result.get('template') or result.get('chosen_template')

    if not template:
        print("❌ No template returned")
        return False

    variables = template.get('smart_variables') or template.get('variables', [])
    print(f"✓ Template generated with {len(variables)} variables")

    # Step 2: Extract fields using the template
    print(f"\nStep 2: Extracting {len(variables)} fields...")

    with open(TEST_FILE, 'rb') as f:
        response = requests.post(
            f"{BACKEND_URL}/api/enhanced-documents/extract-with-smart-template",
            files={'file': (TEST_FILE, f, 'application/pdf')},
            data={
                'template_data': json.dumps({
                    'id': 1,
                    'name': template.get('name'),
                    'smart_variables': variables,
                    'extraction_rules': template.get('extraction_rules', []),
                    'generation_settings': template.get('generation_settings', {}),
                    'confidence_threshold': 0.7
                }),
                'processing_mode': 'smart_template',
                'enable_validation': 'true',
                'confidence_threshold': '0.7'
            },
            timeout=150
        )

    if response.status_code != 200:
        print(f"❌ Extraction failed: {response.status_code}")
        print(response.text[:500])
        return False

    extraction_result = response.json()

    # Step 3: Verify extracted values
    print("\nStep 3: Verifying extracted values...")

    extracted_data = extraction_result.get('extracted_data', {})

    if not extracted_data:
        print("❌ No extracted_data in response")
        print(f"Response keys: {list(extraction_result.keys())}")
        return False

    # Backend returns: extracted_data.extracted_values (nested structure)
    extracted_values = extracted_data.get('extracted_values', {})

    if not extracted_values:
        print("❌ No extracted_values in extracted_data")
        print(f"extracted_data keys: {list(extracted_data.keys())}")
        return False

    print(f"\nExtracted values structure:")
    print(json.dumps(extracted_values, indent=2, default=str)[:1500])

    # Check each field
    failed_extractions = []
    successful_extractions = []
    total_fields = len(variables)

    for var in variables:
        field_name = var.get('name')
        field_data = extracted_values.get(field_name, {})

        if isinstance(field_data, dict):
            value = field_data.get('value', '')
            confidence = field_data.get('confidence', 0)
            source_text = field_data.get('sourceText', '')

            # CRITICAL TEST: Check for "No extraction found" messages
            if 'No extraction found' in str(value) or 'No extraction found' in str(source_text):
                failed_extractions.append({
                    'field': field_name,
                    'reason': 'Contains "No extraction found" message',
                    'value': value,
                    'confidence': confidence
                })
            elif not value or value.strip() == '':
                failed_extractions.append({
                    'field': field_name,
                    'reason': 'Empty value',
                    'confidence': confidence
                })
            elif confidence <= 0.1:
                failed_extractions.append({
                    'field': field_name,
                    'reason': 'Very low confidence (placeholder)',
                    'value': value,
                    'confidence': confidence
                })
            else:
                successful_extractions.append({
                    'field': field_name,
                    'value': value,
                    'confidence': confidence
                })

    # Print results
    print(f"\n{'='*80}")
    print("EXTRACTION RESULTS:")
    print(f"{'='*80}")
    print(f"Total fields: {total_fields}")
    print(f"Successful extractions: {len(successful_extractions)}")
    print(f"Failed extractions: {len(failed_extractions)}")

    if successful_extractions:
        print(f"\n✓ Successfully extracted fields:")
        for item in successful_extractions:
            print(f"  - {item['field']}: '{item['value'][:50]}...' (confidence: {item['confidence']:.2f})")

    if failed_extractions:
        print(f"\n❌ Failed extractions:")
        for item in failed_extractions:
            print(f"  - {item['field']}: {item['reason']}")
            if 'value' in item:
                print(f"    Value: '{str(item['value'])[:50]}...'")
            print(f"    Confidence: {item.get('confidence', 0):.2f}")

    # Success criteria: At least 50% of fields should have real values
    success_rate = len(successful_extractions) / total_fields if total_fields > 0 else 0

    print(f"\n{'='*80}")
    print(f"SUCCESS RATE: {success_rate:.1%} ({len(successful_extractions)}/{total_fields})")
    print(f"{'='*80}")

    if success_rate >= 0.5:
        print("\n✅ TEST PASSED: At least 50% of fields extracted successfully")
        return True
    else:
        print(f"\n❌ TEST FAILED: Only {success_rate:.1%} of fields extracted (need ≥50%)")
        print("\nExpected: Actual field values extracted from document")
        print("Actual: 'No extraction found' placeholder messages")
        print("\nThis test is EXPECTED to fail in RED phase.")
        print("Next: Fix backend to extract actual values (GREEN phase)")
        return False

if __name__ == '__main__':
    success = test_field_extraction_returns_actual_values()
    sys.exit(0 if success else 1)
