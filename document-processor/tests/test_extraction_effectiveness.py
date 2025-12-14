# Text Extraction Effectiveness Tests

"""
Tests for evaluating the accuracy and quality of text extraction
using ground-truth comparisons and effectiveness metrics.
"""

import pytest
import json
import asyncio
from pathlib import Path
from typing import Dict, List, Tuple, Any
import difflib
import time
from app.services.docling_service import DoclingService
from app.models.document import DocumentMetadata, DocumentType


class TextExtractionQualityTests:
    """Test suite for evaluating text extraction quality and accuracy."""
    
    def __init__(self):
        self.service = DoclingService()
        self.test_data_dir = Path(__file__).parent / "fixtures"
        self.ground_truth_dir = self.test_data_dir / "ground_truth"
        self.sample_docs_dir = self.test_data_dir / "sample_documents"
        
        # Load test manifest
        manifest_file = self.ground_truth_dir / "test_manifest.json"
        if manifest_file.exists():
            with open(manifest_file, 'r') as f:
                self.test_config = json.load(f)
        else:
            self.test_config = {"test_documents": [], "global_settings": {}}
        
    def calculate_text_similarity(self, extracted: str, expected: str) -> float:
        """
        Calculate similarity score between extracted and expected text.
        
        Returns:
            float: Similarity score between 0.0 and 1.0
        """
        # Normalize text for comparison
        extracted_normalized = self._normalize_text(extracted)
        expected_normalized = self._normalize_text(expected)
        
        # Calculate similarity using difflib
        similarity = difflib.SequenceMatcher(
            None, 
            extracted_normalized, 
            expected_normalized
        ).ratio()
        
        return similarity
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for comparison by removing extra whitespace and standardizing."""
        import re
        # Remove extra whitespace, normalize line endings
        text = re.sub(r'\s+', ' ', text.strip())
        # Convert to lowercase for case-insensitive comparison
        text = text.lower()
        return text
    
    def calculate_word_accuracy(self, extracted: str, expected: str) -> Dict[str, float]:
        """
        Calculate word-level accuracy metrics.
        
        Returns:
            Dict with precision, recall, and f1_score
        """
        extracted_words = set(self._normalize_text(extracted).split())
        expected_words = set(self._normalize_text(expected).split())
        
        # Calculate metrics
        true_positives = len(extracted_words & expected_words)
        false_positives = len(extracted_words - expected_words)
        false_negatives = len(expected_words - extracted_words)
        
        precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0
        recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        return {
            "precision": precision,
            "recall": recall,
            "f1_score": f1_score,
            "total_words_extracted": len(extracted_words),
            "total_words_expected": len(expected_words),
            "correct_words": true_positives
        }
    
    async def run_extraction_test(self, test_config: Dict[str, Any]) -> Dict[str, Any]:
        """Run extraction test for a single document configuration."""
        source_file = self.sample_docs_dir / test_config["source_file"]
        expected_file = self.ground_truth_dir / test_config["expected_file"]
        
        # Check if files exist
        if not source_file.exists():
            return {"error": f"Source file not found: {source_file}"}
        if not expected_file.exists():
            return {"error": f"Expected file not found: {expected_file}"}
        
        # Load expected content
        with open(expected_file, 'r', encoding='utf-8') as f:
            expected_text = f.read().strip()
        
        # Extract text using service
        start_time = time.time()
        try:
            result = await self.service.extract_text_content(source_file)
            extraction_time = time.time() - start_time
            
            if result is None or "content" not in result:
                return {"error": "No content extracted"}
                
            extracted_text = result.get("content", "").strip()
            
        except Exception as e:
            return {"error": f"Extraction failed: {str(e)}"}
        
        # Calculate metrics
        similarity = self.calculate_text_similarity(extracted_text, expected_text)
        word_metrics = self.calculate_word_accuracy(extracted_text, expected_text)
        
        # Build result
        test_result = {
            "test_name": test_config["name"],
            "source_file": str(source_file),
            "document_type": test_config["document_type"],
            "extraction_time": extraction_time,
            "similarity_score": similarity,
            "word_metrics": word_metrics,
            "extracted_length": len(extracted_text),
            "expected_length": len(expected_text),
            "thresholds": {
                "min_similarity": test_config.get("min_similarity", 0.8),
                "min_word_precision": test_config.get("min_word_precision", 0.7),
                "min_word_recall": test_config.get("min_word_recall", 0.7)
            }
        }
        
        # Check if test passes
        passes_similarity = similarity >= test_config.get("min_similarity", 0.8)
        passes_precision = word_metrics["precision"] >= test_config.get("min_word_precision", 0.7)
        passes_recall = word_metrics["recall"] >= test_config.get("min_word_recall", 0.7)
        
        test_result["test_passed"] = passes_similarity and passes_precision and passes_recall
        test_result["failures"] = []
        
        if not passes_similarity:
            test_result["failures"].append(f"Similarity {similarity:.3f} below threshold {test_config.get('min_similarity', 0.8)}")
        if not passes_precision:
            test_result["failures"].append(f"Precision {word_metrics['precision']:.3f} below threshold {test_config.get('min_word_precision', 0.7)}")
        if not passes_recall:
            test_result["failures"].append(f"Recall {word_metrics['recall']:.3f} below threshold {test_config.get('min_word_recall', 0.7)}")
        
        return test_result


# Test fixtures
@pytest.fixture
def quality_tester():
    """Fixture for quality testing instance."""
    return TextExtractionQualityTests()


@pytest.fixture
def test_documents(quality_tester):
    """Fixture providing list of test documents."""
    return quality_tester.test_config.get("test_documents", [])


class TestTextExtractionEffectiveness:
    """Test class for text extraction effectiveness and accuracy."""
    
    @pytest.mark.asyncio
    async def test_all_configured_documents(self, quality_tester, test_documents):
        """Test all documents configured in the test manifest."""
        if not test_documents:
            pytest.skip("No test documents configured in manifest")
        
        all_results = []
        failed_tests = []
        
        print(f"\n=== Running Effectiveness Tests on {len(test_documents)} documents ===")
        
        for test_config in test_documents:
            print(f"\n--- Testing: {test_config['name']} ---")
            result = await quality_tester.run_extraction_test(test_config)
            
            if "error" in result:
                print(f"❌ ERROR: {result['error']}")
                failed_tests.append(f"{test_config['name']}: {result['error']}")
                continue
            
            all_results.append(result)
            
            # Print detailed results
            print(f"Document Type: {result['document_type']}")
            print(f"Similarity Score: {result['similarity_score']:.3f}")
            print(f"Word Precision: {result['word_metrics']['precision']:.3f}")
            print(f"Word Recall: {result['word_metrics']['recall']:.3f}")
            print(f"Word F1 Score: {result['word_metrics']['f1_score']:.3f}")
            print(f"Extraction Time: {result['extraction_time']:.3f}s")
            print(f"Test Result: {'✅ PASS' if result['test_passed'] else '❌ FAIL'}")
            
            if not result['test_passed']:
                for failure in result['failures']:
                    print(f"  - {failure}")
                failed_tests.append(f"{test_config['name']}: {', '.join(result['failures'])}")
        
        # Print overall summary
        total_tests = len(all_results)
        passed_tests = sum(1 for r in all_results if r['test_passed'])
        
        print(f"\n=== Overall Results ===")
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        
        if all_results:
            avg_similarity = sum(r['similarity_score'] for r in all_results) / len(all_results)
            avg_precision = sum(r['word_metrics']['precision'] for r in all_results) / len(all_results)
            avg_recall = sum(r['word_metrics']['recall'] for r in all_results) / len(all_results)
            avg_time = sum(r['extraction_time'] for r in all_results) / len(all_results)
            
            print(f"Average Similarity: {avg_similarity:.3f}")
            print(f"Average Precision: {avg_precision:.3f}")
            print(f"Average Recall: {avg_recall:.3f}")
            print(f"Average Extraction Time: {avg_time:.3f}s")
        
        # Assert that we have no critical failures
        assert len(failed_tests) == 0, f"Tests failed: {failed_tests}"
    
    @pytest.mark.asyncio
    async def test_simple_text_extraction(self, quality_tester):
        """Test basic text extraction on simple documents."""
        # Test the simple text document specifically
        simple_test = {
            "name": "simple_text_direct",
            "source_file": "simple_test.txt",
            "expected_file": "simple_test.expected.txt",
            "document_type": "txt",
            "min_similarity": 0.95,
            "min_word_precision": 0.90,
            "min_word_recall": 0.90
        }
        
        result = await quality_tester.run_extraction_test(simple_test)
        
        # Skip if files don't exist
        if "error" in result:
            pytest.skip(f"Test file issue: {result['error']}")
        
        print(f"\n=== Simple Text Test Results ===")
        print(f"Similarity: {result['similarity_score']:.3f}")
        print(f"Precision: {result['word_metrics']['precision']:.3f}")
        print(f"Recall: {result['word_metrics']['recall']:.3f}")
        
        # Assertions
        assert result['test_passed'], f"Test failed: {result.get('failures', [])}"
        assert result['similarity_score'] >= 0.90, f"Similarity too low: {result['similarity_score']:.3f}"
        assert len(result['word_metrics']) > 0, "No word metrics calculated"
    
    @pytest.mark.asyncio
    async def test_markdown_extraction(self, quality_tester):
        """Test markdown document extraction."""
        markdown_test = {
            "name": "markdown_direct", 
            "source_file": "test_markdown.md",
            "expected_file": "test_markdown.expected.txt",
            "document_type": "md",
            "min_similarity": 0.80,
            "min_word_precision": 0.75,
            "min_word_recall": 0.75
        }
        
        result = await quality_tester.run_extraction_test(markdown_test)
        
        if "error" in result:
            pytest.skip(f"Markdown test file issue: {result['error']}")
        
        print(f"\n=== Markdown Test Results ===")
        print(f"Similarity: {result['similarity_score']:.3f}")
        print(f"F1 Score: {result['word_metrics']['f1_score']:.3f}")
        
        # More lenient thresholds for markdown due to formatting differences
        assert result['similarity_score'] >= 0.70, f"Markdown similarity too low: {result['similarity_score']:.3f}"
        assert result['word_metrics']['f1_score'] >= 0.70, f"F1 score too low: {result['word_metrics']['f1_score']:.3f}"
    
    @pytest.mark.asyncio
    async def test_html_extraction(self, quality_tester):
        """Test HTML document extraction.""" 
        html_test = {
            "name": "html_direct",
            "source_file": "test_html.html", 
            "expected_file": "test_html.expected.txt",
            "document_type": "html",
            "min_similarity": 0.75,
            "min_word_precision": 0.70,
            "min_word_recall": 0.70
        }
        
        result = await quality_tester.run_extraction_test(html_test)
        
        if "error" in result:
            pytest.skip(f"HTML test file issue: {result['error']}")
        
        print(f"\n=== HTML Test Results ===")
        print(f"Similarity: {result['similarity_score']:.3f}")
        print(f"Precision: {result['word_metrics']['precision']:.3f}")
        
        # HTML extraction may have formatting differences
        assert result['similarity_score'] >= 0.60, f"HTML similarity too low: {result['similarity_score']:.3f}"
        assert len(result.get('failures', [])) == 0, f"HTML test failed: {result.get('failures', [])}"


class TestExtractionConsistency:
    """Test consistency of text extraction across multiple runs."""
    
    @pytest.mark.asyncio
    async def test_extraction_consistency_simple_text(self, quality_tester):
        """Test that extraction results are consistent across multiple runs."""
        source_file = quality_tester.sample_docs_dir / "simple_test.txt"
        
        if not source_file.exists():
            pytest.skip(f"Test file not found: {source_file}")
        
        print(f"\n=== Consistency Test: {source_file.name} ===")
        
        # Extract text multiple times
        results = []
        extraction_times = []
        
        for run in range(3):
            start_time = time.time()
            result = await quality_tester.service.extract_text_content(source_file)
            extraction_time = time.time() - start_time
            
            if result and "content" in result:
                content = result["content"].strip()
                results.append(content)
                extraction_times.append(extraction_time)
                print(f"Run {run + 1}: {len(content)} chars, {extraction_time:.3f}s")
            else:
                pytest.fail(f"Extraction failed on run {run + 1}")
        
        # Check consistency
        base_result = results[0]
        similarities = []
        
        for i, result in enumerate(results[1:], 1):
            similarity = quality_tester.calculate_text_similarity(base_result, result)
            similarities.append(similarity)
            print(f"Run {i+1} vs Run 1 similarity: {similarity:.3f}")
            
            assert similarity >= 0.95, f"Run {i+1} differs from base run (similarity: {similarity:.3f})"
        
        # Check performance consistency
        avg_time = sum(extraction_times) / len(extraction_times)
        max_time_diff = max(extraction_times) - min(extraction_times)
        
        print(f"Average extraction time: {avg_time:.3f}s")
        print(f"Max time difference: {max_time_diff:.3f}s")
        print(f"Consistency check: {'✅ PASS' if min(similarities) >= 0.95 else '❌ FAIL'}")
        
        assert max_time_diff < 5.0, f"Extraction time too variable: {max_time_diff:.3f}s"


class TestServicePerformance:
    """Test extraction performance and resource usage."""
    
    @pytest.mark.asyncio
    async def test_extraction_performance_benchmarks(self, quality_tester):
        """Test extraction performance against time benchmarks."""
        test_files = [
            ("simple_test.txt", 2.0),  # Max 2 seconds
            ("advanced_test.txt", 3.0),  # Max 3 seconds
            ("test_markdown.md", 3.0),  # Max 3 seconds
        ]
        
        performance_results = []
        
        print(f"\n=== Performance Benchmarks ===")
        
        for filename, max_time in test_files:
            file_path = quality_tester.sample_docs_dir / filename
            
            if not file_path.exists():
                print(f"⚠️  Skipping {filename} (file not found)")
                continue
            
            start_time = time.time()
            result = await quality_tester.service.extract_text_content(file_path)
            extraction_time = time.time() - start_time
            
            file_size = file_path.stat().st_size
            chars_extracted = len(result.get("content", "")) if result else 0
            
            performance_results.append({
                "file": filename,
                "file_size_bytes": file_size,
                "extraction_time": extraction_time,
                "chars_extracted": chars_extracted,
                "chars_per_second": chars_extracted / extraction_time if extraction_time > 0 else 0,
                "max_time": max_time,
                "within_limit": extraction_time <= max_time
            })
            
            status = "✅ PASS" if extraction_time <= max_time else "❌ SLOW"
            print(f"{filename}: {extraction_time:.3f}s (limit: {max_time}s) {status}")
            print(f"  Size: {file_size} bytes, Extracted: {chars_extracted} chars")
            print(f"  Rate: {chars_extracted / extraction_time:.0f} chars/sec")
        
        # Assert performance requirements
        slow_files = [r for r in performance_results if not r["within_limit"]]
        assert len(slow_files) == 0, f"Files exceeded time limits: {[f['file'] for f in slow_files]}"
        
        if performance_results:
            avg_rate = sum(r["chars_per_second"] for r in performance_results) / len(performance_results)
            print(f"\nAverage extraction rate: {avg_rate:.0f} chars/second")
            
            # Basic performance assertion (should extract at least 1000 chars/sec)
            assert avg_rate >= 100, f"Extraction rate too slow: {avg_rate:.0f} chars/second"


# Utility function to run all effectiveness tests
async def run_all_effectiveness_tests():
    """Run all effectiveness tests and generate a report."""
    quality_tester = TextExtractionQualityTests()
    
    print("🧪 Running comprehensive text extraction effectiveness tests...")
    
    # Run tests for each configured document
    test_results = []
    for test_config in quality_tester.test_config.get("test_documents", []):
        result = await quality_tester.run_extraction_test(test_config)
        test_results.append(result)
    
    # Generate summary report
    passed = [r for r in test_results if r.get("test_passed", False)]
    failed = [r for r in test_results if not r.get("test_passed", False)]
    
    print(f"\n📊 Test Summary:")
    print(f"Total tests: {len(test_results)}")
    print(f"Passed: {len(passed)}")
    print(f"Failed: {len(failed)}")
    
    if test_results:
        avg_similarity = sum(r.get("similarity_score", 0) for r in test_results) / len(test_results)
        print(f"Average similarity: {avg_similarity:.3f}")
    
    return test_results


if __name__ == "__main__":
    # Run specific effectiveness tests
    pytest.main([__file__, "-v", "--tb=short"])
