"""
Webhook service verification tests.

Verifies HMAC signature generation/verification and delivery logic
still work correctly after auth changes.
"""
import pytest
from app.services.webhook_service import WebhookService


class TestWebhookSignature:
    """Test HMAC-SHA256 signature generation and verification."""

    def setup_method(self):
        self.service = WebhookService()
        self.secret = "test-webhook-secret-12345"
        self.timestamp = "2026-02-24T12:00:00"
        self.payload = {
            "job_id": "abc-123",
            "status": "completed",
            "result": {"template_name": "Invoice", "fields_extracted": 5}
        }

    def test_signature_generation_is_deterministic(self):
        """Same inputs should produce the same signature."""
        sig1 = self.service._generate_signature(self.payload, self.secret, self.timestamp)
        sig2 = self.service._generate_signature(self.payload, self.secret, self.timestamp)
        assert sig1 == sig2

    def test_signature_starts_with_sha256_prefix(self):
        """Signature format should be 'sha256=<hex>'."""
        sig = self.service._generate_signature(self.payload, self.secret, self.timestamp)
        assert sig.startswith("sha256=")
        hex_part = sig.split("=", 1)[1]
        assert len(hex_part) == 64  # SHA-256 hex digest

    def test_verify_signature_accepts_valid(self):
        """verify_signature should return True for a valid signature."""
        sig = self.service._generate_signature(self.payload, self.secret, self.timestamp)
        assert WebhookService.verify_signature(
            self.payload, self.secret, self.timestamp, sig
        ) is True

    def test_verify_signature_rejects_wrong_secret(self):
        """verify_signature should return False when secret doesn't match."""
        sig = self.service._generate_signature(self.payload, self.secret, self.timestamp)
        assert WebhookService.verify_signature(
            self.payload, "wrong-secret", self.timestamp, sig
        ) is False

    def test_verify_signature_rejects_tampered_payload(self):
        """verify_signature should return False when payload is tampered."""
        sig = self.service._generate_signature(self.payload, self.secret, self.timestamp)
        tampered = {**self.payload, "status": "failed"}
        assert WebhookService.verify_signature(
            tampered, self.secret, self.timestamp, sig
        ) is False

    def test_verify_signature_rejects_wrong_timestamp(self):
        """verify_signature should return False when timestamp doesn't match."""
        sig = self.service._generate_signature(self.payload, self.secret, self.timestamp)
        assert WebhookService.verify_signature(
            self.payload, self.secret, "2026-02-24T13:00:00", sig
        ) is False

    def test_signature_is_order_independent(self):
        """Signature uses sort_keys so field order shouldn't matter."""
        payload_a = {"b": 2, "a": 1}
        payload_b = {"a": 1, "b": 2}
        sig_a = self.service._generate_signature(payload_a, self.secret, self.timestamp)
        sig_b = self.service._generate_signature(payload_b, self.secret, self.timestamp)
        # sort_keys=True means both should produce the same signature
        assert sig_a == sig_b
