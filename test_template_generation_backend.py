#!/usr/bin/env python3
"""Test template generation with Azure OpenAI"""

import requests
import sys

BACKEND_URL = "http://localhost:8090"
DOCUMENT_PATH = "Stucco Contract V1.pdf"

def test_backend_health():
    """Verify backend is running"""
    response = requests.get(f"{BACKEND_URL}/health", timeout=10)
    assert response.status_code == 200
    print("✓ Backend is healthy")

def test_template_generation():
    """Test /decide-template generates templates"""
    with open(DOCUMENT_PATH, 'rb') as f:
        files = {'file': (DOCUMENT_PATH, f, 'application/pdf')}

        response = requests.post(
            f"{BACKEND_URL}/api/enhanced-documents/decide-template",
            files=files,
            params={
                'quick_scan': True,
                'min_match_confidence': 0.7,
                'allow_generation': True,
                'template_name': 'Stucco Contract Template',
                'category': 'contract'
            },
            timeout=120
        )

    assert response.status_code == 200, f"Failed: {response.status_code}"

    decision = response.json()
    print(f"✓ Action: {decision.get('action')}")

    if decision.get('action') == 'generated':
        template = decision.get('template')
        assert template is not None, "No template in response"

        # Backend may return either 'smart_variables' or 'variables' depending on implementation
        variables = template.get('smart_variables') or template.get('variables', [])
        assert len(variables) > 0, "Template has no variables"

        print(f"✓ Template generated: {template.get('name')}")
        print(f"✓ Variables: {len(variables)}")
        for var in variables[:3]:
            print(f"  - {var.get('name')}: {var.get('type')}")

        return True
    else:
        print(f"⚠️  Action was '{decision.get('action')}', not 'generated'")
        print("   This may mean a template matched or Azure OpenAI failed")
        return False

if __name__ == '__main__':
    print("Testing Template Generation Backend...")
    print("-" * 80)

    try:
        test_backend_health()
        result = test_template_generation()

        if result:
            print("\n" + "=" * 80)
            print("✓ ALL TESTS PASSED - Backend generates templates correctly")
            print("=" * 80)
            sys.exit(0)
        else:
            print("\n" + "=" * 80)
            print("⚠️  Backend did not generate template")
            print("   Check Azure OpenAI configuration")
            print("=" * 80)
            sys.exit(1)

    except Exception as e:
        print(f"\n✗ TEST FAILED: {e}")
        sys.exit(1)
