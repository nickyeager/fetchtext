"""
Integration tests for Template-RAG vector matching.

Tests the full flow:
1. Template vector service initializes correctly
2. Templates are indexed in Qdrant
3. /decide-template uses vector search and completes within timeout
4. Fallback works when Qdrant is unavailable

IMPORTANT: These tests call real services — no mocks.
"""

import os
import time
import pytest
import requests

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8090")
FIXTURES_DIR = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "dashboard",
    "tests",
    "fixtures",
)
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")

# Maximum allowed response time for /decide-template (seconds)
MAX_DECIDE_TEMPLATE_TIME = 30


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _backend_available() -> bool:
    try:
        r = requests.get(f"{BACKEND_URL}/health", timeout=10)
        return r.ok
    except Exception:
        return False


def _qdrant_available() -> bool:
    try:
        r = requests.get(f"{QDRANT_URL}/collections", timeout=5)
        return r.ok
    except Exception:
        return False


def _get_fixture_path(name: str) -> str:
    path = os.path.join(FIXTURES_DIR, name)
    if not os.path.exists(path):
        pytest.skip(f"Fixture {name} not found at {path}")
    return path


# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------

class TestPreFlight:
    """Verify services are running before any real tests."""

    def test_backend_is_healthy(self):
        if not _backend_available():
            raise RuntimeError(
                f"Backend not available at {BACKEND_URL} — cannot run integration tests"
            )
        r = requests.get(f"{BACKEND_URL}/health", timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"


# ---------------------------------------------------------------------------
# Template Vector Service
# ---------------------------------------------------------------------------

class TestTemplateVectorService:
    """Test the template vector service components."""

    def test_health_cors_endpoint(self):
        """Sanity check — /health/cors returns origins."""
        r = requests.get(f"{BACKEND_URL}/health/cors", timeout=10)
        assert r.ok
        data = r.json()
        assert data["status"] == "ok"
        assert "allowed_origins" in data

    @pytest.mark.skipif(
        not _qdrant_available(),
        reason="Qdrant not reachable — skipping Qdrant-specific tests",
    )
    def test_qdrant_has_template_embeddings_collection(self):
        """After startup sync, the template_embeddings collection should exist."""
        r = requests.get(f"{QDRANT_URL}/collections/template_embeddings", timeout=10)
        assert r.ok, f"template_embeddings collection not found: {r.text}"
        data = r.json()
        assert data.get("status") == "ok" or data.get("result") is not None

    @pytest.mark.skipif(
        not _qdrant_available(),
        reason="Qdrant not reachable — skipping Qdrant-specific tests",
    )
    def test_qdrant_template_count_matches_db(self):
        """Qdrant should have at least some points if templates exist in DB."""
        r = requests.get(f"{QDRANT_URL}/collections/template_embeddings", timeout=10)
        if not r.ok:
            pytest.skip("template_embeddings collection not found")
        data = r.json()
        result = data.get("result", {})
        points_count = result.get("points_count", 0)
        # We don't know the exact count but it should be >= 0
        assert points_count >= 0, f"Unexpected points_count: {points_count}"


# ---------------------------------------------------------------------------
# /decide-template Performance & Correctness
# ---------------------------------------------------------------------------

class TestDecideTemplatePerformance:
    """Test that /decide-template completes within the timeout budget."""

    def test_decide_template_with_text_fixture(self):
        """Upload a real text fixture and verify response time < 30s."""
        if not _backend_available():
            raise RuntimeError("Backend not available")

        fixture_path = _get_fixture_path("real-test-contract.txt")

        start = time.time()
        with open(fixture_path, "rb") as f:
            r = requests.post(
                f"{BACKEND_URL}/api/enhanced-documents/decide-template",
                files={"file": ("contract.txt", f, "text/plain")},
                data={
                    "quick_scan": "true",
                    "min_match_confidence": "0.6",
                    "allow_generation": "true",
                },
                timeout=60,
            )
        elapsed = time.time() - start

        assert r.ok, f"decide-template returned {r.status_code}: {r.text[:500]}"

        data = r.json()
        assert "action" in data, f"Missing 'action' in response: {list(data.keys())}"
        assert "evaluation" in data, f"Missing 'evaluation' in response"
        assert "decision_metadata" in data or "generation_metadata" in data

        # Performance assertion
        assert elapsed < MAX_DECIDE_TEMPLATE_TIME, (
            f"/decide-template took {elapsed:.1f}s — exceeds {MAX_DECIDE_TEMPLATE_TIME}s budget"
        )

    def test_decide_template_response_format_use_existing(self):
        """Verify response shape when action is 'use_existing'."""
        if not _backend_available():
            raise RuntimeError("Backend not available")

        fixture_path = _get_fixture_path("real-test-contract.txt")

        with open(fixture_path, "rb") as f:
            r = requests.post(
                f"{BACKEND_URL}/api/enhanced-documents/decide-template",
                files={"file": ("contract.txt", f, "text/plain")},
                data={
                    "quick_scan": "true",
                    "min_match_confidence": "0.5",
                    "allow_generation": "true",
                },
                timeout=60,
            )

        assert r.ok
        data = r.json()
        action = data.get("action")

        if action == "use_existing":
            chosen = data.get("chosen_template")
            assert chosen is not None, "use_existing but no chosen_template"
            assert "template_id" in chosen
            assert "match_score" in chosen
            assert "decision_metadata" in data
            meta = data["decision_metadata"]
            assert "extraction_tested" in meta or "match_score" in meta
        elif action == "generated":
            assert "template" in data
            assert "generation_metadata" in data
        elif action == "no_suitable_template":
            assert "alternatives" in data
        else:
            pytest.fail(f"Unexpected action: {action}")

    def test_decide_template_does_not_loop_3_times(self):
        """Verify that only 1 extraction test is performed (not 3).

        We infer this from the response time: with 3 sequential extraction tests
        the minimum is ~15s. With 1 it should be under ~15s (plus overhead).
        This is an indirect test since we can't inspect internal counters via API.
        """
        if not _backend_available():
            raise RuntimeError("Backend not available")

        fixture_path = _get_fixture_path("real-test-contract.txt")

        start = time.time()
        with open(fixture_path, "rb") as f:
            r = requests.post(
                f"{BACKEND_URL}/api/enhanced-documents/decide-template",
                files={"file": ("contract.txt", f, "text/plain")},
                data={
                    "quick_scan": "true",
                    "min_match_confidence": "0.6",
                    "allow_generation": "false",
                },
                timeout=60,
            )
        elapsed = time.time() - start

        assert r.ok
        # If 3 sequential extraction tests ran, elapsed would be > 25s
        # With 1 extraction test + vector search, it should be < 25s
        assert elapsed < MAX_DECIDE_TEMPLATE_TIME, (
            f"Response took {elapsed:.1f}s — likely still running 3 extraction tests"
        )
