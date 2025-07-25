#!/usr/bin/env python3
"""
Quick service verification script
Tests basic functionality without pytest
"""
import sys
import os
import tempfile
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

def test_service_basic():
    """Test basic service functionality"""
    
    print("🔍 Testing service imports...")
    try:
        from app.services.docling_service import DoclingService
        print("✅ DoclingService imported successfully")
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False
    
    print("🔍 Testing service initialization...")
    try:
        service = DoclingService()
        print("✅ DoclingService initialized")
        
        # Check if Docling is available
        if hasattr(service, 'use_real_docling'):
            if service.use_real_docling:
                print("✅ Real Docling is available and initialized")
            else:
                print("⚠️ Using mock implementation (Docling not available)")
        else:
            print("⚠️ Service doesn't have Docling configuration")
            
    except Exception as e:
        print(f"❌ Initialization failed: {e}")
        return False
    
    print("🔍 Testing basic methods...")
    try:
        # Test supported formats
        formats = service.get_supported_formats()
        if hasattr(formats, '__await__'):
            print("⚠️ get_supported_formats is async, skipping detailed test")
        else:
            print(f"✅ Supported formats: {formats}")
        
        # Test document type detection
        test_path = Path("test.pdf")
        doc_type = service.detect_document_type(test_path)
        if hasattr(doc_type, '__await__'):
            print("⚠️ detect_document_type is async, skipping detailed test")
        else:
            print(f"✅ Document type detection works: {doc_type}")
            
    except Exception as e:
        print(f"❌ Method test failed: {e}")
        return False
    
    return True

def test_models():
    """Test model imports"""
    
    print("🔍 Testing model imports...")
    try:
        from app.models.document import (
            DocumentMetadata, 
            DocumentType, 
            ProcessingResult,
            ExtractedContent
        )
        print("✅ All models imported successfully")
        
        # Test model creation
        from datetime import datetime
        metadata = DocumentMetadata(
            filename="test.pdf",
            file_size=1024,
            mime_type="application/pdf",
            document_type=DocumentType.PDF,
            title="Test Document",
            created_at=datetime.now(),
            modified_at=datetime.now()
        )
        print("✅ DocumentMetadata model works")
        
    except Exception as e:
        print(f"❌ Model test failed: {e}")
        return False
    
    return True

def test_file_operations():
    """Test basic file operations"""
    
    print("🔍 Testing file operations...")
    try:
        # Create a temporary file
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False, mode='w') as f:
            f.write("This is a test document.")
            temp_path = Path(f.name)
        
        try:
            # Test file exists
            if temp_path.exists():
                print("✅ Test file created successfully")
                
                # Test file size
                size = temp_path.stat().st_size
                print(f"✅ File size: {size} bytes")
                
                # Test file reading
                content = temp_path.read_text()
                print(f"✅ File content: {content[:50]}...")
                
            else:
                print("❌ Test file creation failed")
                return False
                
        finally:
            # Clean up
            if temp_path.exists():
                temp_path.unlink()
                print("✅ Test file cleaned up")
                
    except Exception as e:
        print(f"❌ File operations test failed: {e}")
        return False
    
    return True

def main():
    """Run all tests"""
    
    print("🚀 Document Service Quick Verification")
    print("=" * 50)
    
    tests = [
        ("Model Tests", test_models),
        ("File Operations", test_file_operations),
        ("Service Basic Tests", test_service_basic),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"\n📋 Running: {test_name}")
        print("-" * 30)
        
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} PASSED")
            else:
                failed += 1
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            failed += 1
            print(f"❌ {test_name} ERROR: {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All basic tests passed!")
        print("📝 Service appears to be working correctly")
        print("🔧 To run full tests, use Docker or fix Python environment")
    else:
        print("⚠️ Some tests failed")
        print("🔧 Check the errors above for details")
    
    return failed == 0

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Test runner error: {e}")
        sys.exit(1)
