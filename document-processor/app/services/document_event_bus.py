"""
Document Event Bus

Emits standardized events when documents are processed and delivers them
to user-configured webhook subscriptions. Provides the generic connector
layer that enables integration with any external system (Zapier, Make,
N8N, custom APIs, etc.) via outbound webhooks.

Event flow:
    stream.py (SSE complete) -> event_bus.emit() -> fan-out to webhook_subscriptions -> webhook_service.deliver()
"""

import asyncio
import logging
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from ..config.database import db_config
from .webhook_service import webhook_service

# Safe logger initialization
try:
    logger = logging.getLogger(__name__)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        )
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
except Exception:
    logging.basicConfig(stream=sys.stdout, level=logging.INFO)
    logger = logging.getLogger(__name__)


# Valid event types
EVENT_TYPES = {
    "document.uploaded",
    "document.processed",
    "document.fields_extracted",
    "document.generated",
    "template.matched",
    "template.auto_created",
}

# Auto-disable threshold: after this many consecutive failures, deactivate subscription
MAX_CONSECUTIVE_FAILURES = 10


@dataclass
class DocumentEvent:
    """Standardized event emitted by the document processing pipeline."""

    event_type: str
    organization_id: str
    data: Dict[str, Any]
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_payload(self) -> Dict[str, Any]:
        """Serialize to webhook-delivery-compatible dict."""
        return {
            "event": self.event_type,
            "event_id": self.event_id,
            "timestamp": self.timestamp,
            "organization_id": self.organization_id,
            "data": self.data,
        }


class DocumentEventBus:
    """
    Coordinates event emission and fan-out delivery to webhook subscriptions.

    Usage:
        await document_event_bus.emit(
            event_type="document.processed",
            organization_id="org-123",
            data={"document_id": "doc-456", "extracted_fields": {...}},
        )
    """

    async def emit(
        self,
        event_type: str,
        organization_id: str,
        data: Dict[str, Any],
    ) -> int:
        """
        Emit a document event and deliver to all matching webhook subscriptions.

        Args:
            event_type: One of EVENT_TYPES
            organization_id: Owning organization
            data: Event payload data

        Returns:
            Number of webhook deliveries attempted
        """
        if event_type not in EVENT_TYPES:
            logger.warning(f"Unknown event type: {event_type}")
            return 0

        event = DocumentEvent(
            event_type=event_type,
            organization_id=organization_id,
            data=data,
        )

        logger.info(
            f"[EventBus] Emitting {event_type} for org={organization_id} "
            f"event_id={event.event_id}"
        )

        # Look up active subscriptions for this org
        subscriptions = await self._get_matching_subscriptions(
            organization_id, event_type
        )

        if not subscriptions:
            logger.debug(f"[EventBus] No active subscriptions for {event_type}")
            return 0

        logger.info(
            f"[EventBus] Delivering {event_type} to {len(subscriptions)} subscription(s)"
        )

        # Fan out delivery — fire and forget so we don't block the SSE response
        delivery_count = 0
        for sub in subscriptions:
            asyncio.create_task(
                self._deliver_to_subscription(sub, event)
            )
            delivery_count += 1

        return delivery_count

    async def _get_matching_subscriptions(
        self, organization_id: str, event_type: str
    ) -> List[Dict[str, Any]]:
        """Fetch active webhook subscriptions that match this event."""
        if not db_config.is_configured or not db_config.client:
            logger.debug("[EventBus] Database not configured — skipping")
            return []

        try:
            result = (
                db_config.client.table("webhook_subscriptions")
                .select("id, url, secret, events, name, consecutive_failures")
                .eq("organization_id", organization_id)
                .eq("is_active", True)
                .is_("disabled_at", "null")
                .execute()
            )

            if not result.data:
                return []

            # Filter by event type: empty events array = subscribe to all
            matching = []
            for sub in result.data:
                events = sub.get("events") or []
                if len(events) == 0 or event_type in events:
                    matching.append(sub)

            return matching

        except Exception as e:
            logger.error(f"[EventBus] Failed to fetch subscriptions: {e}")
            return []

    async def _deliver_to_subscription(
        self, subscription: Dict[str, Any], event: DocumentEvent
    ) -> None:
        """Deliver event to a single webhook subscription."""
        sub_id = subscription["id"]
        url = subscription["url"]
        secret = subscription.get("secret")
        name = subscription.get("name", "unnamed")

        try:
            success = await webhook_service.deliver_webhook(
                job_id=event.event_id,
                webhook_url=url,
                payload=event.to_payload(),
                webhook_secret=secret,
            )

            if success:
                await self._record_success(sub_id)
                logger.info(
                    f"[EventBus] Delivered {event.event_type} to '{name}' ({url})"
                )
            else:
                await self._record_failure(sub_id)
                logger.warning(
                    f"[EventBus] Failed to deliver {event.event_type} to '{name}' ({url})"
                )

        except Exception as e:
            logger.error(
                f"[EventBus] Error delivering to '{name}' ({url}): {e}"
            )
            await self._record_failure(sub_id)

    async def _record_success(self, subscription_id: str) -> None:
        """Reset consecutive failures and update last_triggered_at."""
        if not db_config.is_configured or not db_config.client:
            return
        try:
            db_config.client.table("webhook_subscriptions").update(
                {
                    "consecutive_failures": 0,
                    "last_triggered_at": datetime.now(timezone.utc).isoformat(),
                    "last_status_code": 200,
                }
            ).eq("id", subscription_id).execute()
        except Exception as e:
            logger.warning(f"[EventBus] Failed to record success: {e}")

    async def _record_failure(self, subscription_id: str) -> None:
        """Increment consecutive failures; auto-disable if threshold exceeded."""
        if not db_config.is_configured or not db_config.client:
            return
        try:
            # Fetch current count
            result = (
                db_config.client.table("webhook_subscriptions")
                .select("consecutive_failures")
                .eq("id", subscription_id)
                .single()
                .execute()
            )
            current = (result.data or {}).get("consecutive_failures", 0)
            new_count = current + 1

            update_data: Dict[str, Any] = {
                "consecutive_failures": new_count,
                "last_triggered_at": datetime.now(timezone.utc).isoformat(),
            }

            # Auto-disable after MAX_CONSECUTIVE_FAILURES
            if new_count >= MAX_CONSECUTIVE_FAILURES:
                update_data["disabled_at"] = datetime.now(timezone.utc).isoformat()
                update_data["disabled_reason"] = (
                    f"Auto-disabled after {MAX_CONSECUTIVE_FAILURES} consecutive failures"
                )
                update_data["is_active"] = False
                logger.warning(
                    f"[EventBus] Auto-disabled subscription {subscription_id} "
                    f"after {MAX_CONSECUTIVE_FAILURES} failures"
                )

            db_config.client.table("webhook_subscriptions").update(
                update_data
            ).eq("id", subscription_id).execute()

        except Exception as e:
            logger.warning(f"[EventBus] Failed to record failure: {e}")


# Global singleton
document_event_bus = DocumentEventBus()
