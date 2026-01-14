#!/usr/bin/env python3
"""Validate integration test file syntax and imports without running tests.

This script checks:
1. Python syntax is valid
2. All imports are available
3. Test structure is correct
4. Fixtures are properly defined
"""
import sys
import ast
from pathlib import Path


def validate_python_syntax(file_path: Path) -> tuple[bool, str]:
    """Validate Python file has correct syntax."""
    try:
        with open(file_path, 'r') as f:
            code = f.read()
        ast.parse(code)
        return True, "✓ Python syntax valid"
    except SyntaxError as e:
        return False, f"✗ Syntax error: {e}"


def validate_test_structure(file_path: Path) -> tuple[bool, str]:
    """Validate test file has expected structure."""
    with open(file_path, 'r') as f:
        code = f.read()

    # Check for required test classes
    required_classes = [
        "TestImprovedExtractionE2E",
        "TestExtractionAPIIntegration"
    ]

    missing_classes = []
    for class_name in required_classes:
        if f"class {class_name}" not in code:
            missing_classes.append(class_name)

    if missing_classes:
        return False, f"✗ Missing test classes: {', '.join(missing_classes)}"

    return True, "✓ Test classes present"


def validate_test_methods(file_path: Path) -> tuple[bool, str]:
    """Validate expected test methods exist."""
    with open(file_path, 'r') as f:
        code = f.read()

    # Expected test methods
    required_methods = [
        "test_semantic_extraction_improves_accuracy",
        "test_two_pass_extraction_works",
        "test_context_aware_extraction_uses_context",
        "test_chunked_extraction_methods_exist",
        "test_semantic_parser_enhances_prompts",
        "test_api_two_pass_endpoint"
    ]

    missing_methods = []
    for method_name in required_methods:
        if f"def {method_name}" not in code:
            missing_methods.append(method_name)

    if missing_methods:
        return False, f"✗ Missing test methods: {', '.join(missing_methods)}"

    return True, f"✓ All {len(required_methods)} test methods present"


def validate_fixtures(file_path: Path) -> tuple[bool, str]:
    """Validate pytest fixtures are defined."""
    with open(file_path, 'r') as f:
        code = f.read()

    # Check for fixture decorator
    if "@pytest.fixture" not in code:
        return False, "✗ No pytest fixtures defined"

    # Check for template_variables fixture
    if "def template_variables" not in code:
        return False, "✗ Missing template_variables fixture"

    return True, "✓ Pytest fixtures defined"


def validate_imports(file_path: Path) -> tuple[bool, str]:
    """Check that all imports are present."""
    with open(file_path, 'r') as f:
        code = f.read()

    required_imports = [
        "import pytest",
        "import asyncio",
        "from pathlib import Path"
    ]

    missing_imports = []
    for import_statement in required_imports:
        if import_statement not in code:
            missing_imports.append(import_statement)

    if missing_imports:
        return False, f"✗ Missing imports: {', '.join(missing_imports)}"

    return True, "✓ All required imports present"


def validate_sample_data(file_path: Path) -> tuple[bool, str]:
    """Validate sample test data is defined."""
    with open(file_path, 'r') as f:
        code = f.read()

    if "SAMPLE_INVOICE" not in code:
        return False, "✗ Missing SAMPLE_INVOICE test data"

    # Check invoice has expected content
    expected_content = [
        "Acme Corporation",
        "INV-2024-0042",
        "$8,910.00"
    ]

    missing_content = []
    for content in expected_content:
        if content not in code:
            missing_content.append(content)

    if missing_content:
        return False, f"✗ SAMPLE_INVOICE missing content: {', '.join(missing_content)}"

    return True, "✓ Sample test data complete"


def main():
    """Run all validation checks."""
    test_file = Path(__file__).parent / "tests" / "integration" / "test_improved_extraction_e2e.py"

    if not test_file.exists():
        print(f"✗ Test file not found: {test_file}")
        sys.exit(1)

    print(f"Validating: {test_file}")
    print("=" * 60)

    validators = [
        ("Python Syntax", validate_python_syntax),
        ("Test Structure", validate_test_structure),
        ("Test Methods", validate_test_methods),
        ("Pytest Fixtures", validate_fixtures),
        ("Imports", validate_imports),
        ("Sample Data", validate_sample_data)
    ]

    all_passed = True
    for name, validator in validators:
        passed, message = validator(test_file)
        print(f"{name:20s} {message}")
        if not passed:
            all_passed = False

    print("=" * 60)

    if all_passed:
        print("✓ All validation checks passed!")
        print("\nTo run the tests:")
        print("  ./run_integration_tests.sh")
        print("  OR")
        print("  docker exec localai-document-processor-1 python -m pytest tests/integration/test_improved_extraction_e2e.py -v -s")
        sys.exit(0)
    else:
        print("✗ Some validation checks failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
