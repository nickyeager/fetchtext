#!/usr/bin/env python3
"""
Test runner script for the Docling upgrade process.

This script helps run tests both locally and in the Docker container,
and provides easy commands for different test scenarios.
"""
import subprocess
import sys
import argparse
from pathlib import Path

def run_command(cmd, description, check=True, capture_output=False):
    """Run a command with proper error handling."""
    print(f"\n🔄 {description}")
    print(f"Command: {' '.join(cmd)}")
    
    try:
        if capture_output:
            result = subprocess.run(cmd, capture_output=True, text=True, check=check)
            return result
        else:
            result = subprocess.run(cmd, check=check)
            return result
    except subprocess.CalledProcessError as e:
        print(f"❌ Command failed with return code {e.returncode}")
        if capture_output:
            print(f"stdout: {e.stdout}")
            print(f"stderr: {e.stderr}")
        return None

def run_tests_local():
    """Run tests locally (where Docling may not be available)."""
    print("🧪 Running tests locally...")
    
    # Run basic pytest
    cmd = ["python", "-m", "pytest", "tests/", "-v", "--tb=short"]
    run_command(cmd, "Running all tests locally")

def run_tests_docker():
    """Run tests inside the Docker container (where Docling is available)."""
    print("🐳 Running tests in Docker container...")
    
    # First check if container is running
    check_cmd = ["docker", "ps", "--filter", "name=localai-document-processor", "--format", "{{.Names}}"]
    result = run_command(check_cmd, "Checking if container is running", capture_output=True)
    
    if not result or "localai-document-processor" not in result.stdout:
        print("❌ Container localai-document-processor is not running")
        print("💡 Start it with: docker compose up -d document-processor")
        return False
    
    # Run tests in container
    test_cmd = [
        "docker", "exec", "localai-document-processor",
        "python", "-m", "pytest", "tests/", "-v", "--tb=short"
    ]
    run_command(test_cmd, "Running tests in Docker container")
    return True

def run_specific_test(test_path, in_docker=False):
    """Run a specific test file or test case."""
    if in_docker:
        cmd = [
            "docker", "exec", "localai-document-processor",
            "python", "-m", "pytest", test_path, "-v"
        ]
        description = f"Running {test_path} in Docker"
    else:
        cmd = ["python", "-m", "pytest", test_path, "-v"]
        description = f"Running {test_path} locally"
    
    run_command(cmd, description)

def run_unit_tests(in_docker=False):
    """Run only unit tests."""
    test_path = "tests/unit/"
    run_specific_test(test_path, in_docker)

def run_integration_tests(in_docker=False):
    """Run only integration tests."""
    test_path = "tests/integration/"
    run_specific_test(test_path, in_docker)

def check_test_coverage(in_docker=False):
    """Run tests with coverage reporting."""
    if in_docker:
        cmd = [
            "docker", "exec", "localai-document-processor",
            "python", "-m", "pytest", "tests/", "--cov=app", "--cov-report=term-missing"
        ]
        description = "Running coverage tests in Docker"
    else:
        cmd = ["python", "-m", "pytest", "tests/", "--cov=app", "--cov-report=term-missing"]
        description = "Running coverage tests locally"
    
    run_command(cmd, description)

def validate_upgrade_readiness():
    """Run tests to validate upgrade readiness."""
    print("🔍 Validating upgrade readiness...")
    
    # Run comprehensive test
    cmd = ["python", "test_comprehensive.py"]
    result = run_command(cmd, "Running comprehensive test suite", check=False)
    
    # Run basic unit tests for upgrade components
    unit_tests = [
        "tests/unit/test_docling_converter.py",
        "tests/unit/test_content_extraction.py", 
        "tests/unit/test_metadata_extraction.py"
    ]
    
    for test in unit_tests:
        if Path(test).exists():
            run_specific_test(test, in_docker=True)

def main():
    parser = argparse.ArgumentParser(description="Test runner for Docling upgrade")
    parser.add_argument("command", choices=[
        "local", "docker", "unit", "integration", "coverage", "validate",
        "unit-docker", "integration-docker", "coverage-docker"
    ], help="Test command to run")
    
    parser.add_argument("--test", "-t", help="Specific test file or path to run")
    
    args = parser.parse_args()
    
    # Change to the document-processor directory
    script_dir = Path(__file__).parent
    if script_dir.name != "document-processor":
        doc_processor_dir = script_dir / "document-processor"
        if doc_processor_dir.exists():
            import os
            os.chdir(doc_processor_dir)
    
    if args.command == "local":
        if args.test:
            run_specific_test(args.test, in_docker=False)
        else:
            run_tests_local()
    
    elif args.command == "docker":
        if args.test:
            run_specific_test(args.test, in_docker=True)
        else:
            run_tests_docker()
    
    elif args.command == "unit":
        run_unit_tests(in_docker=False)
    
    elif args.command == "unit-docker":
        run_unit_tests(in_docker=True)
    
    elif args.command == "integration":
        run_integration_tests(in_docker=False)
    
    elif args.command == "integration-docker":
        run_integration_tests(in_docker=True)
    
    elif args.command == "coverage":
        check_test_coverage(in_docker=False)
    
    elif args.command == "coverage-docker":
        check_test_coverage(in_docker=True)
    
    elif args.command == "validate":
        validate_upgrade_readiness()
    
    print("\n✅ Test run completed!")

if __name__ == "__main__":
    main()
