#!/usr/bin/env python3
"""
Template Matching E2E Test Runner

Comprehensive end-to-end testing for template matching functionality using real documents.
This script:
1. Starts required services
2. Runs template matching tests
3. Provides detailed results and analysis
4. Tests with documents from /data folder
"""

import asyncio
import sys
import os
import json
import time
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional
import aiohttp
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TemplateMatchingE2ETester:
    """Comprehensive E2E tester for template matching functionality"""
    
    def __init__(self):
        self.base_dir = Path(__file__).parent
        self.data_dir = self.base_dir / "data"
        self.services = {
            'document_processor': 'http://localhost:8090',
            'admin_dashboard': 'http://localhost:5173',
            'supabase': 'http://localhost:8000'
        }
        self.test_results = []
        
    async def check_services_health(self) -> Dict[str, bool]:
        """Check if all required services are running"""
        logger.info("🔍 Checking service health...")
        
        health_status = {}
        
        async with aiohttp.ClientSession() as session:
            # Check Document Processor
            try:
                async with session.get(f"{self.services['document_processor']}/health", timeout=5) as resp:
                    health_status['document_processor'] = resp.status == 200
            except:
                health_status['document_processor'] = False
            
            # Check Admin Dashboard
            try:
                async with session.get(self.services['admin_dashboard'], timeout=5) as resp:
                    health_status['admin_dashboard'] = resp.status == 200
            except:
                health_status['admin_dashboard'] = False
            
            # Check Supabase (optional)
            try:
                async with session.get(f"{self.services['supabase']}/health", timeout=5) as resp:
                    health_status['supabase'] = resp.status == 200
            except:
                health_status['supabase'] = False
        
        # Log results
        for service, status in health_status.items():
            logger.info(f"   {service}: {'✅' if status else '❌'}")
        
        return health_status
    
    def get_test_documents(self) -> List[Dict[str, Any]]:
        """Get list of test documents from /data folder"""
        test_docs = []
        
        if not self.data_dir.exists():
            logger.error(f"Data directory not found: {self.data_dir}")
            return []
        
        # Sample text documents
        sample_docs = [
            ('sample_invoice.txt', 'invoice', 'Professional services invoice'),
            ('sample_receipt.txt', 'receipt', 'Retail purchase receipt'),
            ('sample_contract.txt', 'contract', 'Service agreement contract'),
            ('sample_report.txt', 'report', 'Business sales report'),
            ('sample_form.txt', 'form', 'Employee information form'),
            ('sample_letter.txt', 'letter', 'Business correspondence')
        ]
        
        for filename, doc_type, description in sample_docs:
            doc_path = self.data_dir / filename
            if doc_path.exists():
                test_docs.append({
                    'filename': filename,
                    'path': doc_path,
                    'expected_type': doc_type,
                    'description': description,
                    'file_type': 'text'
                })
        
        # Real PDF documents  
        pdf_docs = [
            ('Receipt-2975-4330.pdf', 'receipt', 'Real receipt document'),
            ('Hippa_auth_form.pdf', 'form', 'HIPAA authorization form'),
        ]
        
        for filename, doc_type, description in pdf_docs:
            doc_path = self.data_dir / filename
            if doc_path.exists():
                test_docs.append({
                    'filename': filename,
                    'path': doc_path,
                    'expected_type': doc_type,
                    'description': description,
                    'file_type': 'pdf'
                })
        
        logger.info(f"📄 Found {len(test_docs)} test documents")
        return test_docs
    
    async def test_document_template_matching(self, doc_info: Dict[str, Any]) -> Dict[str, Any]:
        """Test template matching for a single document"""
        logger.info(f"\n📋 Testing: {doc_info['filename']} ({doc_info['description']})")
        
        start_time = time.time()
        
        try:
            # Read document content
            if doc_info['file_type'] == 'text':
                content = doc_info['path'].read_text(encoding='utf-8')
                mime_type = 'text/plain'
            else:
                content = doc_info['path'].read_bytes()
                mime_type = 'application/pdf'
            
            # Prepare form data
            data = aiohttp.FormData()
            data.add_field('file', content, filename=doc_info['filename'], content_type=mime_type)
            
            # Call document evaluation API
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.services['document_processor']}/api/enhanced-documents/evaluate-document-type",
                    data=data,
                    timeout=45
                ) as resp:
                    if resp.status != 200:
                        raise Exception(f"API returned {resp.status}: {await resp.text()}")
                    
                    evaluation = await resp.json()
            
            processing_time = time.time() - start_time
            
            # Analyze results
            type_eval = evaluation.get('type_evaluation', {})
            suggestions = evaluation.get('template_suggestions', [])
            recommendations = evaluation.get('processing_recommendations', {})
            
            # Log results
            logger.info(f"   🎯 Detected Type: {type_eval.get('primary_type', 'unknown')} (confidence: {type_eval.get('confidence', 0):.3f})")
            logger.info(f"   📊 Template Suggestions: {len(suggestions)}")
            logger.info(f"   🔄 Recommended Workflow: {recommendations.get('workflow', 'unknown')}")
            logger.info(f"   ⏱️  Processing Time: {processing_time:.3f}s")
            
            if suggestions:
                logger.info("   🏆 Top Template Suggestions:")
                for i, suggestion in enumerate(suggestions[:3]):
                    logger.info(f"      {i+1}. {suggestion.get('template_name', 'Unknown'): <25} "
                              f"Score: {suggestion.get('match_score', 0):.3f} "
                              f"Category: {suggestion.get('category', 'unknown')}")
            
            # Evaluate quality
            quality_score = self.evaluate_result_quality(doc_info, evaluation)
            
            return {
                'document': doc_info['filename'],
                'expected_type': doc_info['expected_type'],
                'detected_type': type_eval.get('primary_type', 'unknown'),
                'confidence': type_eval.get('confidence', 0),
                'template_count': len(suggestions),
                'best_template_score': suggestions[0].get('match_score', 0) if suggestions else 0,
                'workflow': recommendations.get('workflow', 'unknown'),
                'processing_time': processing_time,
                'quality_score': quality_score,
                'status': 'success',
                'suggestions': suggestions[:3]  # Top 3 suggestions
            }
            
        except Exception as e:
            logger.error(f"   ❌ Failed to process {doc_info['filename']}: {str(e)}")
            return {
                'document': doc_info['filename'],
                'status': 'error',
                'error': str(e),
                'processing_time': time.time() - start_time
            }
    
    def evaluate_result_quality(self, doc_info: Dict[str, Any], evaluation: Dict[str, Any]) -> float:
        """Evaluate the quality of template matching results"""
        score = 0.0
        
        type_eval = evaluation.get('type_evaluation', {})
        suggestions = evaluation.get('template_suggestions', [])
        
        # Type detection accuracy (30%)
        detected_type = type_eval.get('primary_type', 'unknown')
        confidence = type_eval.get('confidence', 0)
        
        if detected_type == doc_info['expected_type']:
            score += 0.3  # Perfect match
        elif detected_type != 'unknown' and confidence > 0.7:
            score += 0.2  # Good confidence on different type
        elif confidence > 0.5:
            score += 0.1  # Reasonable confidence
        
        # Template suggestion quality (40%)
        if suggestions:
            best_score = suggestions[0].get('match_score', 0)
            suggestion_count = len(suggestions)
            
            # Higher scores for better matches
            if best_score > 0.8:
                score += 0.3
            elif best_score > 0.6:
                score += 0.2
            elif best_score > 0.4:
                score += 0.1
            
            # Bonus for multiple relevant suggestions
            if suggestion_count > 1:
                score += min(0.1, suggestion_count * 0.02)
        
        # Workflow appropriateness (20%)
        workflow = evaluation.get('processing_recommendations', {}).get('workflow', '')
        if workflow in ['existing_template', 'template_selection', 'generate_template']:
            score += 0.1  # Valid workflow
            
            # Bonus for logical workflow choice
            if suggestions and workflow == 'existing_template':
                score += 0.1  # Good templates available and correctly recommended
            elif not suggestions and workflow == 'generate_template':
                score += 0.1  # No templates available and correctly recommended
        
        # Processing time bonus (10%)
        # Faster processing gets higher score
        processing_time = evaluation.get('processing_time', 5.0)  # Default 5s
        if processing_time < 2.0:
            score += 0.1
        elif processing_time < 5.0:
            score += 0.05
        
        return min(score, 1.0)  # Cap at 1.0
    
    def generate_results_summary(self) -> Dict[str, Any]:
        """Generate comprehensive test results summary"""
        if not self.test_results:
            return {}
        
        successful_tests = [r for r in self.test_results if r.get('status') == 'success']
        failed_tests = [r for r in self.test_results if r.get('status') == 'error']
        
        if not successful_tests:
            return {
                'total_tests': len(self.test_results),
                'successful': 0,
                'failed': len(failed_tests),
                'success_rate': 0.0
            }
        
        # Overall statistics
        avg_processing_time = sum(r.get('processing_time', 0) for r in successful_tests) / len(successful_tests)
        avg_quality_score = sum(r.get('quality_score', 0) for r in successful_tests) / len(successful_tests)
        
        # Type detection accuracy
        correct_detections = sum(1 for r in successful_tests 
                               if r.get('detected_type') == r.get('expected_type'))
        detection_accuracy = correct_detections / len(successful_tests)
        
        # Template suggestion stats
        tests_with_suggestions = [r for r in successful_tests if r.get('template_count', 0) > 0]
        avg_template_count = sum(r.get('template_count', 0) for r in successful_tests) / len(successful_tests)
        avg_best_score = sum(r.get('best_template_score', 0) for r in tests_with_suggestions) / max(len(tests_with_suggestions), 1)
        
        # Workflow distribution
        workflows = {}
        for result in successful_tests:
            workflow = result.get('workflow', 'unknown')
            workflows[workflow] = workflows.get(workflow, 0) + 1
        
        return {
            'total_tests': len(self.test_results),
            'successful': len(successful_tests),
            'failed': len(failed_tests),
            'success_rate': len(successful_tests) / len(self.test_results),
            'performance': {
                'avg_processing_time': avg_processing_time,
                'avg_quality_score': avg_quality_score,
                'detection_accuracy': detection_accuracy
            },
            'template_matching': {
                'avg_template_count': avg_template_count,
                'avg_best_score': avg_best_score,
                'tests_with_suggestions': len(tests_with_suggestions)
            },
            'workflows': workflows,
            'detailed_results': self.test_results
        }
    
    def print_results_summary(self, summary: Dict[str, Any]):
        """Print formatted results summary"""
        print("\n" + "="*60)
        print("🎉 TEMPLATE MATCHING E2E TEST RESULTS")
        print("="*60)
        
        # Overall stats
        print(f"\n📊 Overall Performance:")
        print(f"   Total Tests: {summary['total_tests']}")
        print(f"   Successful: {summary['successful']} ✅")
        print(f"   Failed: {summary['failed']} ❌")
        print(f"   Success Rate: {summary['success_rate']:.1%}")
        
        if summary['successful'] > 0:
            perf = summary['performance']
            print(f"\n⚡ Performance Metrics:")
            print(f"   Average Processing Time: {perf['avg_processing_time']:.2f}s")
            print(f"   Average Quality Score: {perf['avg_quality_score']:.3f} / 1.0")
            print(f"   Type Detection Accuracy: {perf['detection_accuracy']:.1%}")
            
            matching = summary['template_matching']
            print(f"\n🎯 Template Matching:")
            print(f"   Average Templates per Document: {matching['avg_template_count']:.1f}")
            print(f"   Average Best Match Score: {matching['avg_best_score']:.3f}")
            print(f"   Documents with Suggestions: {matching['tests_with_suggestions']}/{summary['successful']}")
            
            print(f"\n🔄 Workflow Distribution:")
            for workflow, count in summary['workflows'].items():
                print(f"   {workflow}: {count} documents")
        
        # Detailed results
        print(f"\n📋 Detailed Results:")
        for result in summary['detailed_results']:
            if result.get('status') == 'success':
                print(f"   ✅ {result['document']:25} | "
                      f"Type: {result['detected_type']:10} | "
                      f"Templates: {result['template_count']:2} | "
                      f"Quality: {result['quality_score']:.3f}")
            else:
                print(f"   ❌ {result['document']:25} | Error: {result.get('error', 'Unknown error')[:30]}")
        
        print("\n" + "="*60)
    
    async def run_all_tests(self):
        """Run complete E2E test suite"""
        logger.info("🚀 Starting Template Matching E2E Tests")
        
        # Check service health
        health_status = await self.check_services_health()
        
        if not health_status.get('document_processor'):
            logger.error("❌ Document processor is not running!")
            logger.info("To start services: python start_services.py --profile cpu")
            return
        
        # Get test documents
        test_docs = self.get_test_documents()
        if not test_docs:
            logger.error("❌ No test documents found!")
            return
        
        # Run tests for each document
        logger.info(f"\n🧪 Running tests for {len(test_docs)} documents...")
        
        for doc_info in test_docs:
            result = await self.test_document_template_matching(doc_info)
            self.test_results.append(result)
        
        # Generate and display results
        summary = self.generate_results_summary()
        self.print_results_summary(summary)
        
        # Save results to file
        results_file = self.base_dir / "template_matching_e2e_results.json"
        with open(results_file, 'w') as f:
            json.dump(summary, f, indent=2, default=str)
        
        logger.info(f"📄 Detailed results saved to: {results_file}")
        
        # Return success status
        return summary.get('success_rate', 0) > 0.5

def main():
    """Main entry point"""
    print("🔧 Template Matching E2E Test Runner")
    
    tester = TemplateMatchingE2ETester()
    
    try:
        success = asyncio.run(tester.run_all_tests())
        
        if success:
            print("\n🎉 Template Matching E2E Tests PASSED!")
            sys.exit(0)
        else:
            print("\n❌ Template Matching E2E Tests FAILED!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Test runner failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()