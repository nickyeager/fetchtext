#!/usr/bin/env python3
"""
Comprehensive test runner for document processor effectiveness testing.

This script organizes and runs all types of tests in the correct order:
1. Unit tests
2. Integration tests
3. API tests  
4. Effectiveness tests
5. Manual verification tests
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path


class TestOrganizer:
    """Organizes and runs tests in the correct order with proper reporting."""
    
    def __init__(self, project_root):
        self.project_root = Path(project_root)
        self.tests_dir = self.project_root / "tests"
        
    def run_unit_tests(self, verbose=False):
        """Run unit tests."""
        print("\n🧪 Running Unit Tests...")
        print("=" * 50)
        
        cmd = [
            "python", "-m", "pytest", 
            str(self.tests_dir / "unit"),
            "-v" if verbose else "-q",
            "--tb=short"
        ]
        return subprocess.run(cmd, cwd=self.project_root)
    
    def run_integration_tests(self, verbose=False):
        """Run integration tests."""
        print("\n🔗 Running Integration Tests...")
        print("=" * 50)
        
        cmd = [
            "python", "-m", "pytest",
            str(self.tests_dir / "integration"), 
            "-v" if verbose else "-q",
            "--tb=short"
        ]
        return subprocess.run(cmd, cwd=self.project_root)
    
    def run_api_tests(self, verbose=False):
        """Run API tests."""
        print("\n🌐 Running API Tests...")
        print("=" * 50)
        
        cmd = [
            "python", "-m", "pytest",
            str(self.tests_dir / "test_api.py"),
            "-v" if verbose else "-q", 
            "--tb=short"
        ]
        return subprocess.run(cmd, cwd=self.project_root)
    
    def run_effectiveness_tests(self, verbose=False):
        """Run text extraction effectiveness tests."""
        print("\n📊 Running Text Extraction Effectiveness Tests...")
        print("=" * 50)
        
        cmd = [
            "python", "-m", "pytest",
            str(self.tests_dir / "test_extraction_effectiveness.py"),
            "-v" if verbose else "-q",
            "--tb=short",
            "-s"  # Don't capture output so we can see the metrics
        ]
        return subprocess.run(cmd, cwd=self.project_root)
    
    def run_comprehensive_tests(self, verbose=False):
        """Run comprehensive system tests."""
        print("\n🔍 Running Comprehensive Tests...")
        print("=" * 50)
        
        cmd = [
            "python", "-m", "pytest",
            str(self.tests_dir / "test_comprehensive.py"),
            "-v" if verbose else "-q",
            "--tb=short"
        ]
        return subprocess.run(cmd, cwd=self.project_root)
    
    def run_manual_verification(self, verbose=False):
        """Run manual verification tests."""
        print("\n🔧 Running Manual Verification Tests...")
        print("=" * 50)
        
        # These are typically run separately for debugging
        manual_dir = self.tests_dir / "manual_verification"
        if manual_dir.exists():
            print(f"Manual verification tests available in: {manual_dir}")
            print("Run individually as needed:")
            for test_file in manual_dir.glob("test_*.py"):
                print(f"  python {test_file}")
        else:
            print("No manual verification tests found.")
        
        return subprocess.CompletedProcess([], 0)  # Success placeholder
    
    def run_all_tests(self, verbose=False, include_manual=False):
        """Run all tests in the correct order."""
        print("🚀 Running Complete Test Suite for Document Processor")
        print("=" * 60)
        
        results = []
        
        # Run tests in order
        test_suites = [
            ("Unit Tests", self.run_unit_tests),
            ("Integration Tests", self.run_integration_tests), 
            ("API Tests", self.run_api_tests),
            ("Effectiveness Tests", self.run_effectiveness_tests),
            ("Comprehensive Tests", self.run_comprehensive_tests)
        ]
        
        if include_manual:
            test_suites.append(("Manual Verification", self.run_manual_verification))
        
        for suite_name, test_func in test_suites:
            try:
                result = test_func(verbose)
                results.append((suite_name, result.returncode == 0))
                
                if result.returncode != 0:
                    print(f"❌ {suite_name} failed with return code {result.returncode}")
                else:
                    print(f"✅ {suite_name} passed")
                    
            except Exception as e:
                print(f"❌ {suite_name} failed with exception: {e}")
                results.append((suite_name, False))
        
        # Print summary
        self.print_test_summary(results)
        
        # Return overall success
        return all(success for _, success in results)
    
    def print_test_summary(self, results):
        """Print a summary of test results."""
        print("\n" + "=" * 60)
        print("📋 TEST SUMMARY")
        print("=" * 60)
        
        total_suites = len(results)
        passed_suites = sum(1 for _, success in results if success)
        
        for suite_name, success in results:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{status:10} {suite_name}")
        
        print("-" * 60)
        print(f"Total: {passed_suites}/{total_suites} test suites passed")
        
        if passed_suites == total_suites:
            print("🎉 All tests passed! The document processor is working correctly.")
        else:
            print("⚠️  Some tests failed. Check the output above for details.")
    
    def check_test_structure(self):
        """Verify the test directory structure is correct."""
        print("🔍 Checking Test Directory Structure...")
        print("=" * 50)
        
        required_dirs = [
            "unit",
            "integration", 
            "fixtures/sample_documents",
            "fixtures/ground_truth"
        ]
        
        required_files = [
            "conftest.py",
            "test_api.py",
            "test_extraction_effectiveness.py",
            "unit/test_docling_converter.py",
            "unit/test_content_extraction.py",
            "unit/test_metadata_extraction.py",
            "integration/test_end_to_end_workflow.py"
        ]
        
        all_good = True
        
        # Check directories
        for dir_path in required_dirs:
            full_path = self.tests_dir / dir_path
            if full_path.exists():
                print(f"✅ Directory exists: {dir_path}")
            else:
                print(f"❌ Missing directory: {dir_path}")
                all_good = False
        
        # Check files  
        for file_path in required_files:
            full_path = self.tests_dir / file_path
            if full_path.exists():
                print(f"✅ File exists: {file_path}")
            else:
                print(f"❌ Missing file: {file_path}")
                all_good = False
        
        if all_good:
            print("🎉 Test structure is properly organized!")
        else:
            print("⚠️  Test structure has issues that should be fixed.")
        
        return all_good


def main():
    """Main entry point for the test runner."""
    parser = argparse.ArgumentParser(description="Document Processor Test Runner")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--unit", action="store_true", help="Run only unit tests")
    parser.add_argument("--integration", action="store_true", help="Run only integration tests")
    parser.add_argument("--api", action="store_true", help="Run only API tests")
    parser.add_argument("--effectiveness", action="store_true", help="Run only effectiveness tests")
    parser.add_argument("--comprehensive", action="store_true", help="Run only comprehensive tests")
    parser.add_argument("--manual", action="store_true", help="Include manual verification tests")
    parser.add_argument("--check-structure", action="store_true", help="Check test directory structure")
    parser.add_argument("--all", action="store_true", help="Run all tests (default)")
    
    args = parser.parse_args()
    
    # Find project root (directory containing this script or parent with app/ directory)
    script_dir = Path(__file__).parent
    if (script_dir / "app").exists():
        project_root = script_dir
    else:
        project_root = script_dir.parent
    
    organizer = TestOrganizer(project_root)
    
    # Check structure if requested
    if args.check_structure:
        organizer.check_test_structure()
        return
    
    # Run specific test suites if requested
    if args.unit:
        success = organizer.run_unit_tests(args.verbose).returncode == 0
    elif args.integration:
        success = organizer.run_integration_tests(args.verbose).returncode == 0
    elif args.api:
        success = organizer.run_api_tests(args.verbose).returncode == 0
    elif args.effectiveness:
        success = organizer.run_effectiveness_tests(args.verbose).returncode == 0
    elif args.comprehensive:
        success = organizer.run_comprehensive_tests(args.verbose).returncode == 0
    else:
        # Run all tests by default
        success = organizer.run_all_tests(args.verbose, args.manual)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
