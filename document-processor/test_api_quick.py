#!/usr/bin/env python3
"""
Quick API test runner to verify the Document Processor API
"""

import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Add app to path
sys.path.append('.')

def test_api_basics():
    """Run basic API tests"""
    print("🧪 Document Processor API Test Suite")
    print("=" * 50)
    
    try:
        from app.main import app
        client = TestClient(app)
        
        tests_passed = 0
        tests_total = 0
        
        # Test 1: Root endpoint
        tests_total += 1
        print("\n1️⃣ Testing Root Endpoint...")
        try:
            response = client.get("/")
            assert response.status_code == 200
            data = response.json()
            assert data["message"] == "Document Processor API"
            print("   ✅ Root endpoint working")
            tests_passed += 1
        except Exception as e:
            print(f"   ❌ Root endpoint failed: {e}")
        
        # Test 2: Health endpoint
        tests_total += 1
        print("\n2️⃣ Testing Health Endpoint...")
        try:
            response = client.get("/health/")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            print("   ✅ Health endpoint working")
            tests_passed += 1
        except Exception as e:
            print(f"   ❌ Health endpoint failed: {e}")
        
        # Test 3: Readiness endpoint
        tests_total += 1
        print("\n3️⃣ Testing Readiness Endpoint...")
        try:
            response = client.get("/health/ready")
            # Should return 200 or 503, both are valid
            assert response.status_code in [200, 503]
            data = response.json()
            assert "status" in data
            print(f"   ✅ Readiness endpoint working (status: {data['status']})")
            tests_passed += 1
        except Exception as e:
            print(f"   ❌ Readiness endpoint failed: {e}")
        
        # Test 4: OpenAPI docs
        tests_total += 1
        print("\n4️⃣ Testing API Documentation...")
        try:
            response = client.get("/docs")
            assert response.status_code == 200
            print("   ✅ API documentation accessible")
            tests_passed += 1
        except Exception as e:
            print(f"   ❌ API docs failed: {e}")
        
        # Test 5: File upload endpoint (without file)
        tests_total += 1
        print("\n5️⃣ Testing Upload Endpoint (error case)...")
        try:
            response = client.post("/documents/upload")
            # Should return 422 (validation error) since no file provided
            assert response.status_code == 422
            print("   ✅ Upload endpoint validation working")
            tests_passed += 1
        except Exception as e:
            print(f"   ❌ Upload endpoint failed: {e}")
        
        # Summary
        print("\n" + "=" * 50)
        print(f"📊 API Test Results: {tests_passed}/{tests_total} passed")
        print(f"Success Rate: {tests_passed/tests_total*100:.1f}%")
        
        if tests_passed == tests_total:
            print("🎉 All API tests passed!")
            return True
        else:
            print("⚠️ Some API tests failed")
            return False
            
    except Exception as e:
        print(f"💥 API test setup failed: {e}")
        return False

if __name__ == "__main__":
    success = test_api_basics()
    sys.exit(0 if success else 1)
