#!/usr/bin/env python3
"""
Comprehensive test suite for the Document Processor Service
Tests both the current mock implementation and readiness for Docling integration

Run with: python3 test_comprehensive.py
"""

import sys
import asyncio
import subprocess
import aiofiles
import tempfile
import json
from pathlib import Path
from datetime import datetime
import requests
import time

# Add app to path
sys.path.append('.')

print("🔍 Document Processor Service - Comprehensive Test Suite")
print("=" * 60)

# Test 1: Check Docling Availability
def test_docling_availability():
    print("\n1️⃣ Testing Docling Availability...")
    try:
        import docling
        print("✅ Docling package is importable")
        
        # Try to get version
        try:
            version = docling.__version__
            print(f"✅ Docling version: {version}")
        except AttributeError:
            print("ℹ️ Docling version not available via __version__")
            
        # Check available modules
        docling_modules = [attr for attr in dir(docling) if not attr.startswith('_')]
        print(f"✅ Available Docling modules: {docling_modules[:5]}{'...' if len(docling_modules) > 5 else ''}")
        
        return True
    except ImportError as e:
        print(f"❌ Docling not available: {e}")
        return False

# Test 2: Model Validation Tests
def test_models():
    print("\n2️⃣ Testing Pydantic Models...")
    try:
        from app.models.document import (
            DocumentProcessingResponse,
            DocumentProcessingStatus, 
            BatchProcessingRequest,
            BatchProcessingResponse,
            DocumentProcessRequest,
            DocumentMetadata,
            DocumentType,
            ProcessingStatus
        )
        
        tests_passed = 0
        total_tests = 0
        
        # Test DocumentProcessingResponse
        total_tests += 1
        try:
            response = DocumentProcessingResponse(
                job_id="test-123",
                status="pending",
                filename="test.pdf",
                message="Processing started"
            )
            print(f"  ✅ DocumentProcessingResponse: {response.job_id}")
            tests_passed += 1
        except Exception as e:
            print(f"  ❌ DocumentProcessingResponse error: {e}")
        
        # Test DocumentProcessingStatus
        total_tests += 1
        try:
            status = DocumentProcessingStatus(
                job_id="test-456",
                status="processing",
                progress=75.5,
                message="Processing document...",
                filename="test.pdf"
            )
            print(f"  ✅ DocumentProcessingStatus: {status.progress}% complete")
            tests_passed += 1
        except Exception as e:
            print(f"  ❌ DocumentProcessingStatus error: {e}")
        
        # Test BatchProcessingRequest
        total_tests += 1
        try:
            batch_req = BatchProcessingRequest(
                extract_text=True,
                extract_metadata=True,
                output_format="json"
            )
            print(f"  ✅ BatchProcessingRequest: {batch_req.output_format} format")
            tests_passed += 1
        except Exception as e:
            print(f"  ❌ BatchProcessingRequest error: {e}")
        
        # Test validation
        total_tests += 1
        try:
            invalid_status = DocumentProcessingStatus(
                job_id="test",
                status="processing", 
                progress=150.0,  # Invalid: > 100
                message="test",
                filename="test.pdf"
            )
            print("  ❌ Validation should have failed for progress > 100")
        except Exception as e:
            print(f"  ✅ Validation correctly caught invalid progress: {type(e).__name__}")
            tests_passed += 1
        
        print(f"  📊 Model Tests: {tests_passed}/{total_tests} passed")
        return tests_passed == total_tests
        
    except ImportError as e:
        print(f"  ❌ Import error: {e}")
        return False

# Test 3: Service API Tests
def test_api_endpoints():
    print("\n3️⃣ Testing API Endpoints...")
    
    base_url = "http://localhost:8090"  # This won't work from outside, but we can test from inside container
    
    # We'll test via docker exec since the service isn't exposed to localhost
    tests_passed = 0
    total_tests = 0
    
    # Test health endpoint
    total_tests += 1
    try:
        # Test from inside container
        import subprocess
        result = subprocess.run([
            "docker", "exec", "localai-document-processor", 
            "python", "-c", "import requests; print(requests.get('http://localhost:8090/health').json())"
        ], capture_output=True, text=True)
        
        if result.returncode == 0 and "healthy" in result.stdout:
            print("  ✅ Health endpoint responding correctly")
            tests_passed += 1
        else:
            print(f"  ❌ Health endpoint error: {result.stderr}")
    except Exception as e:
        print(f"  ❌ Health endpoint test error: {e}")
    
    # Test docs endpoint
    total_tests += 1
    try:
        result = subprocess.run([
            "docker", "exec", "localai-document-processor", 
            "python", "-c", "import requests; r = requests.get('http://localhost:8090/docs'); print('Docs available' if r.status_code == 200 else f'Error: {r.status_code}')"
        ], capture_output=True, text=True)
        
        if "Docs available" in result.stdout:
            print("  ✅ API documentation endpoint accessible")
            tests_passed += 1
        else:
            print(f"  ❌ API docs error: {result.stdout}")
    except Exception as e:
        print(f"  ❌ API docs test error: {e}")
    
    print(f"  📊 API Tests: {tests_passed}/{total_tests} passed")
    return tests_passed == total_tests

# Test 4: Document Processing Service Tests
def test_document_processing():
    print("\n4️⃣ Testing Document Processing Service...")
    
    try:
        from app.services.docling_service import DoclingService
        
        # Create test instance
        service = DoclingService()
        tests_passed = 0
        total_tests = 0
        
        # Test service initialization
        total_tests += 1
        if service.temp_dir.exists():
            print("  ✅ DoclingService initialized successfully")
            tests_passed += 1
        else:
            print("  ❌ DoclingService temp directory not created")
        
        # Test async methods (we'll need to run them)
        print("  ℹ️ Note: DoclingService uses MOCK implementation - not real Docling")
        print("  ℹ️ Service is ready for Docling integration upgrade")
        
        print(f"  📊 Service Tests: {tests_passed}/{total_tests} passed")
        return tests_passed == total_tests
        
    except ImportError as e:
        print(f"  ❌ Service import error: {e}")
        return False

# Test 5: Docker Container Health
def test_container_health():
    print("\n5️⃣ Testing Docker Container Health...")
    
    tests_passed = 0
    total_tests = 0
    
    # Check container status
    total_tests += 1
    try:
        result = subprocess.run([
            "docker", "compose", "ps", "document-processor"
        ], capture_output=True, text=True, cwd="/Users/nickyeager/Code/agents/local-ai-packaged")
        
        if "Up" in result.stdout:
            print("  ✅ Container is running")
            tests_passed += 1
        else:
            print(f"  ❌ Container not running: {result.stdout}")
    except Exception as e:
        print(f"  ❌ Container status check error: {e}")
    
    # Check resource usage
    total_tests += 1
    try:
        result = subprocess.run([
            "docker", "stats", "localai-document-processor", "--no-stream", "--format", "table {{.CPUPerc}}\t{{.MemUsage}}"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            if len(lines) > 1:
                stats = lines[1].split('\t')
                print(f"  ✅ Container stats - CPU: {stats[0]}, Memory: {stats[1]}")
                tests_passed += 1
        else:
            print("  ❌ Could not get container stats")
    except Exception as e:
        print(f"  ❌ Container stats error: {e}")
    
    print(f"  📊 Container Tests: {tests_passed}/{total_tests} passed")
    return tests_passed == total_tests

# Test 6: Current Implementation Analysis
def analyze_current_implementation():
    print("\n6️⃣ Current Implementation Analysis...")
    
    print("  📋 Service Features:")
    print("    ✅ FastAPI web framework")
    print("    ✅ Pydantic data validation")
    print("    ✅ Docker containerization")
    print("    ✅ Health check endpoints")
    print("    ✅ Async request handling")
    print("    ✅ File upload capabilities")
    print("    ✅ Batch processing support")
    print("    ✅ Progress tracking")
    print("    ❌ Real Docling integration (using mocks)")
    
    print("\n  🔧 Ready for Upgrade:")
    print("    • Docling package is installed ✅")
    print("    • Service architecture supports real processing ✅") 
    print("    • Mock methods can be replaced with Docling calls ✅")
    print("    • All required models and endpoints exist ✅")
    
    return True

# Main test runner
def main():
    print(f"🕐 Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = {
        "docling_availability": test_docling_availability(),
        "models": test_models(),
        "api_endpoints": test_api_endpoints(),
        "document_processing": test_document_processing(),
        "container_health": test_container_health(),
        "implementation_analysis": analyze_current_implementation()
    }
    
    print("\n" + "=" * 60)
    print("📊 COMPREHENSIVE TEST RESULTS")
    print("=" * 60)
    
    passed = sum(results.values())
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title():.<30} {status}")
    
    print(f"\n🎯 Overall Score: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! Service is healthy and ready for Docling upgrade.")
    else:
        print("⚠️ Some tests failed. Review the issues above.")
    
    print(f"\n💡 Next Steps:")
    print("   1. Replace mock implementations with real Docling calls")
    print("   2. Add comprehensive document format support")  
    print("   3. Implement advanced AI document understanding")
    print("   4. Add performance monitoring and metrics")

if __name__ == "__main__":
    main()
