#!/usr/bin/env python3
"""Test document evaluation endpoint after fixing type detection"""

import asyncio
import aiohttp
import json
from pathlib import Path

async def test_document_evaluation():
    """Test the document evaluation endpoint with a real invoice file"""
    
    # API endpoint
    base_url = "http://localhost:8090"
    
    # Test file - using the invoice file from test results
    test_file = Path("test_files/test_invoice.pdf")
    
    if not test_file.exists():
        print(f"❌ Test file not found: {test_file}")
        print("Creating a simple test text file instead...")
        test_file = Path("test_invoice.txt")
        test_file.write_text("""
INVOICE

Invoice Number: INV-2024-001
Date: January 15, 2024

Bill To:
Test Company Inc.
123 Main Street
New York, NY 10001

Description: Professional Services
Amount: $1,500.00
Tax: $150.00
Total Due: $1,650.00

Payment Terms: Net 30
""")
    
    async with aiohttp.ClientSession() as session:
        # Test 1: Quick evaluation endpoint
        print("\n📋 Testing Quick Document Evaluation...")
        
        with open(test_file, 'rb') as f:
            data = aiohttp.FormData()
            data.add_field('file', f, filename=test_file.name, content_type='application/pdf')
            
            async with session.post(f"{base_url}/api/enhanced-documents/evaluate-document-type", data=data) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    print(f"✅ Quick evaluation successful!")
                    print(f"   Document Type: {result.get('type_evaluation', {}).get('primary_type')} "
                          f"(confidence: {result.get('type_evaluation', {}).get('confidence', 0):.2f})")
                    print(f"   Detection Method: {result.get('type_evaluation', {}).get('detection_method')}")
                    
                    # Check template suggestions
                    suggestions = result.get('template_suggestions', [])
                    if suggestions:
                        print(f"\n📑 Template Suggestions ({len(suggestions)} found):")
                        for i, template in enumerate(suggestions[:3]):
                            print(f"   {i+1}. {template.get('template_name')} "
                                  f"(score: {template.get('match_score', 0):.2f}, "
                                  f"category: {template.get('category')})")
                    else:
                        print("   ⚠️  No template suggestions returned")
                        
                    # Show processing recommendations
                    recommendations = result.get('processing_recommendations', {})
                    print(f"\n🔧 Processing Recommendations:")
                    print(f"   Workflow: {recommendations.get('workflow')}")
                    print(f"   Action: {recommendations.get('suggested_action')}")
                    
                    return result
                else:
                    error_text = await resp.text()
                    print(f"❌ Evaluation failed: {resp.status}")
                    print(f"   Error: {error_text}")
                    return None

async def test_supabase_connection():
    """Test if we can connect to Supabase directly"""
    
    print("\n\n🔗 Testing Supabase Connection...")
    
    import os
    supabase_url = os.getenv('SUPABASE_URL', 'http://localhost:8000')
    supabase_key = os.getenv('ANON_KEY', '')
    
    print(f"   URL: {supabase_url}")
    print(f"   Key present: {bool(supabase_key)}")
    
    if not supabase_key:
        print("   ❌ No ANON_KEY environment variable found")
        return
    
    async with aiohttp.ClientSession() as session:
        headers = {
            'apikey': supabase_key,
            'Authorization': f'Bearer {supabase_key}',
            'Content-Type': 'application/json'
        }
        
        try:
            # Test basic connection to smart_templates table
            url = f"{supabase_url}/rest/v1/smart_templates?select=id,name,category&limit=5"
            async with session.get(url, headers=headers, timeout=5) as resp:
                if resp.status == 200:
                    templates = await resp.json()
                    print(f"   ✅ Successfully connected to Supabase")
                    print(f"   📑 Found {len(templates)} templates in database")
                    for template in templates[:3]:
                        print(f"      - {template.get('name')} ({template.get('category')})")
                else:
                    print(f"   ❌ Connection failed: {resp.status}")
                    error_text = await resp.text()
                    print(f"   Error: {error_text}")
        except Exception as e:
            print(f"   ❌ Connection error: {str(e)}")

async def main():
    """Run all tests"""
    print("🚀 Testing Document Evaluation After Fixes\n")
    
    # Test document evaluation
    eval_result = await test_document_evaluation()
    
    # Test Supabase connection
    await test_supabase_connection()
    
    # Summary
    print("\n\n📊 Test Summary:")
    if eval_result:
        doc_type = eval_result.get('type_evaluation', {}).get('primary_type')
        if doc_type != 'unknown':
            print("✅ Document classification is working (not returning 'unknown')")
        else:
            print("❌ Document classification still returning 'unknown'")
            
        if eval_result.get('template_suggestions'):
            print("✅ Template suggestions are being returned")
        else:
            print("❌ No template suggestions returned")
    else:
        print("❌ Document evaluation endpoint failed")

if __name__ == "__main__":
    asyncio.run(main())