"""
Server-side file validation for uploads.

Enforces:
- File size limit (50MB)
- Extension whitelist
- Non-empty filename
"""

import uuid
import tempfile
import logging
import sys
from pathlib import Path

import aiofiles
from fastapi import UploadFile, HTTPException

try:
    logger = logging.getLogger(__name__)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
except Exception:
    logging.basicConfig(stream=sys.stdout, level=logging.INFO)
    logger = logging.getLogger(__name__)


MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50MB

ALLOWED_EXTENSIONS = {
    '.pdf', '.docx', '.doc', '.xlsx', '.pptx', '.txt', '.md',
    '.html', '.htm', '.png', '.jpg', '.jpeg', '.gif', '.webp',
    '.csv', '.bmp', '.tiff',
}


async def validate_and_save_uploaded_file(upload_file: UploadFile) -> Path:
    """
    Validate and save an uploaded file to a temporary location.

    Checks:
    - Filename is present
    - Extension is in whitelist
    - File size <= MAX_UPLOAD_BYTES

    Returns:
        Path to the saved temporary file.

    Raises:
        HTTPException 400 for invalid file type or missing filename.
        HTTPException 413 for oversized file.
    """
    filename = upload_file.filename or ""
    if not filename.strip():
        raise HTTPException(status_code=400, detail="No filename provided")

    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{extension}' not permitted. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    content = await upload_file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed size of {MAX_UPLOAD_BYTES // (1024*1024)}MB"
        )

    temp_dir = Path(tempfile.gettempdir()) / "docling_uploads"
    temp_dir.mkdir(exist_ok=True)

    temp_filename = f"{uuid.uuid4()}{extension}"
    temp_path = temp_dir / temp_filename

    async with aiofiles.open(temp_path, 'wb') as f:
        await f.write(content)

    logger.info(f"Saved uploaded file: {filename} ({len(content)} bytes) -> {temp_path}")
    return temp_path
