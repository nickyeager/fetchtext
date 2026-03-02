"""
Tests for Webhook Delivery Service.

Pure logic tests for HMAC signature and configuration run without external services.
Integration tests use a real local HTTP server to receive webhook deliveries.
No mocks. No fakes.
"""

import json
import hashlib
import hmac
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

import pytest
import httpx

from app.services.webhook_service import WebhookService, webhook_service

BACKEND_URL = "http://localhost:8090"


@pytest.fixture(scope="module")
def backend():
    """Verify the backend is reachable before running integration tests."""
    try:
        resp = httpx.get(f"{BACKEND_URL}/health", timeout=5)
        resp.raise_for_status()
    except Exception as exc:
        pytest.fail(f"Backend not reachable at {BACKEND_URL}: {exc}")


class _WebhookHandler(BaseHTTPRequestHandler):
    """Real HTTP handler that receives webhook POST requests."""

    received = []

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length else b'{}'

        self.received.append({
            'path': self.path,
            'headers': dict(self.headers),
            'body': json.loads(body) if body else {},
        })

        if self.path == '/error':
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b'Internal Server Error')
        else:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'OK')

    def log_message(self, format, *args):
        pass  # Suppress access log output


@pytest.fixture(scope="module")
def webhook_receiver():
    """Start a real HTTP server to receive webhook deliveries."""
    server = HTTPServer(('localhost', 0), _WebhookHandler)
    port = server.server_address[1]

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    yield {'url': f'http://localhost:{port}', 'requests': _WebhookHandler.received}

    server.shutdown()


# =============================================================================
# Pure Logic Tests — Signature Generation (no external services)
# =============================================================================


class TestSignatureGeneration:
    """Test HMAC-SHA256 signature generation."""

    def test_generates_correct_signature_format(self):
        """Signature follows 'sha256=<hex_digest>' format."""
        service = WebhookService()
        payload = {'job_id': '123', 'status': 'completed'}
        secret = 'my-webhook-secret'
        timestamp = '2025-01-01T12:00:00'

        signature = service._generate_signature(payload, secret, timestamp)

        assert signature.startswith('sha256=')
        # sha256 hex digest is 64 characters
        assert len(signature) == 7 + 64  # 'sha256=' + 64 hex chars

    def test_signature_includes_timestamp(self):
        """Different timestamps produce different signatures."""
        service = WebhookService()
        payload = {'job_id': '123'}
        secret = 'my-secret'

        sig1 = service._generate_signature(payload, secret, '2025-01-01T12:00:00')
        sig2 = service._generate_signature(payload, secret, '2025-01-01T12:00:01')

        assert sig1 != sig2

    def test_signature_includes_payload(self):
        """Different payloads produce different signatures."""
        service = WebhookService()
        secret = 'my-secret'
        timestamp = '2025-01-01T12:00:00'

        sig1 = service._generate_signature({'job_id': '123'}, secret, timestamp)
        sig2 = service._generate_signature({'job_id': '456'}, secret, timestamp)

        assert sig1 != sig2

    def test_signature_is_deterministic(self):
        """Same inputs produce same signature."""
        service = WebhookService()
        payload = {'job_id': '123', 'status': 'completed'}
        secret = 'my-secret'
        timestamp = '2025-01-01T12:00:00'

        sig1 = service._generate_signature(payload, secret, timestamp)
        sig2 = service._generate_signature(payload, secret, timestamp)

        assert sig1 == sig2

    def test_payload_key_order_is_consistent(self):
        """Payload is sorted by keys for consistent signature."""
        service = WebhookService()
        secret = 'my-secret'
        timestamp = '2025-01-01T12:00:00'

        # Same data, different insertion order
        payload1 = {'b': '2', 'a': '1'}
        payload2 = {'a': '1', 'b': '2'}

        sig1 = service._generate_signature(payload1, secret, timestamp)
        sig2 = service._generate_signature(payload2, secret, timestamp)

        assert sig1 == sig2


# =============================================================================
# Pure Logic Tests — Signature Verification (no external services)
# =============================================================================


class TestSignatureVerification:
    """Test signature verification utility."""

    def test_verify_valid_signature(self):
        """Valid signature returns True."""
        service = WebhookService()
        payload = {'job_id': '123', 'status': 'completed'}
        secret = 'my-webhook-secret'
        timestamp = '2025-01-01T12:00:00'

        signature = service._generate_signature(payload, secret, timestamp)

        result = WebhookService.verify_signature(payload, secret, timestamp, signature)
        assert result is True

    def test_verify_invalid_signature(self):
        """Invalid signature returns False."""
        payload = {'job_id': '123'}
        secret = 'my-secret'
        timestamp = '2025-01-01T12:00:00'

        result = WebhookService.verify_signature(
            payload, secret, timestamp, 'sha256=invalid'
        )
        assert result is False

    def test_verify_wrong_secret(self):
        """Wrong secret fails verification."""
        service = WebhookService()
        payload = {'job_id': '123'}
        timestamp = '2025-01-01T12:00:00'

        signature = service._generate_signature(payload, 'correct-secret', timestamp)

        result = WebhookService.verify_signature(
            payload, 'wrong-secret', timestamp, signature
        )
        assert result is False

    def test_verify_tampered_payload(self):
        """Tampered payload fails verification."""
        service = WebhookService()
        original_payload = {'job_id': '123', 'status': 'completed'}
        tampered_payload = {'job_id': '123', 'status': 'failed'}
        secret = 'my-secret'
        timestamp = '2025-01-01T12:00:00'

        signature = service._generate_signature(original_payload, secret, timestamp)

        result = WebhookService.verify_signature(
            tampered_payload, secret, timestamp, signature
        )
        assert result is False


# =============================================================================
# Pure Logic Tests — Service Configuration (no external services)
# =============================================================================


class TestServiceConfiguration:
    """Test service initialization and configuration."""

    def test_default_timeout(self):
        """Default timeout is 30 seconds."""
        service = WebhookService()
        assert service.default_timeout == 30

    def test_default_max_retries(self):
        """Default max retries is 3."""
        service = WebhookService()
        assert service.default_max_retries == 3

    def test_custom_configuration(self):
        """Can customize timeout and retries."""
        service = WebhookService(default_timeout=60, default_max_retries=5)
        assert service.default_timeout == 60
        assert service.default_max_retries == 5


# =============================================================================
# Integration Tests — Real Webhook Delivery via local HTTP server
# =============================================================================


class TestWebhookDeliveryReal:
    """Test webhook delivery against a real local HTTP server."""

    @pytest.mark.asyncio
    async def test_successful_delivery_returns_true(self, webhook_receiver):
        """Successful delivery to a real 200-returning endpoint returns True."""
        service = WebhookService()

        _WebhookHandler.received.clear()

        result = await service.deliver_webhook(
            job_id='test-job-001',
            webhook_url=f"{webhook_receiver['url']}/webhook",
            payload={'status': 'completed', 'job_id': 'test-job-001'},
            max_retries=1,
            timeout=10,
        )

        assert result is True

    @pytest.mark.asyncio
    async def test_server_receives_correct_payload(self, webhook_receiver):
        """Real HTTP server receives the exact JSON payload."""
        service = WebhookService()

        _WebhookHandler.received.clear()

        payload = {'status': 'completed', 'job_id': 'test-job-002', 'result': 'ok'}
        await service.deliver_webhook(
            job_id='test-job-002',
            webhook_url=f"{webhook_receiver['url']}/webhook",
            payload=payload,
            max_retries=1,
            timeout=10,
        )

        assert len(webhook_receiver['requests']) >= 1
        received = webhook_receiver['requests'][-1]
        assert received['body']['status'] == 'completed'
        assert received['body']['job_id'] == 'test-job-002'

    @pytest.mark.asyncio
    async def test_server_receives_correct_headers(self, webhook_receiver):
        """Real HTTP server receives FetchText-specific headers."""
        service = WebhookService()

        _WebhookHandler.received.clear()

        await service.deliver_webhook(
            job_id='test-job-003',
            webhook_url=f"{webhook_receiver['url']}/webhook",
            payload={'status': 'completed'},
            max_retries=1,
            timeout=10,
        )

        assert len(webhook_receiver['requests']) >= 1
        headers = webhook_receiver['requests'][-1]['headers']
        assert headers.get('Content-Type') == 'application/json'
        assert headers.get('User-Agent') == 'FetchText-Webhook/1.0'
        assert headers.get('X-FetchText-Event') == 'job.completed'
        assert headers.get('X-FetchText-Job-ID') == 'test-job-003'
        assert 'X-FetchText-Delivery-ID' in headers
        assert 'X-FetchText-Timestamp' in headers

    @pytest.mark.asyncio
    async def test_includes_signature_when_secret_provided(self, webhook_receiver):
        """Delivery with webhook_secret includes HMAC signature header."""
        service = WebhookService()

        _WebhookHandler.received.clear()

        await service.deliver_webhook(
            job_id='test-job-004',
            webhook_url=f"{webhook_receiver['url']}/webhook",
            payload={'status': 'completed'},
            webhook_secret='test-secret-key',
            max_retries=1,
            timeout=10,
        )

        assert len(webhook_receiver['requests']) >= 1
        headers = webhook_receiver['requests'][-1]['headers']
        assert 'X-FetchText-Signature' in headers
        assert headers['X-FetchText-Signature'].startswith('sha256=')

    @pytest.mark.asyncio
    async def test_no_signature_without_secret(self, webhook_receiver):
        """No signature header when webhook_secret is not provided."""
        service = WebhookService()

        _WebhookHandler.received.clear()

        await service.deliver_webhook(
            job_id='test-job-005',
            webhook_url=f"{webhook_receiver['url']}/webhook",
            payload={'status': 'completed'},
            webhook_secret=None,
            max_retries=1,
            timeout=10,
        )

        assert len(webhook_receiver['requests']) >= 1
        headers = webhook_receiver['requests'][-1]['headers']
        assert 'X-FetchText-Signature' not in headers

    @pytest.mark.asyncio
    async def test_failed_delivery_returns_false(self, webhook_receiver):
        """Delivery to a 500-returning endpoint returns False."""
        service = WebhookService()

        result = await service.deliver_webhook(
            job_id='test-job-006',
            webhook_url=f"{webhook_receiver['url']}/error",
            payload={'status': 'completed'},
            max_retries=1,
            timeout=10,
        )

        assert result is False

    @pytest.mark.asyncio
    async def test_retries_on_server_error(self, webhook_receiver):
        """Service retries delivery on server error responses."""
        service = WebhookService()

        _WebhookHandler.received.clear()

        await service.deliver_webhook(
            job_id='test-job-007',
            webhook_url=f"{webhook_receiver['url']}/error",
            payload={'status': 'completed'},
            max_retries=2,
            timeout=10,
        )

        # Should have received 2 attempts (max_retries=2)
        error_requests = [r for r in webhook_receiver['requests'] if r['path'] == '/error']
        assert len(error_requests) == 2

    @pytest.mark.asyncio
    async def test_delivery_to_unreachable_host_fails(self):
        """Delivery to an unreachable host returns False."""
        service = WebhookService()

        result = await service.deliver_webhook(
            job_id='test-job-008',
            webhook_url='http://127.0.0.1:59999/webhook',
            payload={'status': 'completed'},
            max_retries=1,
            timeout=3,
        )

        assert result is False


# =============================================================================
# Pure Logic Tests — Global Singleton
# =============================================================================


class TestGlobalSingleton:
    """Test the global webhook_service singleton."""

    def test_singleton_exists(self):
        """Global singleton is properly instantiated."""
        assert webhook_service is not None
        assert isinstance(webhook_service, WebhookService)

    def test_singleton_has_defaults(self):
        """Singleton has default configuration."""
        assert webhook_service.default_timeout == 30
        assert webhook_service.default_max_retries == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
