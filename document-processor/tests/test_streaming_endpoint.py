"""
Integration tests for the SSE streaming document processing endpoint.

Tests the real /api/enhanced-documents/process-document-stream endpoint
against a running document-processor service on localhost:8090.
Uses real fixture files — no mocks.
"""

import json
import os
import time
from pathlib import Path

import httpx
import pytest

BASE_URL = os.getenv("DOCUMENT_PROCESSOR_URL", "http://localhost:8090")
FIXTURES_DIR = Path(__file__).parent / "fixtures" / "sample_documents"


@pytest.fixture(autouse=True)
def _check_service():
    """Fail fast if the backend is not running."""
    try:
        resp = httpx.get(f"{BASE_URL}/health", timeout=5)
        resp.raise_for_status()
    except Exception as exc:
        pytest.fail(f"Backend not available at {BASE_URL}: {exc}")


def _parse_sse_events(raw: str) -> list[dict]:
    """Parse raw SSE text into a list of {event, data} dicts."""
    events = []
    current_event = None
    current_data = []

    for line in raw.split("\n"):
        if line.startswith("event: "):
            current_event = line[len("event: "):].strip()
        elif line.startswith("data: "):
            current_data.append(line[len("data: "):])
        elif line == "" and current_event is not None:
            data_str = "\n".join(current_data)
            try:
                data = json.loads(data_str)
            except json.JSONDecodeError:
                data = data_str
            events.append({"event": current_event, "data": data})
            current_event = None
            current_data = []

    return events


class TestStreamingEndpointRealService:
    """Tests that call the real running service — not mocked."""

    def test_stream_returns_sse_events_for_text_file(self):
        """Upload a real text fixture and verify SSE events are received."""
        fixture_path = FIXTURES_DIR / "sample_invoice.txt"
        assert fixture_path.exists(), f"Fixture not found: {fixture_path}"

        with open(fixture_path, "rb") as f:
            files = {"file": ("sample_invoice.txt", f, "text/plain")}
            params = {
                "quick_scan": "true",
                "allow_generation": "true",
            }

            with httpx.Client(timeout=180) as client:
                with client.stream(
                    "POST",
                    f"{BASE_URL}/api/enhanced-documents/process-document-stream",
                    files=files,
                    params=params,
                ) as response:
                    assert response.status_code == 200
                    assert "text/event-stream" in response.headers.get("content-type", "")

                    raw_body = response.read().decode("utf-8")

        events = _parse_sse_events(raw_body)
        assert len(events) >= 3, f"Expected at least 3 SSE events, got {len(events)}"

        event_types = [e["event"] for e in events]
        assert "stage" in event_types, "Missing 'stage' events"

        # The stream must end with either 'complete' or 'error'
        last_event = events[-1]
        assert last_event["event"] in ("complete", "error"), (
            f"Last event should be 'complete' or 'error', got '{last_event['event']}'"
        )

    def test_stream_contains_expected_stages(self):
        """Verify the SSE stream includes the key processing stages."""
        fixture_path = FIXTURES_DIR / "sample_invoice.txt"

        with open(fixture_path, "rb") as f:
            files = {"file": ("sample_invoice.txt", f, "text/plain")}
            params = {"quick_scan": "true"}

            with httpx.Client(timeout=180) as client:
                with client.stream(
                    "POST",
                    f"{BASE_URL}/api/enhanced-documents/process-document-stream",
                    files=files,
                    params=params,
                ) as response:
                    raw_body = response.read().decode("utf-8")

        events = _parse_sse_events(raw_body)
        stages = [
            e["data"].get("stage")
            for e in events
            if e["event"] == "stage" and isinstance(e["data"], dict)
        ]

        # These stages must appear in every successful run:
        assert "received" in stages, f"Missing 'received' stage. Got: {stages}"
        assert "evaluated" in stages or "evaluating" in stages, (
            f"Missing evaluation stage. Got: {stages}"
        )
        assert "text_extracted" in stages or "extracting_text" in stages, (
            f"Missing text extraction stage. Got: {stages}"
        )

    def test_stream_progress_increases(self):
        """Verify that progress values monotonically increase across events."""
        fixture_path = FIXTURES_DIR / "simple_test.txt"

        with open(fixture_path, "rb") as f:
            files = {"file": ("simple_test.txt", f, "text/plain")}

            with httpx.Client(timeout=180) as client:
                with client.stream(
                    "POST",
                    f"{BASE_URL}/api/enhanced-documents/process-document-stream",
                    files=files,
                ) as response:
                    raw_body = response.read().decode("utf-8")

        events = _parse_sse_events(raw_body)
        progress_values = [
            e["data"].get("progress", 0)
            for e in events
            if isinstance(e["data"], dict) and "progress" in e["data"]
        ]

        assert len(progress_values) >= 2, "Need at least 2 progress values"
        for i in range(1, len(progress_values)):
            assert progress_values[i] >= progress_values[i - 1], (
                f"Progress decreased: {progress_values[i-1]} -> {progress_values[i]}"
            )

    def test_stream_complete_event_has_result(self):
        """Verify the 'complete' event includes a result payload."""
        fixture_path = FIXTURES_DIR / "sample_invoice.txt"

        with open(fixture_path, "rb") as f:
            files = {"file": ("sample_invoice.txt", f, "text/plain")}

            with httpx.Client(timeout=180) as client:
                with client.stream(
                    "POST",
                    f"{BASE_URL}/api/enhanced-documents/process-document-stream",
                    files=files,
                ) as response:
                    raw_body = response.read().decode("utf-8")

        events = _parse_sse_events(raw_body)
        complete_events = [e for e in events if e["event"] == "complete"]

        assert len(complete_events) == 1, (
            f"Expected exactly 1 'complete' event, got {len(complete_events)}"
        )

        result = complete_events[0]["data"].get("result", {})
        assert "evaluation" in result, "Complete event missing 'evaluation'"
        assert "content" in result, "Complete event missing 'content'"
        assert "action" in result, "Complete event missing 'action'"
        assert result.get("progress") == 100 or complete_events[0]["data"].get("progress") == 100

    def test_stream_rejects_missing_file(self):
        """Verify the endpoint returns 422 when no file is provided."""
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                f"{BASE_URL}/api/enhanced-documents/process-document-stream",
            )
        assert resp.status_code == 422, f"Expected 422, got {resp.status_code}"

    def test_stream_elapsed_ms_present(self):
        """Verify each stage event includes elapsed_ms timing info."""
        fixture_path = FIXTURES_DIR / "simple_test.txt"

        with open(fixture_path, "rb") as f:
            files = {"file": ("simple_test.txt", f, "text/plain")}

            with httpx.Client(timeout=180) as client:
                with client.stream(
                    "POST",
                    f"{BASE_URL}/api/enhanced-documents/process-document-stream",
                    files=files,
                ) as response:
                    raw_body = response.read().decode("utf-8")

        events = _parse_sse_events(raw_body)
        stage_events = [
            e for e in events
            if e["event"] == "stage" and isinstance(e["data"], dict)
        ]

        assert len(stage_events) >= 2
        for ev in stage_events:
            assert "elapsed_ms" in ev["data"], (
                f"Stage '{ev['data'].get('stage')}' missing elapsed_ms"
            )
            assert isinstance(ev["data"]["elapsed_ms"], (int, float))
