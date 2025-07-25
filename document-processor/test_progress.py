#!/usr/bin/env python3
"""
Quick test summary for Docling upgrade progress
"""

import subprocess
import sys
from pathlib import Path

def run_test_subset():
    """Run a subset of key tests to check progress"""
    
    key_tests = [
        # Docling availability tests
        "tests/unit/test_docling_converter.py::TestDoclingConverter::test_docling_import_available",
        "tests/unit/test_docling_converter.py::TestDoclingConverter::test_document_converter_import",
        
        # Service interface tests
        "tests/unit/test_content_extraction.py::TestContentExtraction::test_extract_content_from_file_exists", 
        "tests/unit/test_docling_converter.py::TestDoclingServiceUpgrade::test_service_has_required_methods",
        
        # Metadata tests
        "tests/unit/test_metadata_extraction.py::TestMetadataExtraction::test_metadata_model_structure",
        "tests/unit/test_metadata_extraction.py::TestMetadataExtraction::test_metadata_optional_fields",
    ]
    
    print("🔍 Docling Upgrade Progress Test Summary")
    print("=" * 50)
    
    passed = 0
    failed = 0
    
    for test in key_tests:
        print(f"\n📋 Running: {test.split('::')[-1]}")
        try:
            result = subprocess.run([
                "python", "-m", "pytest", test, "-v", "--tb=no"
            ], capture_output=True, text=True, cwd=Path.cwd())
            
            if result.returncode == 0:
                print("  ✅ PASSED")
                passed += 1
            else:
                print("  ❌ FAILED")
                failed += 1
                
        except Exception as e:
            print(f"  ⚠️  ERROR: {e}")
            failed += 1
    
    print("\n" + "=" * 50)
    print(f"📊 SUMMARY: {passed} passed, {failed} failed")
    print(f"Progress: {passed/(passed+failed)*100:.1f}%")
    
    return passed, failed

if __name__ == "__main__":
    passed, failed = run_test_subset()
    sys.exit(0 if failed == 0 else 1)
