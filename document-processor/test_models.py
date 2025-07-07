#!/usr/bin/env python3
"""
Quick test script for document models
Run with: python3 test_models.py
"""

import sys
from datetime import datetime
from pathlib import Path

# Add app to path
sys.path.append('.')

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
    print("✅ All imports successful!")
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)

def test_models():
    print("\n🧪 Testing Pydantic models...")
    
    # Test DocumentProcessingResponse
    try:
        response = DocumentProcessingResponse(
            job_id="test-123",
            status="pending",
            filename="test.pdf",
            message="Processing started"
        )
        print(f"✅ DocumentProcessingResponse: {response.job_id}")
    except Exception as e:
        print(f"❌ DocumentProcessingResponse error: {e}")
    
    # Test DocumentProcessingStatus  
    try:
        status = DocumentProcessingStatus(
            job_id="test-123",
            status="processing",
            progress=50.0,
            message="Halfway done",
            filename="test.pdf"
        )
        print(f"✅ DocumentProcessingStatus: {status.progress}%")
    except Exception as e:
        print(f"❌ DocumentProcessingStatus error: {e}")
    
    # Test BatchProcessingRequest
    try:
        batch_req = BatchProcessingRequest(
            extract_text=True,
            extract_metadata=True,
            output_format="json"
        )
        print(f"✅ BatchProcessingRequest: {batch_req.output_format}")
    except Exception as e:
        print(f"❌ BatchProcessingRequest error: {e}")
    
    # Test BatchProcessingResponse
    try:
        batch_resp = BatchProcessingResponse(
            batch_id="batch-456",
            job_ids=["job1", "job2"],
            total_files=2,
            status="processing",
            message="Batch started"
        )
        print(f"✅ BatchProcessingResponse: {len(batch_resp.job_ids)} jobs")
    except Exception as e:
        print(f"❌ BatchProcessingResponse error: {e}")

def test_validation():
    print("\n🔍 Testing validation...")
    
    # Test invalid progress (should fail)
    try:
        invalid_status = DocumentProcessingStatus(
            job_id="test",
            status="processing", 
            progress=150.0,  # Invalid: > 100
            message="test",
            filename="test.pdf"
        )
        print("❌ Validation should have failed for progress > 100")
    except Exception as e:
        print(f"✅ Validation correctly caught invalid progress: {type(e).__name__}")

if __name__ == "__main__":
    test_models()
    test_validation()
    print("\n🎉 Model testing complete!")
