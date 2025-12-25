"""
Tests for Webhook Delivery Service

Tests webhook delivery, HMAC signature generation, retry logic, and logging.
"""

import pytest
import json
import hashlib
import hmac
from datetime import datetime
from unittest.mock import MagicMock, patch, AsyncMock
import aiohttp
import asyncio

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.webhook_service import WebhookService, webhook_service


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


class TestWebhookDelivery:
    """Test webhook delivery functionality."""

    @pytest.mark.asyncio
    async def test_successful_delivery_returns_true(self):
        """Successful 2xx response returns True."""
        service = WebhookService()

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value='OK')

        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response

        with patch('aiohttp.ClientSession', return_value=mock_session):
            with patch.object(service, '_log_delivery', new_callable=AsyncMock):
                with patch.object(service, '_update_job_webhook_status', new_callable=AsyncMock):
                    result = await service.deliver_webhook(
                        job_id='job-123',
                        webhook_url='https://example.com/webhook',
                        payload={'status': 'completed'}
                    )

                    assert result is True

    @pytest.mark.asyncio
    async def test_includes_correct_headers(self):
        """Request includes all required headers."""
        service = WebhookService()

        captured_kwargs = {}

        async def capture_post(*args, **kwargs):
            captured_kwargs.update(kwargs)
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.text = AsyncMock(return_value='OK')
            return AsyncMock(__aenter__=AsyncMock(return_value=mock_response))

        mock_session = AsyncMock()
        mock_session.post = capture_post

        with patch('aiohttp.ClientSession', return_value=mock_session):
            with patch.object(service, '_log_delivery', new_callable=AsyncMock):
                with patch.object(service, '_update_job_webhook_status', new_callable=AsyncMock):
                    await service.deliver_webhook(
                        job_id='job-123',
                        webhook_url='https://example.com/webhook',
                        payload={'status': 'completed'}
                    )

        headers = captured_kwargs.get('headers', {})
        assert headers.get('Content-Type') == 'application/json'
        assert headers.get('User-Agent') == 'FetchText-Webhook/1.0'
        assert headers.get('X-FetchText-Event') == 'job.completed'
        assert headers.get('X-FetchText-Job-ID') == 'job-123'
        assert 'X-FetchText-Delivery-ID' in headers
        assert 'X-FetchText-Timestamp' in headers

    @pytest.mark.asyncio
    async def test_includes_signature_when_secret_provided(self):
        """Request includes HMAC signature when webhook_secret is provided."""
        service = WebhookService()

        captured_kwargs = {}

        async def capture_post(*args, **kwargs):
            captured_kwargs.update(kwargs)
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.text = AsyncMock(return_value='OK')
            return AsyncMock(__aenter__=AsyncMock(return_value=mock_response))

        mock_session = AsyncMock()
        mock_session.post = capture_post

        with patch('aiohttp.ClientSession', return_value=mock_session):
            with patch.object(service, '_log_delivery', new_callable=AsyncMock):
                with patch.object(service, '_update_job_webhook_status', new_callable=AsyncMock):
                    await service.deliver_webhook(
                        job_id='job-123',
                        webhook_url='https://example.com/webhook',
                        payload={'status': 'completed'},
                        webhook_secret='my-secret'
                    )

        headers = captured_kwargs.get('headers', {})
        assert 'X-FetchText-Signature' in headers
        assert headers['X-FetchText-Signature'].startswith('sha256=')

    @pytest.mark.asyncio
    async def test_no_signature_without_secret(self):
        """No signature header when webhook_secret is not provided."""
        service = WebhookService()

        captured_kwargs = {}

        async def capture_post(*args, **kwargs):
            captured_kwargs.update(kwargs)
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.text = AsyncMock(return_value='OK')
            return AsyncMock(__aenter__=AsyncMock(return_value=mock_response))

        mock_session = AsyncMock()
        mock_session.post = capture_post

        with patch('aiohttp.ClientSession', return_value=mock_session):
            with patch.object(service, '_log_delivery', new_callable=AsyncMock):
                with patch.object(service, '_update_job_webhook_status', new_callable=AsyncMock):
                    await service.deliver_webhook(
                        job_id='job-123',
                        webhook_url='https://example.com/webhook',
                        payload={'status': 'completed'},
                        webhook_secret=None
                    )

        headers = captured_kwargs.get('headers', {})
        assert 'X-FetchText-Signature' not in headers


class TestRetryLogic:
    """Test webhook retry behavior."""

    @pytest.mark.asyncio
    async def test_retries_on_5xx_error(self):
        """Retries on server error responses."""
        service = WebhookService(default_max_retries=3)

        call_count = 0

        async def mock_post(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            mock_response = AsyncMock()
            mock_response.status = 500
            mock_response.text = AsyncMock(return_value='Server Error')
            return AsyncMock(__aenter__=AsyncMock(return_value=mock_response))

        mock_session = AsyncMock()
        mock_session.post = mock_post

        with patch('aiohttp.ClientSession', return_value=mock_session):
            with patch.object(service, '_log_delivery', new_callable=AsyncMock):
                with patch.object(service, '_update_job_webhook_status', new_callable=AsyncMock):
                    with patch('asyncio.sleep', new_callable=AsyncMock):  # Skip delays
                        result = await service.deliver_webhook(
                            job_id='job-123',
                            webhook_url='https://example.com/webhook',
                            payload={'status': 'completed'},
                            max_retries=3
                        )

        assert call_count == 3
        assert result is False

    @pytest.mark.asyncio
    async def test_succeeds_on_retry(self):
        """Returns True if retry succeeds."""
        service = WebhookService()

        call_count = 0

        async def mock_post(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            mock_response = AsyncMock()
            # Fail first two attempts, succeed on third
            mock_response.status = 200 if call_count >= 3 else 500
            mock_response.text = AsyncMock(return_value='OK' if call_count >= 3 else 'Error')
            return AsyncMock(__aenter__=AsyncMock(return_value=mock_response))

        mock_session = AsyncMock()
        mock_session.post = mock_post

        with patch('aiohttp.ClientSession', return_value=mock_session):
            with patch.object(service, '_log_delivery', new_callable=AsyncMock):
                with patch.object(service, '_update_job_webhook_status', new_callable=AsyncMock):
                    with patch('asyncio.sleep', new_callable=AsyncMock):
                        result = await service.deliver_webhook(
                            job_id='job-123',
                            webhook_url='https://example.com/webhook',
                            payload={'status': 'completed'},
                            max_retries=3
                        )

        assert call_count == 3
        assert result is True

    @pytest.mark.asyncio
    async def test_handles_timeout(self):
        """Handles connection timeout gracefully."""
        service = WebhookService()

        async def mock_post(*args, **kwargs):
            raise asyncio.TimeoutError()

        mock_session = AsyncMock()
        mock_session.post = mock_post

        with patch('aiohttp.ClientSession', return_value=mock_session):
            with patch.object(service, '_log_delivery', new_callable=AsyncMock) as mock_log:
                with patch.object(service, '_update_job_webhook_status', new_callable=AsyncMock):
                    with patch('asyncio.sleep', new_callable=AsyncMock):
                        result = await service.deliver_webhook(
                            job_id='job-123',
                            webhook_url='https://example.com/webhook',
                            payload={'status': 'completed'},
                            max_retries=2
                        )

        assert result is False
        # Should have logged the timeout
        assert mock_log.call_count >= 1

    @pytest.mark.asyncio
    async def test_handles_client_error(self):
        """Handles aiohttp client errors gracefully."""
        service = WebhookService()

        async def mock_post(*args, **kwargs):
            raise aiohttp.ClientError("Connection refused")

        mock_session = AsyncMock()
        mock_session.post = mock_post

        with patch('aiohttp.ClientSession', return_value=mock_session):
            with patch.object(service, '_log_delivery', new_callable=AsyncMock):
                with patch.object(service, '_update_job_webhook_status', new_callable=AsyncMock):
                    with patch('asyncio.sleep', new_callable=AsyncMock):
                        result = await service.deliver_webhook(
                            job_id='job-123',
                            webhook_url='https://example.com/webhook',
                            payload={'status': 'completed'},
                            max_retries=2
                        )

        assert result is False


class TestDeliveryLogging:
    """Test webhook delivery logging."""

    @pytest.mark.asyncio
    async def test_logs_successful_delivery(self):
        """Logs successful delivery to database."""
        service = WebhookService()

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value='OK')

        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response

        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock()

        with patch('aiohttp.ClientSession', return_value=mock_session):
            with patch('app.services.webhook_service.db_config') as mock_db:
                mock_db.is_configured = True
                mock_db.client = mock_client

                with patch.object(service, '_update_job_webhook_status', new_callable=AsyncMock):
                    await service.deliver_webhook(
                        job_id='job-123',
                        webhook_url='https://example.com/webhook',
                        payload={'status': 'completed'}
                    )

        # Verify log was inserted
        mock_client.table.assert_called_with('api_webhook_logs')

    @pytest.mark.asyncio
    async def test_skips_logging_when_db_unavailable(self):
        """Does not fail when database is unavailable."""
        service = WebhookService()

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value='OK')

        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response

        with patch('aiohttp.ClientSession', return_value=mock_session):
            with patch('app.services.webhook_service.db_config') as mock_db:
                mock_db.is_configured = False
                mock_db.client = None

                # Should not raise
                result = await service.deliver_webhook(
                    job_id='job-123',
                    webhook_url='https://example.com/webhook',
                    payload={'status': 'completed'}
                )

        assert result is True


class TestJobStatusUpdate:
    """Test job webhook status updates."""

    @pytest.mark.asyncio
    async def test_updates_job_on_success(self):
        """Updates job record with delivery success."""
        service = WebhookService()

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value='OK')

        mock_session = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value = mock_response

        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock()
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

        with patch('aiohttp.ClientSession', return_value=mock_session):
            with patch('app.services.webhook_service.db_config') as mock_db:
                mock_db.is_configured = True
                mock_db.client = mock_client

                await service.deliver_webhook(
                    job_id='job-123',
                    webhook_url='https://example.com/webhook',
                    payload={'status': 'completed'}
                )

        # Verify job update was called
        update_calls = [
            call for call in mock_client.table.return_value.update.call_args_list
        ]
        assert len(update_calls) > 0


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
