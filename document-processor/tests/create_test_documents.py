#!/usr/bin/env python3
"""
Script to generate test documents in different formats for testing text extraction.
"""

import os
from pathlib import Path
from typing import Dict, Any

def create_test_documents():
    """Create test documents in various formats for extraction testing."""
    
    base_dir = Path(__file__).parent
    sample_docs_dir = base_dir / "fixtures" / "sample_documents"
    ground_truth_dir = base_dir / "fixtures" / "ground_truth"
    
    # Ensure directories exist
    sample_docs_dir.mkdir(parents=True, exist_ok=True)
    ground_truth_dir.mkdir(parents=True, exist_ok=True)
    
    print("Creating test documents...")
    
    # Create markdown test document
    create_markdown_document(sample_docs_dir)
    
    # Create HTML test document  
    create_html_document(sample_docs_dir)
    
    # Create a simple CSV-like content for table testing
    create_table_document(sample_docs_dir)
    
    print("✅ Test documents created successfully!")
    print(f"Sample documents: {sample_docs_dir}")
    print(f"Ground truth files: {ground_truth_dir}")

def create_markdown_document(output_dir: Path):
    """Create a markdown test document."""
    content = """# Test Document in Markdown

## Introduction
This is a **markdown** document for testing text extraction capabilities.

## Features Tested
- *Italic text* formatting
- **Bold text** formatting  
- `Code snippets` and technical terms
- [Links](https://example.com) and URLs

## Lists and Structure

### Ordered List
1. First item in ordered list
2. Second item with **bold** text
3. Third item with *italic* text

### Unordered List
- Bullet point one
- Bullet point two with `code`
- Bullet point three

## Code Block
```python
def hello_world():
    print("Hello, World!")
    return True
```

## Tables
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Row 1    | Data A   | 123      |
| Row 2    | Data B   | 456      |
| Row 3    | Data C   | 789      |

## Conclusion
This markdown document tests various formatting elements that should be preserved during text extraction.
"""
    
    # Write markdown file
    md_file = output_dir / "test_markdown.md"
    with open(md_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    # Create expected text output (simplified, without markdown formatting)
    expected_content = """Test Document in Markdown

Introduction
This is a markdown document for testing text extraction capabilities.

Features Tested
- Italic text formatting
- Bold text formatting
- Code snippets and technical terms
- Links and URLs

Lists and Structure

Ordered List
1. First item in ordered list
2. Second item with bold text
3. Third item with italic text

Unordered List
- Bullet point one
- Bullet point two with code
- Bullet point three

Code Block
def hello_world():
    print("Hello, World!")
    return True

Tables
| Column 1 | Column 2 | Column 3 |
| Row 1    | Data A   | 123      |
| Row 2    | Data B   | 456      |
| Row 3    | Data C   | 789      |

Conclusion
This markdown document tests various formatting elements that should be preserved during text extraction."""
    
    expected_file = output_dir.parent / "ground_truth" / "test_markdown.expected.txt"
    with open(expected_file, 'w', encoding='utf-8') as f:
        f.write(expected_content)
    
    print(f"✅ Created: {md_file}")
    print(f"✅ Created: {expected_file}")

def create_html_document(output_dir: Path):
    """Create an HTML test document."""
    content = """<!DOCTYPE html>
<html>
<head>
    <title>HTML Test Document</title>
</head>
<body>
    <h1>HTML Test Document</h1>
    
    <h2>Introduction</h2>
    <p>This is an <strong>HTML</strong> document for testing text extraction from web content.</p>
    
    <h2>Text Formatting</h2>
    <p>Testing various HTML formatting:</p>
    <ul>
        <li><strong>Bold text</strong></li>
        <li><em>Italic text</em></li>
        <li><code>Code elements</code></li>
        <li><a href="https://example.com">Links</a></li>
    </ul>
    
    <h2>Table Content</h2>
    <table border="1">
        <tr>
            <th>Header 1</th>
            <th>Header 2</th>
            <th>Header 3</th>
        </tr>
        <tr>
            <td>Row 1 Cell 1</td>
            <td>Row 1 Cell 2</td>
            <td>100</td>
        </tr>
        <tr>
            <td>Row 2 Cell 1</td>
            <td>Row 2 Cell 2</td>
            <td>200</td>
        </tr>
    </table>
    
    <h2>Special Characters</h2>
    <p>Testing special characters: &copy; &trade; &reg; &amp; &lt; &gt;</p>
    
    <div>
        <p>This document tests HTML parsing and text extraction accuracy.</p>
    </div>
</body>
</html>"""
    
    html_file = output_dir / "test_html.html"
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    # Expected text (cleaned HTML)
    expected_content = """HTML Test Document

Introduction
This is an HTML document for testing text extraction from web content.

Text Formatting
Testing various HTML formatting:
- Bold text
- Italic text
- Code elements
- Links

Table Content
Header 1 | Header 2 | Header 3
Row 1 Cell 1 | Row 1 Cell 2 | 100
Row 2 Cell 1 | Row 2 Cell 2 | 200

Special Characters
Testing special characters: © ™ ® & < >

This document tests HTML parsing and text extraction accuracy."""
    
    expected_file = output_dir.parent / "ground_truth" / "test_html.expected.txt"
    with open(expected_file, 'w', encoding='utf-8') as f:
        f.write(expected_content)
    
    print(f"✅ Created: {html_file}")
    print(f"✅ Created: {expected_file}")

def create_table_document(output_dir: Path):
    """Create a document with table-like content."""
    content = """Table Test Document

This document contains structured data in table format for testing table extraction capabilities.

Sales Report Q2 2025
Region,Sales,Growth,Target
North,150000,12%,140000
South,180000,8%,175000
East,120000,15%,110000
West,200000,10%,190000

Product Performance
Product Name | Units Sold | Revenue | Profit Margin
Widget A | 1200 | $24000 | 15%
Widget B | 800 | $32000 | 25%
Widget C | 1500 | $18000 | 12%

Summary Statistics:
- Total Revenue: $74,000
- Average Growth: 11.25%
- Top Region: West ($200,000)
- Best Margin: Widget B (25%)

End of table test document."""
    
    table_file = output_dir / "test_tables.txt"
    with open(table_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    # Expected output (same as input for plain text)
    expected_file = output_dir.parent / "ground_truth" / "test_tables.expected.txt"
    with open(expected_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✅ Created: {table_file}")
    print(f"✅ Created: {expected_file}")

if __name__ == "__main__":
    create_test_documents()
