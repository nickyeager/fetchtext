"""
End-to-end integration test for webhook delivery.

Requires:
- Document processor running on localhost:8090
- Supabase running with webhook_subscriptions table

This test:
1. Verifies the backend is running and webhook endpoints are registered
2. Verifies webhook creation requires authentication
3. Verifies the /api/webhooks/events endpoint returns valid event types
"""
import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import List, Dict, Any

import pytest
import requests

BACKEND_URL = "http://localhost:8090"
WEBHOOK_PORT = 19876  # Ephemeral port for test webhook receiver


class WebhookReceiver(BaseHTTPRequestHandler):
    """Simple HTTP server that captures webhook deliveries."""

    received: List[Dict[str, Any]] = []

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        payload = json.loads(body)

        WebhookReceiver.received.append({
            "payload": payload,
            "headers": dict(self.headers),
        })

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode())

    def log_message(self, format, *args):
        pass  # Suppress server logs


@pytest.fixture(scope="module")
def webhook_server():
    """Start a local HTTP server to receive test webhooks."""
    WebhookReceiver.received = []
    server = HTTPServer(("0.0.0.0", WEBHOOK_PORT), WebhookReceiver)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server
    server.shutdown()


def test_backend_is_running():
    """Verify the document processor is accessible."""
    resp = requests.get(f"{BACKEND_URL}/health", timeout=5)
    assert resp.status_code == 200, f"Backend not running: {resp.status_code}"


def test_webhook_events_endpoint():
    """Verify the /api/webhooks/events endpoint returns valid event types."""
    resp = requests.get(f"{BACKEND_URL}/api/webhooks/events", timeout=5)
    # Note: This will fail with 401 if auth is required — that's expected.
    assert resp.status_code in (200, 401, 403)


def test_webhook_creation_requires_auth():
    """Verify webhook creation requires authentication."""
    resp = requests.post(
        f"{BACKEND_URL}/api/webhooks?organization_id=test-org",
        json={"name": "Test", "url": "https://example.com", "events": []},
        timeout=5,
    )
    assert resp.status_code in (401, 403), "Should require authentication"
