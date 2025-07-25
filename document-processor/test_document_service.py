#!/usr/bin/env python3
"""
Simple test script to verify document service functionality
This bypasses pytest and runs direct tests
"""
import sys
import os
import asyncio
from pathlib import Path
import tempfile
from datetime import datetime

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent / "app"))

def test_imports():
    """Test that all required imports work"""
    print("🔍 Testing imports...")
    
    try:
        from app.services.docling_service import DoclingService
        print("✅ DoclingService import successful")
    except ImportError as e:
        print(f"❌ DoclingService import failed: {e}")
        return False
    
    try:
        from app.models.document import DocumentMetadata, DocumentType, ProcessingResult
        print("✅ Document models import successful")
    except ImportError as e:
        print(f"❌ Document models import failed: {e}")
        return False
    
    return True

def test_docling_availability():
    """Test Docling availability"""
    print("🔍 Testing Docling availability...")
    
    try:
        from docling.document_converter import DocumentConverter
        print("✅ Docling is available")
        return True
    except ImportError as e:
        print(f"⚠️ Docling not available: {e}")
        return False

async def test_service_initialization():
    """Test service initialization"""
    print("🔍 Testing service initialization...")
    
    try:
        from app.services.docling_service import DoclingService
        service = DoclingService()
        print("✅ DoclingService initialized successfully")
        
        # Test supported formats
        formats = await service.get_supported_formats()
        print(f"✅ Supported formats: {formats}")
        
        return True
    except Exception as e:
        print(f"❌ Service initialization failed: {e}")
        return False

async def test_metadata_extraction():
    """Test metadata extraction"""
    print("🔍 Testing metadata extraction...")
    
    try:
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        # Create a temporary test file
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as tmp_file:
            tmp_file.write(b"This is a test document content.")
            tmp_path = Path(tmp_file.name)
        
        try:
            metadata = await service.extract_metadata(tmp_path)
            print(f"✅ Metadata extracted:")
            print(f"  - Filename: {metadata.filename}")
            print(f"  - File size: {metadata.file_size}")
            print(f"  - MIME type: {metadata.mime_type}")
            print(f"  - Document type: {metadata.document_type}")
            print(f"  - Title: {metadata.title}")
            
            return True
        finally:
            # Clean up temp file
            os.unlink(tmp_path)
            
    except Exception as e:
        print(f"❌ Metadata extraction failed: {e}")
        return False

async def test_content_extraction():
    """Test content extraction with mock file"""
    print("🔍 Testing content extraction...")
    
    try:
        from app.services.docling_service import DoclingService
        service = DoclingService()
        
        # Create a temporary test file
        test_content = "This is a test document for content extraction."
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False, mode='w') as tmp_file:
            tmp_file.write(test_content)
            tmp_path = Path(tmp_file.name)
        
        try:
            # Test content extraction
            if hasattr(service, 'extract_content_from_file'):
                result = await service.extract_content_from_file(tmp_path)
                print(f"✅ Content extraction successful:")
                print(f"  - Content: {result.content[:100]}...")
                print(f"  - Metadata: {result.metadata.filename}")
                return True
            else:
                print("⚠️ extract_content_from_file method not found")
                return False
                
        finally:
            # Clean up temp file
            os.unlink(tmp_path)
            
    except Exception as e:
        print(f"❌ Content extraction failed: {e}")
        return False

async def test_document_processing():
    """Test full document processing workflow"""
    print("🔍 Testing document processing workflow...")
    
    try:
        from app.services.docling_service import DoclingService
        from app.models.document import DocumentProcessRequest
        
        service = DoclingService()
        
        # Create a test document
        test_content = "This is a test document.\n\nIt has multiple lines.\n\nAnd some structure."
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False, mode='w') as tmp_file:
            tmp_file.write(test_content)
            tmp_path = Path(tmp_file.name)
        
        try:
            # Create process request
            request = DocumentProcessRequest(
                file_path=str(tmp_path),
                extract_text=True,
                extract_metadata=True,
                extract_tables=False,
                extract_images=False
            )
            
            # Test processing
            if hasattr(service, 'process_document'):
                result = await service.process_document(request)
                print(f"✅ Document processing successful:")
                print(f"  - Status: {result.status}")
                print(f"  - Content length: {len(result.content.text) if result.content else 0}")
                print(f"  - Metadata: {result.metadata.filename if result.metadata else 'None'}")
                return True
            else:
                print("⚠️ process_document method not found")
                return False
                
        finally:
            # Clean up temp file
            os.unlink(tmp_path)
            
    except Exception as e:
        print(f"❌ Document processing failed: {e}")
        return False

async def main():
    """Run all tests"""
    print("🚀 Document Service Test Suite")
    print("=" * 50)
    
    tests = [
        ("Import Tests", test_imports()),
        ("Docling Availability", test_docling_availability()),
        ("Service Initialization", test_service_initialization()),
        ("Metadata Extraction", test_metadata_extraction()),
        ("Content Extraction", test_content_extraction()),
        ("Document Processing", test_document_processing())
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"\n📋 Running: {test_name}")
        print("-" * 30)
        
        try:
            if asyncio.iscoroutine(test_func):
                result = await test_func
            else:
                result = test_func
            
            if result:
                passed += 1
                print(f"✅ {test_name} PASSED")
            else:
                failed += 1
                print(f"❌ {test_name} FAILED")
                
        except Exception as e:
            failed += 1
            print(f"❌ {test_name} ERROR: {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed! Document service is working correctly.")
        return 0
    else:
        print("⚠️ Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n❌ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test runner error: {e}")
        sys.exit(1)
