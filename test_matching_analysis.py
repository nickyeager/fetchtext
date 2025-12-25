#!/usr/bin/env python3
"""
Analyze why template matching scores are low for identical documents.
Tests matching WITHOUT fingerprinting to understand the scoring breakdown.
"""
import requests
import json
from pathlib import Path

BACKEND_URL = "http://localhost:8090"
DOCUMENT_PATH = "/Users/nickyeager/Code/agents/local-ai-packaged/Stucco Contract V1.pdf"

def main():
    print("=" * 80)
    print("TEMPLATE MATCHING ANALYSIS (without fingerprinting)")
    print("=" * 80)
    
    # Step 1: First upload to generate template
    print("\n[1] First upload - generating template...")
    with open(DOCUMENT_PATH, 'rb') as f:
        response = requests.post(
            f"{BACKEND_URL}/api/enhanced-documents/decide-template",
            files={'file': (Path(DOCUMENT_PATH).name, f, 'application/pdf')},
            params={
                'quick_scan': 'true',
                'allow_generation': 'true',
                'min_match_confidence': '0.7',
                'auto_save': 'false'
            },
            timeout=180
        )
    
    if response.status_code != 200:
        print(f"ERROR: {response.status_code} - {response.text[:500]}")
        return
    
    result = response.json()
    print(f"Action: {result.get('action')}")
    
    # Get the evaluation details
    evaluation = result.get('evaluation', {})
    type_eval = evaluation.get('type_evaluation', {})
    print(f"\nDocument Type Detection:")
    print(f"  Primary type: {type_eval.get('primary_type')}")
    print(f"  Confidence: {type_eval.get('confidence')}")
    print(f"  Alternative types: {type_eval.get('alternative_types', [])}")
    
    # Get template suggestions (even before saving)
    suggestions = evaluation.get('template_suggestions', [])
    print(f"\nExisting Template Suggestions ({len(suggestions)}):")
    for s in suggestions[:5]:
        print(f"  - {s.get('template_name')}: {s.get('match_score', 0):.2%}")
        print(f"    Category: {s.get('category')}")
    
    # Get generated template details
    template = result.get('template', {})
    print(f"\nGenerated Template:")
    print(f"  Name: {template.get('name')}")
    print(f"  Category: {template.get('category')}")
    variables = template.get('variables', [])
    print(f"  Variables ({len(variables)}):")
    for v in variables[:5]:
        print(f"    - {v.get('name')} ({v.get('type')})")
    
    # Get fingerprint for reference (but we'll save WITHOUT using it)
    fingerprint = result.get('source_document_fingerprint', '')
    print(f"\n  Document fingerprint: {fingerprint[:16]}..." if fingerprint else "\n  No fingerprint!")
    
    # Step 2: Save template WITHOUT fingerprint (simulate old behavior)
    print("\n[2] Saving template WITHOUT fingerprint...")
    save_response = requests.post(
        f"{BACKEND_URL}/api/enhanced-documents/save-generated-template",
        params={
            'template_data': json.dumps(template),
            'template_name': template.get('name', 'Test Template'),
            'category': template.get('category', 'Legal')
            # Intentionally NOT passing source_document_fingerprint
        },
        timeout=30
    )
    
    if save_response.status_code != 200:
        print(f"ERROR saving: {save_response.text[:500]}")
        return
    
    save_result = save_response.json()
    template_id = save_result.get('template_id')
    print(f"Saved template ID: {template_id}")
    
    # Step 3: Re-upload same document to see matching scores
    print("\n[3] Re-uploading same document to analyze matching...")
    import time
    time.sleep(2)  # Wait for cache to clear
    
    with open(DOCUMENT_PATH, 'rb') as f:
        response2 = requests.post(
            f"{BACKEND_URL}/api/enhanced-documents/decide-template",
            files={'file': (Path(DOCUMENT_PATH).name, f, 'application/pdf')},
            params={
                'quick_scan': 'true',
                'allow_generation': 'true',
                'min_match_confidence': '0.7',  # Same threshold
                'auto_save': 'false'
            },
            timeout=180
        )
    
    if response2.status_code != 200:
        print(f"ERROR: {response2.status_code}")
        return
    
    result2 = response2.json()
    print(f"\nSecond upload action: {result2.get('action')}")
    
    # Analyze decision metadata
    decision = result2.get('decision_metadata', {})
    print(f"\nDecision Details:")
    print(f"  Reason: {decision.get('reason')}")
    print(f"  Validation level: {decision.get('validation_level')}")
    print(f"  Match score: {decision.get('match_score', 0):.2%}")
    print(f"  Extraction quality: {decision.get('extraction_quality', 0):.2%}")
    
    # Get template suggestions with scores
    eval2 = result2.get('evaluation', {})
    suggestions2 = eval2.get('template_suggestions', [])
    print(f"\nTemplate Suggestions ({len(suggestions2)}):")
    for s in suggestions2[:10]:
        marker = "→" if s.get('template_id') == template_id else " "
        print(f"  {marker} ID:{s.get('template_id')} {s.get('template_name')}: {s.get('match_score', 0):.2%}")
        print(f"      Category: {s.get('category')}, Fields: {s.get('field_count')}")
        if s.get('extraction_quality'):
            print(f"      Extraction quality: {s.get('extraction_quality', 0):.2%}")
            print(f"      Combined score: {s.get('combined_score', 0):.2%}")
    
    # Check if our template was in the suggestions
    our_template = next((s for s in suggestions2 if s.get('template_id') == template_id), None)
    if our_template:
        print(f"\n*** Our saved template (ID: {template_id}) scored: {our_template.get('match_score', 0):.2%} ***")
    else:
        print(f"\n*** Our saved template (ID: {template_id}) was NOT in suggestions! ***")
    
    # Print key phrases from both uploads
    print("\n[4] Document Analysis Comparison:")
    kp1 = evaluation.get('content_analysis', {}).get('key_phrases', [])
    kp2 = eval2.get('content_analysis', {}).get('key_phrases', [])
    
    # Try to get key phrases from content_preview if not in content_analysis
    if not kp1:
        kp1 = evaluation.get('content_preview', {}).get('key_phrases', [])
    if not kp2:
        kp2 = eval2.get('content_preview', {}).get('key_phrases', [])
    
    print(f"  Key phrases (upload 1): {kp1[:10]}")
    print(f"  Key phrases (upload 2): {kp2[:10]}")
    
    print("\n" + "=" * 80)
    print("ANALYSIS COMPLETE")
    print("=" * 80)

if __name__ == '__main__':
    main()
