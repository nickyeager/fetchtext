#!/usr/bin/env python3
"""
Test runner for text extraction effectiveness tests.
"""

import asyncio
import sys
from pathlib import Path

# Add the project root to the path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from tests.test_extraction_effectiveness import TextExtractionQualityTests, run_all_effectiveness_tests


async def main():
    """Run effectiveness tests and display results."""
    print("🧪 Document Processor - Text Extraction Effectiveness Tests")
    print("=" * 60)
    
    try:
        # Initialize the quality tester
        quality_tester = TextExtractionQualityTests()
        
        # Check if we have test documents configured
        test_docs = quality_tester.test_config.get("test_documents", [])
        if not test_docs:
            print("⚠️  No test documents found in manifest")
            print("   Creating basic test configuration...")
            
            # Create a minimal test config
            test_docs = [
                {
                    "name": "simple_text",
                    "source_file": "simple_test.txt",
                    "expected_file": "simple_test.expected.txt",
                    "document_type": "txt",
                    "min_similarity": 0.95,
                    "min_word_precision": 0.90,
                    "min_word_recall": 0.90
                },
                {
                    "name": "advanced_text",
                    "source_file": "advanced_test.txt", 
                    "expected_file": "advanced_test.expected.txt",
                    "document_type": "txt",
                    "min_similarity": 0.90,
                    "min_word_precision": 0.85,
                    "min_word_recall": 0.85
                }
            ]
        
        print(f"📋 Found {len(test_docs)} test documents to process")
        print()
        
        # Run tests for each document
        all_results = []
        passed_count = 0
        failed_count = 0
        
        for i, test_config in enumerate(test_docs, 1):
            print(f"🔍 Test {i}/{len(test_docs)}: {test_config['name']}")
            print(f"   File: {test_config['source_file']}")
            print(f"   Type: {test_config['document_type']}")
            
            try:
                result = await quality_tester.run_extraction_test(test_config)
                
                if "error" in result:
                    print(f"   ❌ ERROR: {result['error']}")
                    failed_count += 1
                    continue
                
                all_results.append(result)
                
                # Display results
                similarity = result.get('similarity_score', 0)
                precision = result.get('word_metrics', {}).get('precision', 0)
                recall = result.get('word_metrics', {}).get('recall', 0)
                f1 = result.get('word_metrics', {}).get('f1_score', 0)
                time_taken = result.get('extraction_time', 0)
                
                print(f"   📊 Similarity: {similarity:.3f}")
                print(f"   📊 Precision: {precision:.3f}")
                print(f"   📊 Recall: {recall:.3f}")
                print(f"   📊 F1 Score: {f1:.3f}")
                print(f"   ⏱️  Time: {time_taken:.3f}s")
                
                if result.get('test_passed', False):
                    print(f"   ✅ PASSED")
                    passed_count += 1
                else:
                    print(f"   ❌ FAILED")
                    for failure in result.get('failures', []):
                        print(f"      - {failure}")
                    failed_count += 1
                
            except Exception as e:
                print(f"   ❌ EXCEPTION: {str(e)}")
                failed_count += 1
            
            print()
        
        # Summary
        print("=" * 60)
        print("📈 SUMMARY")
        print(f"   Total Tests: {passed_count + failed_count}")
        print(f"   Passed: {passed_count}")
        print(f"   Failed: {failed_count}")
        
        if all_results:
            avg_similarity = sum(r.get('similarity_score', 0) for r in all_results) / len(all_results)
            avg_precision = sum(r.get('word_metrics', {}).get('precision', 0) for r in all_results) / len(all_results)
            avg_recall = sum(r.get('word_metrics', {}).get('recall', 0) for r in all_results) / len(all_results)
            avg_time = sum(r.get('extraction_time', 0) for r in all_results) / len(all_results)
            
            print(f"   Average Similarity: {avg_similarity:.3f}")
            print(f"   Average Precision: {avg_precision:.3f}")
            print(f"   Average Recall: {avg_recall:.3f}")
            print(f"   Average Time: {avg_time:.3f}s")
        
        print()
        
        # Overall result
        if failed_count == 0:
            print("🎉 All tests PASSED! Text extraction is working effectively.")
            return 0
        else:
            print(f"⚠️  {failed_count} test(s) FAILED. Review results above.")
            return 1
            
    except Exception as e:
        print(f"💥 Fatal error running tests: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
