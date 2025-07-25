#!/usr/bin/env python3
"""
Minimal test to check if Python and imports work
"""
import sys
print("Python version:", sys.version)

try:
    import pathlib
    print("✅ pathlib import works")
except ImportError as e:
    print("❌ pathlib import failed:", e)

try:
    import asyncio
    print("✅ asyncio import works")
except ImportError as e:
    print("❌ asyncio import failed:", e)

try:
    import logging
    print("✅ logging import works")
except ImportError as e:
    print("❌ logging import failed:", e)

try:
    from pathlib import Path
    print("✅ Path import works")
except ImportError as e:
    print("❌ Path import failed:", e)

# Test basic Path operations
try:
    p = Path(".")
    print(f"✅ Current directory: {p.resolve()}")
    print(f"✅ Directory exists: {p.exists()}")
except Exception as e:
    print("❌ Path operations failed:", e)

print("🎉 Basic Python functionality test complete")
