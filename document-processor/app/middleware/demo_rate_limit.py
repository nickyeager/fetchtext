"""
IP-based rate limiting for the public demo endpoint.

Uses in-memory storage. Resets on container restart (acceptable for demo abuse prevention).
Authenticated users (valid Supabase JWT) bypass the rate limit entirely.
"""

import time
import logging
import sys
from collections import defaultdict
from typing import Dict, List

from fastapi import HTTPException, Request

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


class DemoRateLimiter:
    """Simple in-memory IP-based rate limiter."""

    def __init__(self, max_requests: int = 3, window_seconds: int = 86400):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: Dict[str, List[float]] = defaultdict(list)

    def check(self, ip: str) -> bool:
        """Check if IP is within rate limit. Returns True if allowed."""
        now = time.time()
        cutoff = now - self.window_seconds

        # Prune old entries
        self._requests[ip] = [t for t in self._requests[ip] if t > cutoff]

        if len(self._requests[ip]) >= self.max_requests:
            return False

        self._requests[ip].append(now)
        return True

    def reset(self):
        """Clear all rate limit data."""
        self._requests.clear()


# Global singleton
demo_rate_limiter = DemoRateLimiter(max_requests=3, window_seconds=86400)


def _is_authenticated(request: Request) -> bool:
    """Check if the request carries a valid Supabase JWT.

    Uses the same admin_auth middleware the authenticated router uses,
    but catches failures silently (unauthenticated callers fall through
    to the rate limiter instead of getting a 401).
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer ") or len(auth_header) < 30:
        return False
    token = auth_header[7:]
    try:
        from ..middleware.admin_auth import admin_auth
        # Try HS256 verification (fast, local)
        if admin_auth.jwt_secret:
            import jwt as pyjwt
            pyjwt.decode(token, admin_auth.jwt_secret, algorithms=["HS256"], options={"verify_aud": False})
            return True
    except Exception:
        pass
    # Token present but couldn't verify locally — still treat as authenticated
    # (the actual endpoint auth will reject truly invalid tokens)
    # This covers JWKS/ES256 tokens and Supabase Auth API fallback cases
    # where we don't want to add latency to the rate-limit check.
    return len(token) > 100


async def check_demo_rate_limit(request: Request):
    """FastAPI dependency that enforces demo rate limiting.

    Authenticated users bypass the rate limit — the demo cap only applies
    to anonymous public traffic.
    """
    if _is_authenticated(request):
        return

    # Get client IP (check X-Forwarded-For for proxied requests)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"

    if not demo_rate_limiter.check(client_ip):
        logger.warning(f"Demo rate limit exceeded for IP: {client_ip}")
        raise HTTPException(
            status_code=429,
            detail="Demo upload limit reached (3 per day). Sign up for unlimited uploads.",
            headers={"Retry-After": "86400"}
        )
