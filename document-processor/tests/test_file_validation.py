"""Tests for server-side file validation."""
import io
import pytest
from fastapi import UploadFile, HTTPException
from app.middleware.file_validation import validate_and_save_uploaded_file

ALLOWED_EXTENSIONS = {
    '.pdf', '.docx', '.doc', '.xlsx', '.pptx', '.txt', '.md',
    '.html', '.htm', '.png', '.jpg', '.jpeg', '.gif', '.webp',
    '.csv', '.bmp', '.tiff',
}

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50MB


@pytest.mark.asyncio
async def test_rejects_oversized_file():
    """File exceeding 50MB should be rejected with 413."""
    content = b"x" * (MAX_UPLOAD_BYTES + 1)
    upload = UploadFile(filename="big.txt", file=io.BytesIO(content))
    with pytest.raises(HTTPException) as exc:
        await validate_and_save_uploaded_file(upload)
    assert exc.value.status_code == 413


@pytest.mark.asyncio
async def test_rejects_disallowed_extension():
    """File with a non-whitelisted extension should be rejected with 400."""
    content = b"#!/bin/bash\necho pwned"
    upload = UploadFile(filename="script.sh", file=io.BytesIO(content))
    with pytest.raises(HTTPException) as exc:
        await validate_and_save_uploaded_file(upload)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_accepts_valid_text_file():
    """A normal .txt file should be saved successfully."""
    content = b"Hello, this is a test document."
    upload = UploadFile(filename="test.txt", file=io.BytesIO(content))
    path = await validate_and_save_uploaded_file(upload)
    assert path.exists()
    assert path.suffix == ".txt"
    # Cleanup
    path.unlink()


@pytest.mark.asyncio
async def test_rejects_missing_filename():
    """Upload with no filename should be rejected."""
    content = b"some content"
    upload = UploadFile(filename="", file=io.BytesIO(content))
    with pytest.raises(HTTPException) as exc:
        await validate_and_save_uploaded_file(upload)
    assert exc.value.status_code == 400
