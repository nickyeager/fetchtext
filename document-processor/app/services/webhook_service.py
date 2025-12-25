"""
Webhook Delivery Service

Handles async delivery of webhook notifications with:
- HMAC-SHA256 signature verification
- Exponential backoff retry logic
- Delivery tracking and logging
"""

import asyncio
import hashlib
import hmac
import json
import logging
import sys
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

import aiohttp

from ..config.database import db_config

# Safe logger initialization
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


class WebhookService:
    """
    Service for delivering webhook notifications to third-party endpoints.

    Features:
    - HMAC-SHA256 payload signing
    - Configurable retry with exponential backoff
    - Delivery logging for debugging
    - Timeout handling
    """

    def __init__(
        self,
        default_timeout: int = 30,
        default_max_retries: int = 3
    ):
        """
        Initialize webhook service.

        Args:
            default_timeout: Default HTTP timeout in seconds
            default_max_retries: Default maximum retry attempts
        """
        self.default_timeout = default_timeout
        self.default_max_retries = default_max_retries

    async def deliver_webhook(
        self,
        job_id: str,
        webhook_url: str,
        payload: Dict[str, Any],
        webhook_secret: Optional[str] = None,
        max_retries: Optional[int] = None,
        timeout: Optional[int] = None
    ) -> bool:
        """
        Deliver webhook payload to callback URL with retries.

        Args:
            job_id: Job ID for tracking
            webhook_url: Destination URL
            payload: JSON payload to deliver
            webhook_secret: Secret for HMAC signature (optional)
            max_retries: Max retry attempts (default: 3)
            timeout: HTTP timeout in seconds (default: 30)

        Returns:
            True if delivery succeeded, False otherwise
        """
        max_retries = max_retries or self.default_max_retries
        timeout = timeout or self.default_timeout

        # Build headers
        delivery_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat()

        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'FetchText-Webhook/1.0',
            'X-FetchText-Event': 'job.completed',
            'X-FetchText-Job-ID': job_id,
            'X-FetchText-Delivery-ID': delivery_id,
            'X-FetchText-Timestamp': timestamp
        }

        # Add HMAC signature if secret provided
        if webhook_secret:
            signature = self._generate_signature(payload, webhook_secret, timestamp)
            headers['X-FetchText-Signature'] = signature

        payload_json = json.dumps(payload)

        # Attempt delivery with retries
        for attempt in range(max_retries):
            attempt_number = attempt + 1
            start_time = datetime.utcnow()

            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        webhook_url,
                        headers=headers,
                        data=payload_json,
                        timeout=aiohttp.ClientTimeout(total=timeout)
                    ) as response:
                        response_body = await response.text()
                        response_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

                        if 200 <= response.status < 300:
                            logger.info(
                                f"Webhook delivered successfully to {webhook_url} "
                                f"(attempt {attempt_number}, status {response.status})"
                            )

                            # Log successful delivery
                            await self._log_delivery(
                                job_id=job_id,
                                attempt_number=attempt_number,
                                callback_url=webhook_url,
                                request_headers=headers,
                                request_payload=payload,
                                response_status_code=response.status,
                                response_body=response_body[:1000],  # Truncate
                                success=True,
                                response_time_ms=response_time_ms
                            )

                            # Update job record
                            await self._update_job_webhook_status(
                                job_id=job_id,
                                attempts=attempt_number,
                                delivered=True
                            )

                            return True

                        else:
                            logger.warning(
                                f"Webhook delivery failed with status {response.status} "
                                f"(attempt {attempt_number})"
                            )

                            # Log failed attempt
                            await self._log_delivery(
                                job_id=job_id,
                                attempt_number=attempt_number,
                                callback_url=webhook_url,
                                request_headers=headers,
                                request_payload=payload,
                                response_status_code=response.status,
                                response_body=response_body[:1000],
                                success=False,
                                error_message=f"HTTP {response.status}",
                                response_time_ms=response_time_ms
                            )

            except asyncio.TimeoutError:
                logger.warning(f"Webhook delivery timeout (attempt {attempt_number})")
                await self._log_delivery(
                    job_id=job_id,
                    attempt_number=attempt_number,
                    callback_url=webhook_url,
                    request_headers=headers,
                    request_payload=payload,
                    success=False,
                    error_message=f"Timeout after {timeout}s"
                )

            except aiohttp.ClientError as e:
                logger.warning(f"Webhook delivery client error: {e} (attempt {attempt_number})")
                await self._log_delivery(
                    job_id=job_id,
                    attempt_number=attempt_number,
                    callback_url=webhook_url,
                    request_headers=headers,
                    request_payload=payload,
                    success=False,
                    error_message=f"Client error: {str(e)}"
                )

            except Exception as e:
                logger.error(f"Webhook delivery error: {e} (attempt {attempt_number})", exc_info=True)
                await self._log_delivery(
                    job_id=job_id,
                    attempt_number=attempt_number,
                    callback_url=webhook_url,
                    request_headers=headers,
                    request_payload=payload,
                    success=False,
                    error_message=f"Error: {str(e)}"
                )

            # Exponential backoff between retries (1s, 2s, 4s, ...)
            if attempt < max_retries - 1:
                delay = 2 ** attempt
                logger.info(f"Retrying webhook in {delay}s...")
                await asyncio.sleep(delay)

        # All retries exhausted
        logger.error(f"Webhook delivery failed after {max_retries} attempts to {webhook_url}")

        await self._update_job_webhook_status(
            job_id=job_id,
            attempts=max_retries,
            delivered=False,
            error_message=f"Delivery failed after {max_retries} attempts"
        )

        return False

    def _generate_signature(
        self,
        payload: Dict[str, Any],
        secret: str,
        timestamp: str
    ) -> str:
        """
        Generate HMAC-SHA256 signature for webhook payload.

        The signature covers both the payload and timestamp to prevent replay attacks.

        Args:
            payload: JSON payload
            secret: HMAC secret
            timestamp: ISO format timestamp

        Returns:
            Signature in format 'sha256=<hex_digest>'
        """
        # Include timestamp in signature to prevent replay
        message = f"{timestamp}.{json.dumps(payload, sort_keys=True)}"
        signature = hmac.new(
            secret.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return f"sha256={signature}"

    async def _log_delivery(
        self,
        job_id: str,
        attempt_number: int,
        callback_url: str,
        request_headers: Dict[str, str],
        request_payload: Dict[str, Any],
        success: bool,
        response_status_code: Optional[int] = None,
        response_body: Optional[str] = None,
        error_message: Optional[str] = None,
        response_time_ms: Optional[int] = None
    ) -> None:
        """Log webhook delivery attempt to database."""
        if not db_config.is_configured or not db_config.client:
            logger.debug("Database not configured - skipping webhook log")
            return

        try:
            # Remove sensitive headers from log
            safe_headers = {k: v for k, v in request_headers.items()
                          if k not in ['X-FetchText-Signature']}

            db_config.client.table('api_webhook_logs').insert({
                'job_id': job_id,
                'attempt_number': attempt_number,
                'callback_url': callback_url,
                'request_headers': safe_headers,
                'request_payload': request_payload,
                'response_status_code': response_status_code,
                'response_body': response_body,
                'success': success,
                'error_message': error_message,
                'response_time_ms': response_time_ms
            }).execute()

        except Exception as e:
            logger.warning(f"Failed to log webhook delivery: {e}")

    async def _update_job_webhook_status(
        self,
        job_id: str,
        attempts: int,
        delivered: bool,
        error_message: Optional[str] = None
    ) -> None:
        """Update job record with webhook delivery status."""
        if not db_config.is_configured or not db_config.client:
            return

        try:
            update_data = {
                'webhook_attempts': attempts,
                'webhook_last_attempt_at': datetime.utcnow().isoformat()
            }

            if delivered:
                update_data['webhook_delivered_at'] = datetime.utcnow().isoformat()
            elif error_message:
                update_data['error_message'] = error_message

            db_config.client.table('api_jobs').update(update_data).eq('id', job_id).execute()

        except Exception as e:
            logger.warning(f"Failed to update job webhook status: {e}")

    @staticmethod
    def verify_signature(
        payload: Dict[str, Any],
        secret: str,
        timestamp: str,
        signature: str
    ) -> bool:
        """
        Verify webhook signature (for client-side verification).

        This is a utility method that third-party clients can use to verify
        incoming webhooks from FetchText.

        Args:
            payload: Received JSON payload
            secret: Your webhook secret
            timestamp: Value from X-FetchText-Timestamp header
            signature: Value from X-FetchText-Signature header

        Returns:
            True if signature is valid
        """
        message = f"{timestamp}.{json.dumps(payload, sort_keys=True)}"
        expected = hmac.new(
            secret.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        expected_signature = f"sha256={expected}"

        return hmac.compare_digest(signature, expected_signature)


# Global singleton instance
webhook_service = WebhookService()
