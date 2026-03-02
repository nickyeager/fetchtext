"""Tests for demo endpoint IP-based rate limiting."""
import pytest
from app.middleware.demo_rate_limit import DemoRateLimiter


def test_allows_first_three_requests():
    limiter = DemoRateLimiter(max_requests=3, window_seconds=86400)
    for _ in range(3):
        assert limiter.check("192.168.1.1") is True


def test_blocks_fourth_request():
    limiter = DemoRateLimiter(max_requests=3, window_seconds=86400)
    for _ in range(3):
        limiter.check("192.168.1.1")
    assert limiter.check("192.168.1.1") is False


def test_different_ips_independent():
    limiter = DemoRateLimiter(max_requests=3, window_seconds=86400)
    for _ in range(3):
        limiter.check("192.168.1.1")
    # Different IP should still be allowed
    assert limiter.check("192.168.1.2") is True


def test_reset_clears_all():
    limiter = DemoRateLimiter(max_requests=3, window_seconds=86400)
    for _ in range(3):
        limiter.check("192.168.1.1")
    limiter.reset()
    assert limiter.check("192.168.1.1") is True
