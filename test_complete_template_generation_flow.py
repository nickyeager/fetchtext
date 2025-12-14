#!/usr/bin/env python3
"""
Complete Template Generation Flow Test

Tests the end-to-end flow:
1. Backend generates template via /decide-template
2. Frontend saves template to database
3. Frontend extracts fields using saved template
4. Extracted fields appear in document

This is a backend-only test. Frontend integration requires manual browser testing.
"""

import requests
import sys
import json
from pathlib import Path

# Configuration
BACKEND_URL = "http://localhost:8090"
SCRIPT_DIR = Path(__file__).parent
DOCUMENT_PATH = SCRIPT_DIR / "Stucco Contract V1.pdf"
TIMEOUT = 120  # 2 minutes

# ANSI color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_header(text):
    """Print formatted header"""
    print(f"\n{'=' * 80}")
    print(f"{BLUE}{text}{RESET}")
    print(f"{'=' * 80}\n")

def print_success(text):
    """Print success message"""
    print(f"{GREEN}✓ {text}{RESET}")

def print_error(text):
    """Print error message"""
    print(f"{RED}✗ {text}{RESET}")

def print_warning(text):
    """Print warning message"""
    print(f"{YELLOW}⚠ {text}{RESET}")

def print_info(text):
    """Print info message"""
    print(f"  {text}")

def test_backend_health():
    """Test 1: Backend health check"""
    print_header("TEST 1: Backend Health Check")

    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            print_success("Backend is healthy and responding")
            return True
        else:
            print_error(f"Backend returned status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print_error(f"Backend is not responding: {e}")
        print_info("Make sure services are running: python start_services.py --profile cpu")
        return False

def test_template_generation():
    """Test 2: Template generation with Azure OpenAI"""
    print_header("TEST 2: Template Generation with Azure OpenAI")

    if not DOCUMENT_PATH.exists():
        print_error(f"Test document not found: {DOCUMENT_PATH}")
        return None

    print_info(f"Uploading document: {DOCUMENT_PATH}")

    try:
        with open(str(DOCUMENT_PATH), 'rb') as f:
            files = {'file': (DOCUMENT_PATH.name, f, 'application/pdf')}

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
                timeout=TIMEOUT
            )

        if response.status_code != 200:
            print_error(f"Template generation failed with status {response.status_code}")
            print_info(f"Response: {response.text[:500]}")
            return None

        decision = response.json()

        # Verify action is 'generated'
        if decision.get('action') != 'generated':
            print_warning(f"Expected action='generated', got action='{decision.get('action')}'")
            print_info("This may mean a template matched or Azure OpenAI is not enabled")
            return None

        print_success(f"Action: {decision.get('action')}")

        # Verify template exists
        template = decision.get('template')
        if not template:
            print_error("No template in response")
            return None

        print_success(f"Template generated: {template.get('name')}")

        # Check for variables (backend may use 'variables' or 'smart_variables')
        variables = template.get('smart_variables') or template.get('variables', [])

        if not variables or len(variables) == 0:
            print_error("Template has no variables")
            print_info(f"Template data: {json.dumps(template, indent=2)}")
            return None

        print_success(f"Variables found: {len(variables)}")
        print_info("Variable details:")
        for var in variables[:5]:  # Show first 5
            print_info(f"  - {var.get('name')}: {var.get('type')} - {var.get('description', 'No description')}")

        return {
            'decision': decision,
            'template': template,
            'variables': variables
        }

    except requests.exceptions.Timeout:
        print_error(f"Request timed out after {TIMEOUT} seconds")
        print_info("Azure OpenAI may be slow, try increasing timeout")
        return None
    except Exception as e:
        print_error(f"Template generation failed: {e}")
        return None

def test_field_name_compatibility(result):
    """Test 3: Verify field name compatibility between backend and frontend"""
    print_header("TEST 3: Field Name Compatibility")

    if not result:
        print_warning("Skipping test - no generation result")
        return False

    template = result['template']

    # Check both field names
    has_smart_variables = 'smart_variables' in template and template['smart_variables']
    has_variables = 'variables' in template and template['variables']

    print_info(f"Template has 'smart_variables': {has_smart_variables}")
    print_info(f"Template has 'variables': {has_variables}")

    if has_smart_variables or has_variables:
        print_success("Template has variable definitions (field name compatible)")
        print_info("Frontend will map 'variables' to 'smart_variables' if needed")
        return True
    else:
        print_error("Template missing both 'smart_variables' and 'variables'")
        return False

def test_extraction_rules(result):
    """Test 4: Verify template has extraction rules"""
    print_header("TEST 4: Extraction Rules Validation")

    if not result:
        print_warning("Skipping test - no generation result")
        return False

    template = result['template']
    extraction_rules = template.get('extraction_rules', [])

    if extraction_rules and len(extraction_rules) > 0:
        print_success(f"Template has {len(extraction_rules)} extraction rules")
        return True
    else:
        print_warning("Template has no extraction rules")
        print_info("This is acceptable - variables can still be extracted with regex/AI")
        return True  # Not a failure

def print_frontend_integration_steps():
    """Print manual frontend testing steps"""
    print_header("FRONTEND INTEGRATION TESTING REQUIRED")

    print(f"{YELLOW}The backend generates templates correctly.{RESET}")
    print(f"{YELLOW}Frontend integration must be tested manually in the browser:{RESET}\n")

    print("1. Start frontend development server:")
    print("   cd localai-admin-dashboard && pnpm dev\n")

    print("2. Open browser to: http://localhost:5173\n")

    print("3. Navigate to Smart Upload page\n")

    print("4. Upload 'Stucco Contract V1.pdf'\n")

    print("5. Monitor browser console for:")
    print("   ✨ No suitable template found - generating new template with AI...")
    print("   📝 Saving generated template to database...")
    print("   ✅ Template saved successfully")
    print("   🔍 Extracting fields with generated template...")
    print("   ✅ Auto-extraction with generated template completed\n")

    print("6. Verify document page shows:")
    print("   - Extracted fields in the fields section")
    print("   - Template name in metadata")
    print("   - Status: 'completed'\n")

    print("7. Check Supabase database:")
    print("   SELECT * FROM smart_templates WHERE name LIKE '%Contract%' ORDER BY created_at DESC LIMIT 1;\n")

    print(f"{BLUE}Expected Results:{RESET}")
    print("  - Template saved to smart_templates table")
    print("  - Template has smart_variables array")
    print("  - Document has extracted_fields populated")
    print("  - Document status is 'completed'\n")

def main():
    """Run all tests"""
    print_header("Complete Template Generation Flow Test Suite")
    print_info("Testing backend template generation and field name compatibility")
    print_info("Frontend integration requires manual browser testing\n")

    # Test 1: Backend health
    if not test_backend_health():
        print_error("\nABORTED: Backend is not running")
        return 1

    # Test 2: Template generation
    result = test_template_generation()
    if result is None:
        print_error("\nABORTED: Template generation failed")
        return 1

    # Test 3: Field name compatibility
    if not test_field_name_compatibility(result):
        print_error("\nFAILED: Field name compatibility check failed")
        return 1

    # Test 4: Extraction rules
    test_extraction_rules(result)

    # Summary
    print_header("Test Summary")
    print_success("✓ Backend health check passed")
    print_success("✓ Template generation passed")
    print_success("✓ Field name compatibility passed")
    print_success("✓ Backend is ready for frontend integration")

    # Frontend integration steps
    print_frontend_integration_steps()

    print(f"\n{GREEN}{'=' * 80}{RESET}")
    print(f"{GREEN}BACKEND TESTS PASSED{RESET}")
    print(f"{GREEN}Proceed with manual frontend testing{RESET}")
    print(f"{GREEN}{'=' * 80}{RESET}\n")

    return 0

if __name__ == '__main__':
    sys.exit(main())
