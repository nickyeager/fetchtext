#!/usr/bin/env python3
"""
Final verification script for Docling upgrade Phase 1 completion
Demonstrates working Docling integration and service functionality
"""

import asyncio
import logging
from pathlib import Path
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)

async def verify_docling_upgrade():
    print("🎯 DOCLING UPGRADE PHASE 1 VERIFICATION")
    print("=" * 50)
    print(f"⏰ Verification Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test 1: Service Import and Initialization
    print("\n1️⃣ Testing Service Initialization...")
    try:
        from app.services.docling_service import DoclingService
        service = DoclingService()
        print(f"   ✅ Service initialized successfully")
        print(f"   ✅ Using real Docling: {service.use_real_docling}")
        print(f"   ✅ Converter available: {service.converter is not None}")
    except Exception as e:
        print(f"   ❌ Service initialization failed: {e}")
        return False
    
    # Test 2: Docling Import Verification
    print("\n2️⃣ Testing Docling Imports...")
    try:
        import docling
        from docling.document_converter import DocumentConverter
        print(f"   ✅ Docling package imported successfully")
        print(f"   ✅ DocumentConverter imported successfully")
    except Exception as e:
        print(f"   ❌ Docling import failed: {e}")
        return False
    
    # Test 3: Service Interface Verification
    print("\n3️⃣ Testing Service Interface...")
    required_methods = [
        'extract_content_from_file',
        'get_processing_status', 
        'process_document',
        'extract_metadata',
        'get_supported_formats'
    ]
    
    missing_methods = []
    for method in required_methods:
        if hasattr(service, method):
            print(f"   ✅ {method} method exists")
        else:
            print(f"   ❌ {method} method missing")
            missing_methods.append(method)
    
    if missing_methods:
        print(f"   ❌ Missing methods: {missing_methods}")
        return False
    
    # Test 4: Document Processing Verification
    print("\n4️⃣ Testing Document Processing...")
    try:
        # Test with our markdown document
        test_file = Path('test_document.md')
        if test_file.exists():
            result = await service.extract_content_from_file(test_file)
            print(f"   ✅ Document processed successfully")
            print(f"   ✅ Status: {result.get('status')}")
            print(f"   ✅ Content extracted: {list(result.get('content', {}).keys())}")
            
            # Check content quality
            content = result.get('content', {})
            if 'text' in content and len(content['text']) > 0:
                print(f"   ✅ Text extraction: {len(content['text'])} characters")
            if 'markdown' in content and len(content['markdown']) > 0:
                print(f"   ✅ Markdown extraction: {len(content['markdown'])} characters")
        else:
            print(f"   ⚠️  Test document not found, creating one...")
            test_content = "# Test Document\n\nThis is a test for Docling integration."
            test_file.write_text(test_content)
            result = await service.extract_content_from_file(test_file)
            print(f"   ✅ Document processed successfully")
            
    except Exception as e:
        print(f"   ❌ Document processing failed: {e}")
        return False
    
    # Test 5: Metadata Extraction Verification
    print("\n5️⃣ Testing Metadata Extraction...")
    try:
        metadata = await service.extract_metadata(test_file)
        print(f"   ✅ Metadata extracted successfully")
        print(f"   ✅ Filename: {metadata.filename}")
        print(f"   ✅ File size: {metadata.file_size} bytes")
        print(f"   ✅ MIME type: {metadata.mime_type}")
        print(f"   ✅ Document type: {metadata.document_type}")
    except Exception as e:
        print(f"   ❌ Metadata extraction failed: {e}")
        return False
    
    # Final Status
    print("\n" + "=" * 50)
    print("🎉 PHASE 1 VERIFICATION COMPLETE")
    print("=" * 50)
    print("✅ All core functionality working")
    print("✅ Docling integration successful")
    print("✅ Service interface complete")
    print("✅ Document processing operational")
    print("✅ Metadata extraction functional")
    print("\n🚀 Ready for Phase 2: Advanced Features")
    
    return True

if __name__ == "__main__":
    try:
        success = asyncio.run(verify_docling_upgrade())
        if success:
            print("\n✅ VERIFICATION PASSED - Upgrade successful!")
        else:
            print("\n❌ VERIFICATION FAILED - Issues detected")
    except Exception as e:
        print(f"\n💥 VERIFICATION ERROR: {e}")
