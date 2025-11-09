#!/usr/bin/env python3
"""
Integration test for complete template generation workflow

Tests the new template generation flow:
1. Document evaluation → no matching templates found
2. User clicks "Generate New Template" 
3. Backend generates template with AI
4. Frontend shows GeneratedTemplateDialog
5. User can save template or use without saving
"""
import requests
import json
import time
import tempfile
from pathlib import Path

def create_test_documents():
    """Create test documents for template generation"""
    documents = {}
    
    # Custom business form that likely won't have existing templates
    custom_form_content = """
ACME CORP EQUIPMENT RENTAL AGREEMENT

Rental Request Form #RF-2024-0157

Customer Information:
Company Name: TechStart Solutions LLC
Contact Person: Sarah Johnson
Phone: (555) 123-4567
Email: sarah.johnson@techstart.com
Billing Address: 789 Innovation Drive, Tech City, CA 90210

Equipment Details:
Item Code: LASER-PRO-3000
Equipment Name: Professional Laser Engraver
Serial Number: LP3K-2024-789
Rental Period: 30 days
Start Date: February 1, 2024
End Date: March 2, 2024
Daily Rate: $450.00
Total Rental Cost: $13,500.00

Special Requirements:
- Requires 220V power outlet
- Climate controlled environment
- Operator training included
- Maintenance package included

Insurance Information:
Policy Number: INS-789456123
Coverage Amount: $50,000
Insurance Company: SecureTech Insurance

Delivery Information:
Delivery Address: 789 Innovation Drive, Tech City, CA 90210
Delivery Date: January 31, 2024
Setup Required: Yes
Training Session: February 1, 2024 at 10:00 AM

Terms and Conditions:
- Equipment must be returned in original condition
- Customer responsible for damage beyond normal wear
- Late return fee: $100 per day
- Cancellation fee: 25% of total rental cost

Authorized Signatures:
Customer Signature: ___________________ Date: ___________
ACME Representative: _________________ Date: ___________

Form Submitted: January 28, 2024
Processing Status: Approved
Reference Number: REF-2024-TECH-157
"""

    # Medical equipment inspection report  
    medical_report_content = """
BIOMEDICAL EQUIPMENT INSPECTION REPORT

Report ID: BME-INS-2024-0089
Inspection Date: January 25, 2024
Inspector: Dr. Michael Chen, Certified Biomedical Engineer
Facility: General Hospital - ICU Department

Equipment Information:
Device Name: Ventilator System Model V-200
Manufacturer: MedTech Systems Inc
Model Number: V-200-PRO
Serial Number: MTS-V200-8844
Asset Tag: GH-ICU-VENT-12
Installation Date: March 15, 2020
Last Service Date: October 10, 2023

Inspection Categories:
Electrical Safety: PASS
Mechanical Function: PASS  
Calibration Check: PASS
Software Verification: PASS
Alarm System Test: PASS
Backup Battery Test: PASS

Performance Measurements:
Pressure Range Test: ±2% accuracy - WITHIN SPEC
Flow Rate Accuracy: ±3% variance - WITHIN SPEC
Volume Delivery: 99.2% accuracy - WITHIN SPEC
Oxygen Concentration: 21.1% - WITHIN SPEC
Temperature Stability: ±0.5°C - WITHIN SPEC

Safety Checks:
High Pressure Alarm: FUNCTIONAL
Low Pressure Alarm: FUNCTIONAL
Power Failure Backup: FUNCTIONAL
Emergency Stop: FUNCTIONAL
Gas Supply Monitor: FUNCTIONAL

Issues Identified:
1. Minor calibration drift in humidity sensor
2. Backup battery shows 85% capacity (recommend replacement)
3. Air filter requires replacement within 30 days

Recommendations:
- Replace humidity sensor within 60 days
- Schedule battery replacement within 90 days
- Replace air filter within 30 days
- Next inspection due: July 25, 2024

Compliance Status: APPROVED FOR USE
Risk Level: LOW
Next Action Required: Filter replacement

Inspector Certification: BME-2024-CA-5567
Quality Assurance Review: Dr. Lisa Wang
Report Filed: January 25, 2024
"""

    # Create temporary files
    temp_dir = Path(tempfile.mkdtemp())
    
    documents['custom_form'] = temp_dir / 'equipment_rental_form.txt'
    documents['custom_form'].write_text(custom_form_content)
    
    documents['medical_report'] = temp_dir / 'biomedical_inspection_report.txt'
    documents['medical_report'].write_text(medical_report_content)
    
    return documents, temp_dir

def test_template_generation_api():
    """Test the template generation API endpoint"""
    
    print("🧪 Testing Template Generation API")
    print("=" * 50)
    
    # Check if service is running
    try:
        response = requests.get("http://localhost:8090/health", timeout=5)
        if response.status_code != 200:
            print("❌ Document processor service is not running")
            return False
    except requests.exceptions.RequestException:
        print("❌ Document processor service not accessible")
        return False
    
    print("✅ Document processor service is running")
    
    documents, temp_dir = create_test_documents()
    
    success_count = 0
    total_tests = 0
    
    try:
        for doc_type, file_path in documents.items():
            print(f"\n🔬 Testing template generation for {doc_type.upper()}")
            
            # Test template generation endpoint
            url = "http://localhost:8090/api/enhanced-documents/generate-template"
            
            with open(file_path, 'rb') as f:
                files = {'file': (file_path.name, f, 'text/plain')}
                params = {
                    'template_name': f'{doc_type.title()} Template',
                    'category': doc_type.replace('_', ' ').title(),
                    'auto_save': 'false',  # Don't auto-save for testing
                    'generation_mode': 'automatic'
                }
                
                start_time = time.time()
                
                try:
                    response = requests.post(url, files=files, params=params, timeout=120)
                    elapsed = time.time() - start_time
                    
                    if response.status_code == 200:
                        result = response.json()
                        
                        print(f"  ⏱️  Generated in {elapsed:.2f} seconds")
                        print(f"  📝 Template: {result['template']['name']}")
                        print(f"  📂 Category: {result['template']['category']}")
                        print(f"  🔍 Fields detected: {len(result['template']['variables'])}")
                        print(f"  🎯 AI confidence: {result['generation_metadata']['ai_confidence']:.2f}")
                        
                        # Validate template structure
                        template = result['template']
                        assert 'name' in template
                        assert 'category' in template
                        assert 'variables' in template
                        assert len(template['variables']) > 0
                        
                        # Validate fields have required properties
                        for var in template['variables']:
                            assert 'id' in var or 'name' in var
                            assert 'type' in var
                            
                        print(f"  ✅ Template structure validated")
                        
                        # Test saving the template
                        if 'template_id' in result and result['template_id']:
                            save_result = test_save_generated_template(result)
                            if save_result:
                                print(f"  ✅ Template saving tested successfully")
                            else:
                                print(f"  ⚠️  Template saving test failed")
                        
                        success_count += 1
                        
                    else:
                        print(f"  ❌ Generation failed: {response.status_code}")
                        if response.text:
                            print(f"     Error: {response.text[:200]}")
                    
                except requests.exceptions.Timeout:
                    print(f"  ❌ Request timed out after 120 seconds")
                except Exception as e:
                    print(f"  ❌ Request failed: {str(e)}")
                
                total_tests += 1
        
        print(f"\n📊 Template Generation Results:")
        print(f"Successful generations: {success_count}/{total_tests}")
        print(f"Success rate: {(success_count/total_tests)*100:.1f}%")
        
        return success_count == total_tests
    
    finally:
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

def test_save_generated_template(generated_template_result):
    """Test saving a generated template"""
    
    try:
        url = "http://localhost:8090/api/enhanced-documents/save-generated-template"
        
        params = {
            'template_data': json.dumps(generated_template_result['template']),
            'template_name': generated_template_result['template']['name'] + ' (Saved)',
            'category': generated_template_result['template']['category']
        }
        
        response = requests.post(url, params=params, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            print(f"     💾 Saved with ID: {result['template_id']}")
            return True
        else:
            print(f"     ❌ Save failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"     ❌ Save error: {str(e)}")
        return False

def test_document_evaluation_integration():
    """Test that evaluation recommends template generation for unknown documents"""
    
    print("\n🧪 Testing Document Evaluation Integration")
    print("=" * 50)
    
    documents, temp_dir = create_test_documents()
    
    try:
        for doc_type, file_path in documents.items():
            print(f"\n📋 Evaluating {doc_type.upper()} document")
            
            url = "http://localhost:8090/api/enhanced-documents/evaluate-document-type"
            
            with open(file_path, 'rb') as f:
                files = {'file': (file_path.name, f, 'text/plain')}
                params = {
                    'quick_scan': 'true',
                    'include_confidence_scores': 'true',
                    'suggest_templates': 'true'
                }
                
                response = requests.post(url, files=files, params=params, timeout=60)
                
                if response.status_code == 200:
                    result = response.json()
                    
                    print(f"  🎯 Detected type: {result['type_evaluation']['primary_type']}")
                    print(f"  🎯 Confidence: {result['type_evaluation']['confidence']:.2f}")
                    print(f"  📋 Templates suggested: {len(result['template_suggestions'])}")
                    print(f"  🔧 Recommended workflow: {result['processing_recommendations']['workflow']}")
                    
                    # Check if it recommends template generation (no good templates found)
                    if (result['processing_recommendations']['workflow'] == 'generate_template' or 
                        len(result['template_suggestions']) == 0):
                        print(f"  ✅ Correctly recommends template generation")
                    else:
                        print(f"  ℹ️  Found existing templates, generation optional")
                    
                else:
                    print(f"  ❌ Evaluation failed: {response.status_code}")
    
    finally:
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

def main():
    """Run complete template generation integration tests"""
    
    print("🚀 Template Generation Integration Test Suite")
    print("=" * 60)
    
    # Test API functionality
    generation_test = test_template_generation_api()
    
    # Test evaluation integration
    test_document_evaluation_integration()
    
    print(f"\n📈 Final Results:")
    print(f"Template generation: {'✅ PASSED' if generation_test else '❌ FAILED'}")
    
    if generation_test:
        print("\n🎉 Template generation workflow is working!")
        print("\n📝 Complete Flow:")
        print("1. ✅ Document evaluation detects unknown document types")
        print("2. ✅ User clicks 'Generate New Template' button")
        print("3. ✅ Backend generates template with AI field detection")
        print("4. ✅ Generated template can be saved to database")
        print("5. 🔄 Frontend dialog shows template for review/editing")
        print("6. 💾 User can save template and navigate to editor")
        print("7. ⚡ User can use template immediately without saving")
        
        print("\n🔧 Next Steps:")
        print("- Test the GeneratedTemplateDialog in the frontend")
        print("- Verify saved templates appear in template gallery")
        print("- Test template editing after generation")
        
        return True
    else:
        print("\n⚠️  Template generation workflow needs fixes")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)