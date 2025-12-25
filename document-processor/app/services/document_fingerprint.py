"""
Document Fingerprinting Service

Computes content-based fingerprints for documents to enable:
- Exact document matching (same document uploaded again)
- Near-duplicate detection
- Source document tracking for generated templates

The fingerprint is based on normalized text content, making it robust to:
- Minor formatting changes
- Whitespace variations
- PDF re-encoding
"""
import hashlib
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def normalize_text_for_fingerprint(text: str) -> str:
    """
    Normalize text content for consistent fingerprinting.

    Normalizations applied:
    - Convert to lowercase
    - Collapse all whitespace to single spaces
    - Remove punctuation variations
    - Strip leading/trailing whitespace
    - Remove common OCR artifacts
    """
    if not text:
        return ""

    # Convert to lowercase
    normalized = text.lower()

    # Replace all whitespace (newlines, tabs, multiple spaces) with single space
    normalized = re.sub(r'\s+', ' ', normalized)

    # Remove common OCR artifacts and noise
    normalized = re.sub(r'[|\\/_\-=+*~`]', '', normalized)

    # Normalize quotes
    normalized = normalized.replace('"', '"').replace('"', '"')
    normalized = normalized.replace(''', "'").replace(''', "'")

    # Strip leading/trailing whitespace
    normalized = normalized.strip()

    return normalized


def compute_document_fingerprint(text: str, algorithm: str = 'sha256') -> str:
    """
    Compute a fingerprint hash for document text content.

    Args:
        text: The document text content
        algorithm: Hash algorithm to use (sha256, sha1, md5)

    Returns:
        Hexadecimal hash string representing the document fingerprint
    """
    if not text:
        return ""

    # Normalize text for consistent fingerprinting
    normalized = normalize_text_for_fingerprint(text)

    if not normalized:
        return ""

    # Compute hash
    if algorithm == 'sha256':
        hasher = hashlib.sha256()
    elif algorithm == 'sha1':
        hasher = hashlib.sha1()
    elif algorithm == 'md5':
        hasher = hashlib.md5()
    else:
        hasher = hashlib.sha256()

    hasher.update(normalized.encode('utf-8'))
    fingerprint = hasher.hexdigest()

    logger.debug(f"Computed fingerprint: {fingerprint[:16]}... (from {len(text)} chars)")

    return fingerprint


def compute_short_fingerprint(text: str, length: int = 16) -> str:
    """
    Compute a shortened fingerprint for display/logging purposes.

    Args:
        text: The document text content
        length: Length of the short fingerprint (default 16 chars)

    Returns:
        Shortened fingerprint string
    """
    full_fingerprint = compute_document_fingerprint(text)
    return full_fingerprint[:length] if full_fingerprint else ""


def fingerprints_match(fp1: str, fp2: str) -> bool:
    """
    Check if two fingerprints match (exact match).

    Args:
        fp1: First fingerprint
        fp2: Second fingerprint

    Returns:
        True if fingerprints are identical
    """
    if not fp1 or not fp2:
        return False
    return fp1.lower() == fp2.lower()


def compute_similarity_score(text1: str, text2: str) -> float:
    """
    Compute a similarity score between two document texts.

    Uses a simple token overlap approach for near-duplicate detection.

    Args:
        text1: First document text
        text2: Second document text

    Returns:
        Similarity score from 0.0 to 1.0
    """
    if not text1 or not text2:
        return 0.0

    # Normalize both texts
    norm1 = normalize_text_for_fingerprint(text1)
    norm2 = normalize_text_for_fingerprint(text2)

    # Exact match
    if norm1 == norm2:
        return 1.0

    # Token-based similarity (Jaccard index)
    tokens1 = set(norm1.split())
    tokens2 = set(norm2.split())

    if not tokens1 or not tokens2:
        return 0.0

    intersection = tokens1.intersection(tokens2)
    union = tokens1.union(tokens2)

    return len(intersection) / len(union) if union else 0.0


class DocumentFingerprintService:
    """Service for managing document fingerprints"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def compute(self, text: str) -> str:
        """Compute fingerprint for document text"""
        return compute_document_fingerprint(text)

    def compute_short(self, text: str, length: int = 16) -> str:
        """Compute shortened fingerprint"""
        return compute_short_fingerprint(text, length)

    def match(self, fp1: str, fp2: str) -> bool:
        """Check if fingerprints match"""
        return fingerprints_match(fp1, fp2)

    def similarity(self, text1: str, text2: str) -> float:
        """Compute text similarity score"""
        return compute_similarity_score(text1, text2)


# Global instance
document_fingerprint_service = DocumentFingerprintService()
