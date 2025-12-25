#!/usr/bin/env python3
"""
Analyze template matching scores WITHOUT fingerprinting.
"""
import requests
import json
from pathlib import Path
import time
import subprocess
import os

BACKEND_URL = "http://localhost:8090"
DOCUMENT_PATH = "/Users/nickyeager/Code/agents/local-ai-packaged/Stucco Contract V1.pdf"

def get_service_key():
    result = subprocess.run(
        ['bash', '-c', 'source /Users/nickyeager/Code/agents/local-ai-packaged/.env 2>/dev/null && echo $SERVICE_ROLE_KEY'],
        capture_output=True, text=True
    )
    return result.stdout.strip()

def main():
    print("=" * 80)
    print("TEMPLATE MATCHING SCORE ANALYSIS (fingerprint disabled)")
    print("=" * 80)
    
    service_key = get_service_key()
    
    # Step 1: First upload to generate template
    print("\n[1] First upload - generating template...")
    with open(DOCUMENT_PATH, 'rb') as f:
        response = requests.post(
            f"{BACKEND_URL}/api/enhanced-documents/decide-template",
            files={'file': (Path(DOCUMENT_PATH).name, f, 'application/pdf')},
            params={
                'quick_scan': 'true',
                'allow_generation': 'true',
                'min_match_confidence': '0.9',  # High to force generation
                'auto_save': 'false'
            },
            timeout=180
        )
    
    result = response.json()
    action = result.get('action')
    print(f"Action: {action}")
    
    # Get evaluation details
    evaluation = result.get('evaluation', {})
    type_eval = evaluation.get('type_evaluation', {})
    print(f"\nDocument Type Detection:")
    print(f"  Primary type: {type_eval.get('primary_type')}")
    print(f"  Confidence: {type_eval.get('confidence', 0):.1%}")
    
    # Get template suggestions
    suggestions = evaluation.get('template_suggestions', [])
    print(f"\nExisting Template Scores ({len(suggestions)}):")
    for s in suggestions[:5]:
        print(f"  - {s.get('template_name')}: {s.get('match_score', 0):.1%}")
        print(f"    Category: {s.get('category')}, Fields: {s.get('field_count')}")
    
    # Get generated template
    template = result.get('template', {})
    print(f"\nGenerated Template:")
    print(f"  Name: {template.get('name')}")
    print(f"  Category: {template.get('category')}")
    variables = template.get('variables', [])
    print(f"  Variables ({len(variables)}):")
    for v in variables[:6]:
        print(f"    - {v.get('name')} ({v.get('type')})")
    
    # Step 2: Save template WITHOUT fingerprint using backend endpoint
    print("\n[2] Saving template WITHOUT fingerprint...")

    # CRITICALLY: Remove fingerprint from template data before saving
    template_for_save = template.copy()
    template_for_save.pop('source_document_fingerprint', None)
    template_for_save['variables'] = template.get('variables', [])

    save_response = requests.post(
        f"{BACKEND_URL}/api/enhanced-documents/save-generated-template",
        params={
            'template_data': json.dumps(template_for_save),
            'template_name': template.get('name', 'Contract Template') + ' (No Fingerprint Test)',
            'category': template.get('category', 'Legal'),
            'source_document_fingerprint': ''  # Explicitly empty!
        },
        timeout=60
    )

    if save_response.status_code >= 400:
        print(f"ERROR: {save_response.status_code} - {save_response.text[:500]}")
        return

    save_result = save_response.json()
    template_id = save_result.get('template_id')
    print(f"Saved template ID: {template_id}")

    # Verify there's no fingerprint by checking the saved template
    verify_resp = requests.get(
        f"http://localhost:8000/rest/v1/smart_templates?id=eq.{template_id}&select=generation_settings",
        headers={
            'apikey': service_key,
            'Authorization': f'Bearer {service_key}'
        }
    )
    if verify_resp.status_code == 200:
        saved_data = verify_resp.json()
        if saved_data:
            fp = saved_data[0].get('generation_settings', {}).get('source_document_fingerprint', 'N/A')
            print(f"Verified fingerprint in DB: '{fp}' (should be empty or N/A)")
    
    print("\n[3] Waiting 3 seconds for cache...")
    time.sleep(3)
    
    # Step 4: Re-upload same document
    print("\n[4] Re-uploading SAME document...")
    with open(DOCUMENT_PATH, 'rb') as f:
        response2 = requests.post(
            f"{BACKEND_URL}/api/enhanced-documents/decide-template",
            files={'file': (Path(DOCUMENT_PATH).name, f, 'application/pdf')},
            params={
                'quick_scan': 'true',
                'allow_generation': 'true',
                'min_match_confidence': '0.3',  # Low to see all scores
                'auto_save': 'false'
            },
            timeout=180
        )
    
    result2 = response2.json()
    action2 = result2.get('action')
    decision = result2.get('decision_metadata', {})
    
    print(f"\nSecond upload results:")
    print(f"  Action: {action2}")
    print(f"  Validation level: {decision.get('validation_level', 'score-based')}")
    
    if decision.get('validation_level') == 'fingerprint_verified':
        print("  WARNING: Fingerprint matched! The template has a fingerprint stored.")
        return
    
    # Get all template suggestions
    eval2 = result2.get('evaluation', {})
    suggestions2 = eval2.get('template_suggestions', [])
    
    print(f"\n" + "=" * 70)
    print("MATCHING SCORES FOR IDENTICAL DOCUMENT (No Fingerprint)")
    print("=" * 70)
    
    for s in suggestions2:
        is_ours = s.get('template_id') == template_id
        marker = " ★ OUR TEMPLATE" if is_ours else ""
        print(f"\n{s.get('template_name')} (ID: {s.get('template_id')}){marker}")
        print(f"  Match Score:       {s.get('match_score', 0):.1%}")
        print(f"  Category:          {s.get('category')}")
        print(f"  Fields:            {s.get('field_count')}")
        if s.get('extraction_quality') is not None:
            print(f"  Extraction Score:  {s.get('extraction_quality', 0):.1%}")
            print(f"  Combined Score:    {s.get('combined_score', 0):.1%}")
    
    # Analysis of our template
    our_template = next((s for s in suggestions2 if s.get('template_id') == template_id), None)
    
    print(f"\n" + "=" * 70)
    print("ANALYSIS: Why is the match score only ~50%?")
    print("=" * 70)
    
    if our_template:
        score = our_template.get('match_score', 0)
        print(f"\nOur template scored: {score:.1%}")
    
    print("""
The scoring algorithm uses 5 components:

┌─────────────────────────────────────────────────────────────────────┐
│ COMPONENT           │ WEIGHT │ WHAT IT MEASURES                    │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Category Match   │  40%   │ document_type vs template_category  │
│    "contract" vs "Legal" → ~80% (mapped category)                   │
│    Contribution: 40% × 0.80 = 0.32                                  │
├─────────────────────────────────────────────────────────────────────┤
│ 2. Field Detection  │  30%   │ Can template fields be found?       │
│    Searches for field indicators in document key phrases            │
│    Fields like "email", "total_project_price" need matching words   │
│    Many fields may not have matching indicators → low score         │
│    Contribution: 30% × ~0.40 = 0.12                                 │
├─────────────────────────────────────────────────────────────────────┤
│ 3. Content Similar  │  10%   │ Template description vs doc keywords│
│    Generic "AI-generated" description → low match                   │
│    Contribution: 10% × ~0.30 = 0.03                                 │
├─────────────────────────────────────────────────────────────────────┤
│ 4. Popularity       │  10%   │ How often template is used          │
│    New template has 0 uses → 0.50 (neutral)                         │
│    Contribution: 10% × 0.50 = 0.05                                  │
├─────────────────────────────────────────────────────────────────────┤
│ 5. Success Rate     │  10%   │ Historical extraction success       │
│    Default for new templates: 0.75                                  │
│    Contribution: 10% × 0.75 = 0.075                                 │
└─────────────────────────────────────────────────────────────────────┘

ESTIMATED TOTAL: 0.32 + 0.12 + 0.03 + 0.05 + 0.075 ≈ 50%

THE PROBLEM: The algorithm has no way to know this template was 
GENERATED FROM this exact document. It only looks at:
- Category mapping (imperfect)
- Field indicators (generic)
- Description matching (generic)
- Usage stats (zero for new templates)

This is why fingerprinting is essential - it provides 100% certainty
that the document matches its generated template.
""")
    
    # Cleanup
    print("\n[5] Cleaning up test template...")
    requests.delete(
        f"http://localhost:8000/rest/v1/smart_templates?id=eq.{template_id}",
        headers={'apikey': service_key, 'Authorization': f'Bearer {service_key}'}
    )
    print(f"Deleted template {template_id}")

if __name__ == '__main__':
    main()
