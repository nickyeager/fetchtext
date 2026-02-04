"""
Test configuration for Docling upgrade tests
"""
import pytest
import tempfile
import asyncio
from pathlib import Path
from typing import Generator, AsyncGenerator
import sys
import os

# Load environment variables from root .env file BEFORE importing app modules
# This ensures Azure OpenAI credentials are available for local test runs
from dotenv import load_dotenv

# Find the project root (parent of document-processor)
project_root = Path(__file__).parent.parent.parent
env_file = project_root / ".env"

if env_file.exists():
    load_dotenv(env_file)
    print(f"✓ Loaded environment from {env_file}")
else:
    print(f"⚠ No .env file found at {env_file}")

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def temp_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for tests."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield Path(temp_dir)

@pytest.fixture
def sample_text_content() -> str:
    """Sample text content for testing."""
    return """# Sample Document

This is a test document with **bold** and *italic* text.

## Section 1
- Item 1
- Item 2
- Item 3

## Section 2
Some paragraph text with numbers: 123, 456, 789.

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| A        | B        | C        |
| 1        | 2        | 3        |
"""

@pytest.fixture
def sample_pdf_path() -> Path:
    """Path to a sample PDF for testing (will be created if needed)."""
    fixtures_dir = Path(__file__).parent / "fixtures" / "sample_documents"
    fixtures_dir.mkdir(parents=True, exist_ok=True)
    return fixtures_dir / "sample.pdf"

@pytest.fixture
def sample_docx_path() -> Path:
    """Path to a sample DOCX for testing (will be created if needed)."""
    fixtures_dir = Path(__file__).parent / "fixtures" / "sample_documents"
    fixtures_dir.mkdir(parents=True, exist_ok=True)
    return fixtures_dir / "sample.docx"

@pytest.fixture
def mock_docling_response():
    """Mock Docling response structure."""
    return {
        "document": {
            "text": "Sample extracted text content",
            "metadata": {
                "title": "Sample Document",
                "author": "Test Author",
                "creation_date": "2025-07-06",
                "page_count": 1
            },
            "tables": [],
            "images": [],
            "structure": {
                "pages": 1,
                "sections": 2
            }
        }
    }

@pytest.fixture
def docling_service():
    """Import and return the DoclingService for testing."""
    from app.services.docling_service import DoclingService
    return DoclingService()

# Async fixtures
@pytest.fixture
async def async_docling_service():
    """Async version of docling_service fixture."""
    from app.services.docling_service import DoclingService
    service = DoclingService()
    yield service
    # Cleanup if needed
    if hasattr(service, 'cleanup'):
        await service.cleanup()
