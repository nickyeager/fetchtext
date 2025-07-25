#!/usr/bin/env python3
"""
Script to explore Docling API configuration options and parameters.
"""

import inspect
from docling.document_converter import DocumentConverter

def explore_docling_api():
    """Explore Docling DocumentConverter API."""
    
    print("=== Docling DocumentConverter API Exploration ===\n")
    
    # Get constructor signature
    sig = inspect.signature(DocumentConverter.__init__)
    print("Constructor signature:")
    print(f"DocumentConverter{sig}")
    print()
    
    # Get all parameters
    print("Constructor parameters:")
    for name, param in sig.parameters.items():
        if name != 'self':
            print(f"  {name}:")
            print(f"    Type: {param.annotation}")
            print(f"    Default: {param.default}")
            print()
    
    # Get docstring
    print("Constructor docstring:")
    if DocumentConverter.__init__.__doc__:
        print(DocumentConverter.__init__.__doc__)
    else:
        print("No docstring available")
    print()
    
    # Try to inspect class attributes and methods
    print("Class attributes and methods:")
    for attr_name in dir(DocumentConverter):
        if not attr_name.startswith('_'):
            attr = getattr(DocumentConverter, attr_name)
            print(f"  {attr_name}: {type(attr)}")
            if callable(attr) and hasattr(attr, '__doc__') and attr.__doc__:
                # Get first line of docstring
                first_line = attr.__doc__.split('\n')[0].strip()
                if first_line:
                    print(f"    Doc: {first_line}")
    print()
    
    # Try to create an instance and explore its attributes
    try:
        print("Creating DocumentConverter instance...")
        converter = DocumentConverter()
        print("  ✅ Instance created successfully")
        
        print("\nInstance attributes:")
        for attr_name in dir(converter):
            if not attr_name.startswith('_'):
                try:
                    attr = getattr(converter, attr_name)
                    print(f"  {attr_name}: {type(attr)}")
                    if hasattr(attr, '__doc__') and attr.__doc__:
                        first_line = attr.__doc__.split('\n')[0].strip()
                        if first_line:
                            print(f"    Doc: {first_line}")
                except Exception as e:
                    print(f"  {attr_name}: Error accessing - {e}")
        
        # Try to get converter info if available
        if hasattr(converter, 'allowed_formats'):
            print(f"\nAllowed formats: {converter.allowed_formats}")
        
        if hasattr(converter, 'format_options'):
            print(f"Format options: {converter.format_options}")
            
    except Exception as e:
        print(f"  ❌ Failed to create instance: {e}")

if __name__ == "__main__":
    explore_docling_api()
