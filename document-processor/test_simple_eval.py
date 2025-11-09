#!/usr/bin/env python3
"""Simple test of document evaluation without template matching"""

import asyncio
import sys
import os
sys.path.insert(0, '/app')

from pathlib import Path

async def simple_evaluate(file_path: str):
    """Simple document evaluation test"""
    
    try:
        # Basic file info
        path = Path(file_path)
        if not path.exists():
            print(f"❌ File not found: {file_path}")
            return False
            
        size = path.stat().st_size
        print(f"✅ File found: {path.name} ({size} bytes)")
        
        # Read content
        with open(path, 'r') as f:
            content = f.read()
        print(f"✅ Content read: {len(content)} characters")
        
        # Simple pattern matching
        content_lower = content.lower()
        if 'invoice' in content_lower:
            doc_type = 'invoice'
            confidence = 0.8
        elif 'receipt' in content_lower:
            doc_type = 'receipt'  
            confidence = 0.7
        else:
            doc_type = 'unknown'
            confidence = 0.0
            
        print(f"✅ Document type: {doc_type} (confidence: {confidence:.1%})")
        
        # Mock template suggestion for invoice
        if doc_type == 'invoice':
            templates = [{
                'template_id': 1,
                'template_name': 'Invoice Data Extractor',
                'category': 'invoice', 
                'match_score': 0.85
            }]
            print(f"✅ Found {len(templates)} template suggestions")
        else:
            templates = []
            print("ℹ️ No template suggestions")
            
        return {
            'document_info': {
                'filename': path.name,
                'file_size': size,
                'format_supported': True
            },
            'type_evaluation': {
                'primary_type': doc_type,
                'confidence': confidence,
                'detection_method': 'simple_pattern'
            },
            'template_suggestions': templates
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python test_simple_eval.py <file_path>")
        sys.exit(1)
        
    result = asyncio.run(simple_evaluate(sys.argv[1]))
    if result:
        print("\n✅ Simple evaluation successful")
        import json
        print(json.dumps(result, indent=2))
    else:
        print("\n❌ Simple evaluation failed")
        sys.exit(1)