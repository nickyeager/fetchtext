"""
Webhook Subscriptions Router

CRUD endpoints for managing outbound webhook subscriptions.
Users configure webhook endpoints that receive document events.
"""

import logging
import sys
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator

from app.config.database import db_config
from app.middleware import admin_auth
from app.services.document_event_bus import EVENT_TYPES
from app.services.webhook_service import webhook_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])


# ── Request/Response Models ──────────────────────────────────────

class WebhookSubscriptionCreate(BaseModel):
    name: str
    url: str
    secret: Optional[str] = None
    events: List[str] = []  # Empty = all events

    @field_validator("events")
    @classmethod
    def validate_events(cls, v: List[str]) -> List[str]:
        for event in v:
            if event not in EVENT_TYPES:
                raise ValueError(
                    f"Invalid event type: {event}. "
                    f"Valid types: {sorted(EVENT_TYPES)}"
                )
        return v


class WebhookSubscriptionUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    secret: Optional[str] = None
    events: Optional[List[str]] = None
    is_active: Optional[bool] = None

    @field_validator("events")
    @classmethod
    def validate_events(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is not None:
            for event in v:
                if event not in EVENT_TYPES:
                    raise ValueError(
                        f"Invalid event type: {event}. "
                        f"Valid types: {sorted(EVENT_TYPES)}"
                    )
        return v


class WebhookSubscriptionResponse(BaseModel):
    id: str
    name: str
    url: str
    events: List[str]
    is_active: bool
    last_triggered_at: Optional[str] = None
    last_status_code: Optional[int] = None
    consecutive_failures: int = 0
    disabled_at: Optional[str] = None
    disabled_reason: Optional[str] = None
    created_at: str


class WebhookTestResponse(BaseModel):
    success: bool
    status_code: Optional[int] = None
    error: Optional[str] = None


# ── Endpoints ────────────────────────────────────────────────────

@router.get("/events", response_model=List[str])
async def list_event_types(
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """List all available event types that can be subscribed to."""
    return sorted(EVENT_TYPES)


@router.get("", response_model=List[WebhookSubscriptionResponse])
async def list_subscriptions(
    organization_id: str = Query(..., description="Organization ID"),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """List all webhook subscriptions for an organization."""
    if not db_config.is_configured or not db_config.client:
        raise HTTPException(status_code=503, detail="Database not configured")

    result = (
        db_config.client.table("webhook_subscriptions")
        .select("id, name, url, events, is_active, last_triggered_at, "
                "last_status_code, consecutive_failures, disabled_at, "
                "disabled_reason, created_at")
        .eq("organization_id", organization_id)
        .order("created_at", desc=True)
        .execute()
    )

    return result.data or []


@router.post("", response_model=WebhookSubscriptionResponse, status_code=201)
async def create_subscription(
    body: WebhookSubscriptionCreate,
    organization_id: str = Query(..., description="Organization ID"),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Create a new webhook subscription."""
    if not db_config.is_configured or not db_config.client:
        raise HTTPException(status_code=503, detail="Database not configured")

    user_id = current_user.get("user_id") or current_user.get("sub")

    insert_data = {
        "organization_id": organization_id,
        "name": body.name,
        "url": body.url,
        "secret": body.secret,
        "events": body.events,
        "is_active": True,
        "created_by": user_id,
    }

    result = (
        db_config.client.table("webhook_subscriptions")
        .insert(insert_data)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create subscription")

    return result.data[0]


@router.patch("/{subscription_id}", response_model=WebhookSubscriptionResponse)
async def update_subscription(
    subscription_id: str,
    body: WebhookSubscriptionUpdate,
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Update a webhook subscription."""
    if not db_config.is_configured or not db_config.client:
        raise HTTPException(status_code=503, detail="Database not configured")

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # If re-enabling, clear disabled state
    if update_data.get("is_active") is True:
        update_data["disabled_at"] = None
        update_data["disabled_reason"] = None
        update_data["consecutive_failures"] = 0

    result = (
        db_config.client.table("webhook_subscriptions")
        .update(update_data)
        .eq("id", subscription_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Subscription not found")

    return result.data[0]


@router.delete("/{subscription_id}", status_code=204)
async def delete_subscription(
    subscription_id: str,
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Delete a webhook subscription."""
    if not db_config.is_configured or not db_config.client:
        raise HTTPException(status_code=503, detail="Database not configured")

    db_config.client.table("webhook_subscriptions").delete().eq(
        "id", subscription_id
    ).execute()


@router.post("/{subscription_id}/test", response_model=WebhookTestResponse)
async def test_subscription(
    subscription_id: str,
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """
    Send a test event to a webhook subscription to verify connectivity.
    Sends a 'webhook.test' event with sample data.
    """
    if not db_config.is_configured or not db_config.client:
        raise HTTPException(status_code=503, detail="Database not configured")

    # Fetch the subscription
    result = (
        db_config.client.table("webhook_subscriptions")
        .select("id, url, secret, name")
        .eq("id", subscription_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Subscription not found")

    sub = result.data
    test_payload = {
        "event": "webhook.test",
        "event_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "organization_id": "test",
        "data": {
            "message": "This is a test event from FetchText",
            "subscription_name": sub["name"],
        },
    }

    try:
        success = await webhook_service.deliver_webhook(
            job_id=test_payload["event_id"],
            webhook_url=sub["url"],
            payload=test_payload,
            webhook_secret=sub.get("secret"),
            max_retries=1,  # Only try once for test
        )
        return WebhookTestResponse(
            success=success,
            status_code=200 if success else None,
            error=None if success else "Endpoint returned non-2xx status or was unreachable",
        )
    except Exception as e:
        return WebhookTestResponse(success=False, error=str(e))
