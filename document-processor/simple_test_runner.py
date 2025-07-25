#!/usr/bin/env python3
"""
Simple test runner to verify document service works
Run this directly: python3 simple_test_runner.py
"""

import sys
import os
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

def test_imports():
    """Test that imports work"""
    print("🔍 Testing imports...")
    
    try:
        # Test basic imports
        import tempfile
        import asyncio
        from datetime import datetime
        print("✅ Basic imports work")
        
        # Test service imports
        from app.services.docling_service import DoclingService
        print("✅ DoclingService import works")
        
        # Test model imports  
        from app.models.document import DocumentMetadata, DocumentType
        print("✅ Document models import works")
        
        return True
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False

def test_service_creation():
    """Test service can be created"""
    print("🔍 Testing service creation...")
    
    try:
        from app.services.docling_service import DoclingService
        service = DoclingService()
        print("✅ DoclingService created successfully")
        
        # Check if it has required methods
        required_methods = [
            'get_supported_formats',
            'detect_document_type', 
            'extract_metadata',
            'process_document',
            'extract_content_from_file'
        ]
        
        for method in required_methods:
            if hasattr(service, method):
                print(f"✅ Method exists: {method}")
            else:
                print(f"❌ Method missing: {method}")
                return False
        
        return True
    except Exception as e:
        print(f"❌ Service creation failed: {e}")
        return False

def test_file_operations():
    """Test basic file operations"""
    print("🔍 Testing file operations...")
    
    try:
        import tempfile
        from pathlib import Path
        
        # Create temp file
        with tempfile.NamedTemporaryFile(suffix='.txt', mode='w', delete=False) as f:
            f.write("Test content")
            temp_path = Path(f.name)
        
        try:
            # Test file exists
            assert temp_path.exists()
            print("✅ File creation works")
            
            # Test file reading
            content = temp_path.read_text()
            assert content == "Test content"
            print("✅ File reading works")
            
            # Test service with file
            from app.services.docling_service import DoclingService
            service = DoclingService()
            
            # Test document type detection
            doc_type = service.detect_document_type(temp_path)
            print(f"✅ Document type detection works: {doc_type}")
            
            return True
            
        finally:
            # Cleanup
            if temp_path.exists():
                temp_path.unlink()
                
    except Exception as e:
        print(f"❌ File operations failed: {e}")
        return False

def run_pytest_if_available():
    """Try to run pytest if available"""
    print("🔍 Trying to run pytest...")
    
    try:
        import subprocess
        import sys
        
        # Try to run a simple pytest command
        result = subprocess.run([
            sys.executable, '-m', 'pytest', 
            'tests/unit/test_metadata_extraction.py::TestMetadataExtraction::test_metadata_model_structure',
            '-v', '--tb=short'
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print("✅ pytest ran successfully")
            print("Test output:", result.stdout[-200:])  # Last 200 chars
            return True
        else:
            print("⚠️ pytest failed or had issues")
            print("Error:", result.stderr[-200:])  # Last 200 chars
            return False
            
    except subprocess.TimeoutExpired:
        print("⚠️ pytest timed out")
        return False
    except Exception as e:
        print(f"⚠️ pytest not available or failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Simple Document Service Test Runner")
    print("=" * 50)
    
    tests = [
        ("Import Tests", test_imports),
        ("Service Creation", test_service_creation), 
        ("File Operations", test_file_operations),
        ("Pytest Execution", run_pytest_if_available)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}")
        print("-" * 30)
        
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} PASSED")
            else:
                print(f"⚠️ {test_name} FAILED")
        except Exception as e:
            print(f"❌ {test_name} ERROR: {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Service appears to be working.")
    elif passed >= 3:
        print("✅ Core functionality works. Some advanced features may need attention.")
    else:
        print("⚠️ Some core issues detected. Check errors above.")
    
    print("\n💡 To run full test suite:")
    print("docker build -f Dockerfile.test -t docprocessor-test .")
    print("docker run --rm -v $(pwd):/app docprocessor-test pytest tests/ -v")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n❌ Test interrupted")
    except Exception as e:
        print(f"\n❌ Test runner error: {e}")
        import traceback
        traceback.print_exc()
