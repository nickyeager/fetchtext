#!/usr/bin/env python3
"""
Test script to verify Docling integration
"""

import asyncio
from pathlib import Path
from app.services.docling_service import DoclingService

async def test_docling_integration():
    print("🔍 Testing Docling Integration")
    print("=" * 40)
    
    service = DoclingService()
    print(f"Service using real Docling: {service.use_real_docling}")
    print(f"Converter available: {service.converter is not None}")
    
    # Test with markdown file
    try:
        result = await service.extract_content_from_file(Path('test_document.md'))
        print(f"Processing status: {result.get('status')}")
        print(f"Content keys: {list(result.get('content', {}).keys())}")
        
        if 'text' in result.get('content', {}):
            text = result['content']['text']
            print(f"Extracted text length: {len(text)} characters")
            print(f"Text preview: {text[:150]}...")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_docling_integration())
