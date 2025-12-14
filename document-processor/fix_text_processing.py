#!/usr/bin/env python3
"""
Fix for text file processing in document processor
Adds support for .txt files which Docling doesn't handle
"""

import os
import sys

# Read the enhanced_docling_service.py file
service_file = "app/services/enhanced_docling_service.py"

print(f"Fixing text file support in {service_file}...")

# Backup original
if os.path.exists(service_file):
    with open(service_file, 'r') as f:
        content = f.read()
    
    # Check if already fixed
    if "Handle text files directly" in content:
        print("Already fixed!")
        sys.exit(0)
    
    # Find the process_document_with_ai_enhancement method
    insert_pos = content.find("# Step 1: Basic Docling processing")
    
    if insert_pos == -1:
        print("Could not find insertion point!")
        sys.exit(1)
    
    # Add text file handling before Docling processing
    text_handling = '''            # Handle text files directly (Docling doesn't support them)
            if file_path.suffix.lower() in ['.txt', '.text']:
                self.logger.info(f"Processing text file directly: {file_path.name}")
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        text_content = f.read()
                    
                    basic_result = {
                        'job_id': job_id,
                        'status': 'completed',
                        'content': {
                            'text': text_content,
                            'layout_info': {
                                'headings': [],
                                'paragraphs': [{'text': text_content, 'position': 0}]
                            }
                        },
                        'metadata': {
                            'title': file_path.stem,
                            'pages': 1,
                            'format': 'text/plain',
                            'file_size': file_path.stat().st_size
                        },
                        'structure': {
                            'sections': [],
                            'tables': [],
                            'images': []
                        },
                        'created_at': start_time.isoformat(),
                        'completed_at': datetime.utcnow().isoformat(),
                        'processing_time': 0.1
                    }
                except Exception as e:
                    self.logger.error(f"Failed to read text file: {e}")
                    return {
                        'job_id': job_id,
                        'status': 'failed',
                        'error_message': f'Failed to read text file: {str(e)}',
                        'created_at': start_time.isoformat(),
                        'completed_at': datetime.utcnow().isoformat()
                    }
            else:
                # Step 1: Basic Docling processing (original code)'''
    
    # Insert the fix
    new_content = content[:insert_pos] + text_handling + "\n" + " " * 12 + content[insert_pos:]
    
    # Fix the closing bracket
    new_content = new_content.replace(
        "# Step 1: Basic Docling processing\n            basic_result = await self.process_document(",
        "basic_result = await self.process_document("
    )
    
    # Write back
    with open(service_file, 'w') as f:
        f.write(new_content)
    
    print("Fixed text file support!")
else:
    print(f"File {service_file} not found!")
    sys.exit(1)

# Also fix the ai_template_generator.py to handle failed processing better
generator_file = "app/services/ai_template_generator.py"

print(f"Fixing error handling in {generator_file}...")

if os.path.exists(generator_file):
    with open(generator_file, 'r') as f:
        content = f.read()
    
    # Replace the strict error check
    old_check = '''        if result.get('status') != 'completed':
            raise Exception("Document processing failed")'''
    
    new_check = '''        if result.get('status') != 'completed':
            # Try to extract whatever we can
            self.logger.warning(f"Document processing had issues: {result.get('status')}")
            content = result.get('content', {}).get('text', '')
            if not content and result.get('error_message'):
                raise Exception(f"Document processing failed: {result.get('error_message')}")'''
    
    if old_check in content:
        content = content.replace(old_check, new_check)
        
        # Add logger import if missing
        if "self.logger = logging.getLogger(__name__)" not in content:
            content = content.replace(
                "def __init__(self):",
                "def __init__(self):\n        self.logger = logging.getLogger(__name__)"
            )
        
        with open(generator_file, 'w') as f:
            f.write(content)
        
        print("Fixed error handling!")
    else:
        print("Error handling already fixed or different!")

print("\nFixes applied! Restart the document processor container to apply changes.")