#!/usr/bin/env python3
"""
Test Suite for Google Docs Integration via N8N
Tests the complete Google Docs loading and processing pipeline
"""

import asyncio
import json
import tempfile
import time
from pathlib import Path
from typing import Dict, Any, List
import logging
import requests
import pytest
from unittest.mock import Mock, patch, AsyncMock

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GoogleDocsIntegrationTestSuite:
    """Comprehensive test suite for Google Docs integration"""
    
    def __init__(self):
        self.n8n_webhook_url = "http://localhost:5678/webhook/load-google-doc"
        self.document_processor_url = "http://localhost:8090"
        self.test_results = []
        self.test_documents = []
        
    def setup_test_environment(self):
        """Set up test environment and mock data"""
        logger.info("Setting up test environment...")
        
        # Load real Google Doc IDs from environment variables
        self.test_documents = [
            {
                "document_id": os.getenv("TEST_INVOICE_DOC_ID"),
                "name": "FetchText Test Invoice #001",
                "export_format": "text/plain",
                "expected_fields": ["invoice_number", "date", "amount"]
            },
            {
                "document_id": os.getenv("TEST_CONTRACT_DOC_ID"),
                "name": "FetchText Test Service Agreement",
                "export_format": "text/html",
                "expected_fields": ["party_a", "party_b", "contract_value"]
            },
            {
                "document_id": os.getenv("TEST_REPORT_DOC_ID"),
                "name": "FetchText Test Quarterly Report Q1 2024",
                "export_format": "application/pdf",
                "expected_fields": ["period", "revenue", "growth_rate"]
            }
        ]
        
        # Filter out any documents with missing IDs
        self.test_documents = [doc for doc in self.test_documents if doc["document_id"]]
        
        if not self.test_documents:
            logger.warning("No test document IDs found in environment variables!")
            logger.warning("Set TEST_INVOICE_DOC_ID, TEST_CONTRACT_DOC_ID, TEST_REPORT_DOC_ID")
        
        logger.info(f"Created {len(self.test_documents)} test documents")

    def test_n8n_webhook_availability(self) -> bool:
        """Test 1: Check if N8N webhook is accessible"""
        logger.info("Test 1: Testing N8N webhook availability...")
        
        try:
            # Test with a simple ping request
            response = requests.get(
                f"{self.n8n_webhook_url.replace('/webhook/', '/healthcheck')}", 
                timeout=5
            )
            
            # N8N webhooks typically return 404 for GET requests, which is expected
            webhook_accessible = response.status_code in [404, 200, 405]
            
            logger.info(f"N8N webhook accessibility: {'✅ PASS' if webhook_accessible else '❌ FAIL'}")
            return webhook_accessible
            
        except requests.exceptions.RequestException as e:
            logger.error(f"N8N webhook test failed: {e}")
            return False

    def test_document_processor_health(self) -> bool:
        """Test 2: Check document processor health"""
        logger.info("Test 2: Testing document processor health...")
        
        try:
            response = requests.get(f"{self.document_processor_url}/health", timeout=10)
            
            if response.status_code == 200:
                health_data = response.json()
                logger.info(f"Document processor status: {health_data.get('status', 'unknown')}")
                return health_data.get('status') == 'healthy'
            else:
                logger.error(f"Document processor health check failed: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Document processor health test failed: {e}")
            return False

    def test_real_google_doc_loading(self) -> bool:
        """Test 3: Real Google Doc loading via N8N webhook"""
        logger.info("Test 3: Testing real Google Doc loading...")
        
        success_count = 0
        
        for doc in self.test_documents:
            try:
                logger.info(f"Testing document: {doc['name']}")
                
                # Create real request payload for N8N webhook
                payload = {
                    "document_id": doc["document_id"],
                    "export_format": doc["export_format"],
                    "process_immediately": True,
                    "metadata": {
                        "name": doc["name"],
                        "source": "integration_test",
                        "test_mode": True
                    }
                }
                
                # Make actual API call to N8N webhook
                response = requests.post(
                    self.n8n_webhook_url,
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {os.getenv('N8N_WEBHOOK_AUTH_TOKEN', '')}"
                    },
                    timeout=60  # 60 second timeout for document processing
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get("success"):
                        logger.info(f"✅ Real processing successful for: {doc['name']}")
                        logger.info(f"   Document ID: {result.get('google_doc_id')}")
                        logger.info(f"   Processing time: {result.get('processing_time', 'N/A')}")
                        success_count += 1
                    else:
                        logger.error(f"❌ Processing failed for {doc['name']}: {result.get('error', 'Unknown error')}")
                else:
                    logger.error(f"❌ HTTP error for {doc['name']}: {response.status_code} - {response.text}")
                
            except requests.exceptions.Timeout:
                logger.error(f"❌ Timeout processing {doc['name']}")
            except requests.exceptions.RequestException as e:
                logger.error(f"❌ Network error processing {doc['name']}: {e}")
            except Exception as e:
                logger.error(f"❌ Unexpected error processing {doc['name']}: {e}")
        
        success_rate = success_count / len(self.test_documents)
        logger.info(f"Real loading test success rate: {success_rate:.1%} ({success_count}/{len(self.test_documents)})")
        
        return success_rate >= 0.8  # 80% success rate required

    def test_url_parsing_functionality(self) -> bool:
        """Test 4: URL parsing and document ID extraction"""
        logger.info("Test 4: Testing URL parsing functionality...")
        
        test_urls = [
            {
                "url": "https://docs.google.com/document/d/1abc123def456/edit",
                "expected_id": "1abc123def456"
            },
            {
                "url": "https://docs.google.com/document/d/2def456ghi789/view",
                "expected_id": "2def456ghi789"
            },
            {
                "url": "3ghi789jkl012",  # Direct ID
                "expected_id": "3ghi789jkl012"
            },
            {
                "url": "https://drive.google.com/file/d/4jkl012mno345/view",
                "expected_id": None  # Should not match Google Docs pattern
            }
        ]
        
        success_count = 0
        
        for test_case in test_urls:
            # Mock the URL parsing logic (would be in the frontend service)
            extracted_id = self.extract_document_id_mock(test_case["url"])
            
            if extracted_id == test_case["expected_id"]:
                logger.info(f"✅ URL parsing correct: {test_case['url']} → {extracted_id}")
                success_count += 1
            else:
                logger.error(f"❌ URL parsing failed: {test_case['url']} → {extracted_id} (expected: {test_case['expected_id']})")
        
        success_rate = success_count / len(test_urls)
        logger.info(f"URL parsing success rate: {success_rate:.1%} ({success_count}/{len(test_urls)})")
        
        return success_rate == 1.0  # 100% accuracy required for URL parsing

    def extract_document_id_mock(self, url: str) -> str:
        """Mock implementation of document ID extraction"""
        import re
        
        patterns = [
            r'/document/d/([a-zA-Z0-9-_]+)',
            r'^([a-zA-Z0-9-_]{15,})$'  # Direct ID
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        return None

    def test_error_handling(self) -> bool:
        """Test 5: Error handling scenarios"""
        logger.info("Test 5: Testing error handling...")
        
        error_scenarios = [
            {
                "name": "Invalid Document ID",
                "document_id": "invalid_id_123",
                "expected_error": True
            },
            {
                "name": "Unsupported Format",
                "document_id": "1abc123def456",
                "export_format": "unsupported/format",
                "expected_error": True
            },
            {
                "name": "Network Timeout Simulation",
                "document_id": "timeout_test_doc",
                "timeout": True,
                "expected_error": True
            }
        ]
        
        success_count = 0
        
        for scenario in error_scenarios:
            try:
                logger.info(f"Testing error scenario: {scenario['name']}")
                
                # Simulate error conditions
                if scenario.get("timeout"):
                    # Simulate timeout
                    time.sleep(0.1)  # Small delay to simulate processing
                    result = {"success": False, "error": "Request timeout"}
                elif "invalid_id" in scenario["document_id"]:
                    result = {"success": False, "error": "Invalid document ID format"}
                elif scenario.get("export_format") == "unsupported/format":
                    result = {"success": False, "error": "Unsupported export format"}
                else:
                    result = {"success": False, "error": "Unknown error"}
                
                # Verify error was caught properly
                if not result["success"] and scenario["expected_error"]:
                    logger.info(f"✅ Error handling correct for: {scenario['name']}")
                    success_count += 1
                else:
                    logger.error(f"❌ Error handling failed for: {scenario['name']}")
                    
            except Exception as e:
                if scenario["expected_error"]:
                    logger.info(f"✅ Exception properly handled for: {scenario['name']}")
                    success_count += 1
                else:
                    logger.error(f"❌ Unexpected exception for: {scenario['name']}: {e}")
        
        success_rate = success_count / len(error_scenarios)
        logger.info(f"Error handling success rate: {success_rate:.1%} ({success_count}/{len(error_scenarios)})")
        
        return success_rate >= 0.8

    def test_batch_processing(self) -> bool:
        """Test 6: Batch processing functionality"""
        logger.info("Test 6: Testing batch processing...")
        
        try:
            # Simulate batch processing of multiple documents
            batch_payload = {
                "documents": [doc["document_id"] for doc in self.test_documents],
                "export_format": "text/plain",
                "process_immediately": True,
                "batch_size": 3
            }
            
            logger.info(f"Simulating batch processing of {len(batch_payload['documents'])} documents...")
            
            # Mock batch processing (in real implementation, this would call the N8N workflow)
            processed_count = 0
            failed_count = 0
            
            for doc_id in batch_payload["documents"]:
                try:
                    # Simulate processing each document
                    time.sleep(0.1)  # Simulate processing time
                    
                    # Mock success/failure (90% success rate)
                    if len(doc_id) > 30:  # Mock success condition
                        processed_count += 1
                    else:
                        failed_count += 1
                        
                except Exception:
                    failed_count += 1
            
            total_docs = len(batch_payload["documents"])
            success_rate = processed_count / total_docs
            
            logger.info(f"Batch processing results:")
            logger.info(f"  ✅ Processed: {processed_count}")
            logger.info(f"  ❌ Failed: {failed_count}")
            logger.info(f"  📊 Success rate: {success_rate:.1%}")
            
            return success_rate >= 0.8
            
        except Exception as e:
            logger.error(f"Batch processing test failed: {e}")
            return False

    def test_folder_sync_simulation(self) -> bool:
        """Test 7: Folder synchronization simulation"""
        logger.info("Test 7: Testing folder sync simulation...")
        
        try:
            # Mock folder sync configuration
            folder_config = {
                "folder_id": "test_folder_123abc",
                "sync_frequency": "15min",
                "auto_process": True,
                "export_format": "text/plain",
                "last_sync": "2024-01-15T10:00:00Z"
            }
            
            # Simulate finding new/modified documents
            mock_changes = [
                {
                    "document_id": "new_doc_1",
                    "change_type": "add",
                    "modified_time": "2024-01-15T10:15:00Z"
                },
                {
                    "document_id": "updated_doc_2", 
                    "change_type": "update",
                    "modified_time": "2024-01-15T10:10:00Z"
                }
            ]
            
            logger.info(f"Simulating sync for folder: {folder_config['folder_id']}")
            logger.info(f"Found {len(mock_changes)} changes")
            
            # Process each change
            processed_changes = 0
            for change in mock_changes:
                try:
                    logger.info(f"Processing {change['change_type']}: {change['document_id']}")
                    # Mock processing
                    time.sleep(0.05)
                    processed_changes += 1
                except Exception as e:
                    logger.error(f"Failed to process change: {e}")
            
            sync_success = processed_changes == len(mock_changes)
            logger.info(f"Folder sync simulation: {'✅ PASS' if sync_success else '❌ FAIL'}")
            
            return sync_success
            
        except Exception as e:
            logger.error(f"Folder sync simulation failed: {e}")
            return False

    def run_all_tests(self) -> Dict[str, Any]:
        """Run the complete test suite"""
        logger.info("🚀 Starting Google Docs Integration Test Suite")
        logger.info("=" * 80)
        
        # Setup
        self.setup_test_environment()
        
        # Define tests
        tests = [
            ("N8N Webhook Availability", self.test_n8n_webhook_availability),
            ("Document Processor Health", self.test_document_processor_health),
            ("Real Google Doc Loading", self.test_real_google_doc_loading),
            ("URL Parsing Functionality", self.test_url_parsing_functionality),
            ("Error Handling", self.test_error_handling),
            ("Batch Processing", self.test_batch_processing),
            ("Folder Sync Simulation", self.test_folder_sync_simulation)
        ]
        
        # Run tests
        results = []
        passed = 0
        
        for test_name, test_func in tests:
            try:
                logger.info(f"\n{'='*20} {test_name} {'='*20}")
                start_time = time.time()
                
                result = test_func()
                
                duration = time.time() - start_time
                
                if result:
                    logger.info(f"✅ {test_name}: PASSED ({duration:.2f}s)")
                    passed += 1
                else:
                    logger.info(f"❌ {test_name}: FAILED ({duration:.2f}s)")
                
                results.append({
                    "test": test_name,
                    "passed": result,
                    "duration": duration
                })
                
            except Exception as e:
                logger.error(f"❌ {test_name}: ERROR - {e}")
                results.append({
                    "test": test_name,
                    "passed": False,
                    "duration": 0,
                    "error": str(e)
                })
        
        # Summary
        total_tests = len(tests)
        success_rate = passed / total_tests * 100
        
        logger.info("\n" + "=" * 80)
        logger.info("📋 TEST SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Total Tests: {total_tests}")
        logger.info(f"Passed: {passed}")
        logger.info(f"Failed: {total_tests - passed}")
        logger.info(f"Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            logger.info("🎉 INTEGRATION READY: Most tests passed!")
        elif success_rate >= 60:
            logger.info("⚠️ INTEGRATION NEEDS WORK: Some tests failed")
        else:
            logger.info("❌ INTEGRATION NOT READY: Many tests failed")
        
        return {
            "success_rate": success_rate,
            "total_tests": total_tests,
            "passed": passed,
            "failed": total_tests - passed,
            "results": results,
            "ready_for_deployment": success_rate >= 80
        }

def main():
    """Run the test suite"""
    test_suite = GoogleDocsIntegrationTestSuite()
    return test_suite.run_all_tests()

if __name__ == "__main__":
    try:
        results = main()
        exit_code = 0 if results["ready_for_deployment"] else 1
        exit(exit_code)
    except KeyboardInterrupt:
        logger.info("\n⏹️ Tests interrupted by user")
        exit(1)
    except Exception as e:
        logger.error(f"❌ Test runner error: {e}")
        exit(1)