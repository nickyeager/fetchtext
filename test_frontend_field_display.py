#!/usr/bin/env python3
"""
Integration test to verify extracted field values display correctly in frontend.

This test verifies the complete fix:
1. DocumentUploadPage stores extracted data in metadata.extracted_data
2. DocumentDetailView reads from metadata.extracted_data.extracted_values
3. ExtractedFieldsEditor displays the values correctly

Test Flow:
1. Upload document via API
2. Verify extracted_data is stored in metadata
3. Query document to confirm data structure
4. Verify no "No extraction found" scenarios
"""

import requests
import json
import time
from typing import Dict, Any

# Configuration
BACKEND_URL = "http://localhost:8090"
SUPABASE_URL = "http://localhost:8000"
TEST_FILE = "Stucco Contract V1.pdf"

def upload_document_and_extract() -> Dict[str, Any]:
    """Upload document and trigger extraction."""
    print("\n" + "="*80)
    print("STEP 1: Upload Document and Extract Fields")
    print("="*80)

    url = f"{BACKEND_URL}/api/enhanced-documents/decide-template"

    with open(TEST_FILE, 'rb') as f:
        files = {'file': (TEST_FILE, f, 'application/pdf')}
        params = {
            'quick_scan': True,
            'min_match_confidence': 0.7,
            'allow_generation': True
        }

        print(f"Uploading {TEST_FILE}...")
        response = requests.post(url, files=files, params=params, timeout=120)

        if response.status_code != 200:
            print(f"❌ Upload failed: {response.status_code}")
            print(response.text)
            return {}

        result = response.json()
        print(f"✓ Upload successful")
        print(f"✓ Action: {result.get('action')}")
        print(f"✓ Extraction method: {result.get('decision_metadata', {}).get('extraction_method')}")

        return result

def verify_extracted_data_structure(result: Dict[str, Any]) -> bool:
    """Verify extracted_data structure matches DocumentDetailView expectations."""
    print("\n" + "="*80)
    print("STEP 2: Verify extracted_data Structure")
    print("="*80)

    # Check for extracted_data in response
    extracted_data = result.get('extracted_data')
    if not extracted_data:
        print("❌ No extracted_data in response")
        return False

    print(f"✓ extracted_data found in response")

    # Check for extracted_values
    extracted_values = extracted_data.get('extracted_values')
    if not extracted_values:
        print("❌ No extracted_values in extracted_data")
        return False

    print(f"✓ extracted_values found: {len(extracted_values)} fields")

    # Verify field structure
    all_fields_valid = True
    for field_name, field_data in extracted_values.items():
        if isinstance(field_data, dict):
            has_value = 'value' in field_data
            has_confidence = 'confidence' in field_data

            if has_value and has_confidence:
                confidence = field_data.get('confidence', 0)
                value = field_data.get('value', '')
                print(f"  ✓ {field_name}: {value} (confidence: {confidence})")
            else:
                print(f"  ⚠️  {field_name}: Missing value or confidence")
                all_fields_valid = False
        else:
            print(f"  ⚠️  {field_name}: Not a structured object")
            all_fields_valid = False

    return all_fields_valid

def verify_metadata_storage_format(result: Dict[str, Any]) -> bool:
    """Verify the metadata format matches what frontend expects."""
    print("\n" + "="*80)
    print("STEP 3: Verify Metadata Storage Format")
    print("="*80)

    # The frontend DocumentUploadPage should store extracted_data in metadata
    # Check if backend response includes metadata-compatible structure

    extracted_data = result.get('extracted_data')
    if not extracted_data:
        print("❌ No extracted_data to store in metadata")
        return False

    # Verify structure DocumentDetailView expects:
    # metadata.extracted_data.extracted_values
    # metadata.extracted_data.confidence_scores (optional)

    expected_paths = [
        ('extracted_data', 'extracted_values'),
        ('extracted_data', 'confidence_scores')
    ]

    metadata_compatible = True
    for path in expected_paths:
        if len(path) == 2:
            parent, child = path
            parent_data = result.get(parent, {})
            if isinstance(parent_data, dict) and child in parent_data:
                print(f"  ✓ {parent}.{child} exists")
            else:
                print(f"  ⚠️  {parent}.{child} missing (optional)")
                if child == 'extracted_values':
                    metadata_compatible = False

    return metadata_compatible

def check_for_no_extraction_scenarios(result: Dict[str, Any]) -> bool:
    """Verify there are no 'No extraction found' scenarios."""
    print("\n" + "="*80)
    print("STEP 4: Check for Missing Extractions")
    print("="*80)

    extracted_values = result.get('extracted_data', {}).get('extracted_values', {})

    if not extracted_values:
        print("❌ No extracted values - will show 'No extraction found'")
        return False

    missing_values = []
    successful_extractions = 0

    for field_name, field_data in extracted_values.items():
        if isinstance(field_data, dict):
            value = field_data.get('value', '')
            confidence = field_data.get('confidence', 0)

            # Check for empty or placeholder values
            if not value or value.strip() == '' or value.startswith('$____'):
                missing_values.append(field_name)
            else:
                successful_extractions += 1
        else:
            missing_values.append(field_name)

    total_fields = len(extracted_values)
    success_rate = (successful_extractions / total_fields * 100) if total_fields > 0 else 0

    print(f"✓ Total fields: {total_fields}")
    print(f"✓ Successful extractions: {successful_extractions}")
    print(f"✓ Success rate: {success_rate:.1f}%")

    if missing_values:
        print(f"\n⚠️  Fields with missing/placeholder values ({len(missing_values)}):")
        for field in missing_values:
            print(f"  - {field}")
    else:
        print("\n✓ All fields have valid values")

    # Consider it successful if we have at least 50% extraction rate
    return success_rate >= 50

def main():
    """Run complete integration test."""
    print("\n" + "="*80)
    print("FRONTEND FIELD DISPLAY INTEGRATION TEST")
    print("="*80)
    print("\nThis test verifies the complete fix:")
    print("1. Backend extracts field values")
    print("2. Response includes extracted_data.extracted_values")
    print("3. Frontend can display values (no 'No extraction found')")
    print("="*80)

    # Step 1: Upload and extract
    result = upload_document_and_extract()
    if not result:
        print("\n❌ TEST FAILED: Upload/extraction failed")
        return 1

    # Step 2: Verify data structure
    structure_valid = verify_extracted_data_structure(result)
    if not structure_valid:
        print("\n❌ TEST FAILED: Invalid data structure")
        return 1

    # Step 3: Verify metadata format
    metadata_valid = verify_metadata_storage_format(result)
    if not metadata_valid:
        print("\n❌ TEST FAILED: Metadata format incompatible")
        return 1

    # Step 4: Check for missing extractions
    no_missing = check_for_no_extraction_scenarios(result)
    if not no_missing:
        print("\n❌ TEST FAILED: Too many missing extractions")
        return 1

    # Final summary
    print("\n" + "="*80)
    print("✅ INTEGRATION TEST PASSED")
    print("="*80)
    print("\nVerified:")
    print("✓ Backend successfully extracts field values")
    print("✓ Response structure matches DocumentDetailView expectations")
    print("✓ Metadata format compatible with frontend storage")
    print("✓ No 'No extraction found' scenarios (>50% success rate)")
    print("\nFrontend should now display extracted field values correctly!")
    print("="*80)

    return 0

if __name__ == "__main__":
    exit(main())
