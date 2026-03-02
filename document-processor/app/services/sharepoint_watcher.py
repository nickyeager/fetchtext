"""
SharePoint watch folder poller — background task that checks watched folders
for new/modified documents and auto-imports them.

Runs as an asyncio background task started on app startup.
Uses Graph API delta queries for efficient change detection.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from ..config.database import db_config
from ..services.sharepoint_service import SharePointService
from ..services.integrations.oauth_manager import OAuthManager
from ..services.document_event_bus import document_event_bus

logger = logging.getLogger(__name__)

POLL_CHECK_INTERVAL = 60  # Check all watches every 60 seconds
MAX_FILES_PER_POLL = 20   # Don't process more than 20 files at once


async def _get_active_watches():
    """Fetch all active watches from the database."""
    result = db_config.client.table("sharepoint_watches") \
        .select("*") \
        .eq("is_active", True) \
        .execute()
    return result.data or []


async def _poll_watch(watch: dict) -> None:
    """Poll a single watch for changes."""
    org_id = watch["organization_id"]
    watch_id = watch["id"]

    try:
        token = await OAuthManager.get_access_token(
            organization_id=org_id,
            integration_type="microsoft",
            auto_refresh=True,
        )
        if not token:
            logger.warning(f"[Watcher] No Microsoft token for org {org_id}, skipping watch {watch_id}")
            return

        sp = SharePointService(access_token=token)

        # Use delta query if we have a delta link, otherwise get initial delta
        delta_link = watch.get("last_change_token")
        result = await sp.get_delta(
            drive_id=watch["drive_id"],
            folder_id=watch["folder_id"],
            delta_link=delta_link,
        )

        new_files = [item for item in result.items if sp.is_processable(item.name)]

        if new_files:
            logger.info(f"[Watcher] Found {len(new_files)} new files in watch {watch_id}")

            for file_item in new_files[:MAX_FILES_PER_POLL]:
                try:
                    _content, metadata = await sp.download_file(watch["drive_id"], file_item.id)

                    await document_event_bus.emit(
                        event_type="document.uploaded",
                        organization_id=org_id,
                        data={
                            "filename": file_item.name,
                            "source": "sharepoint_watch",
                            "watch_id": watch_id,
                            "drive_id": watch["drive_id"],
                            "item_id": file_item.id,
                            "size": file_item.size,
                        },
                    )
                    logger.info(f"[Watcher] Imported {file_item.name} from watch {watch_id}")
                except Exception as e:
                    logger.error(f"[Watcher] Failed to import {file_item.name}: {e}")

        # Update watch with new delta link and poll timestamp
        updates = {
            "last_polled_at": datetime.now(timezone.utc).isoformat(),
            "consecutive_failures": 0,
        }
        if result.delta_link:
            updates["last_change_token"] = result.delta_link

        db_config.client.table("sharepoint_watches") \
            .update(updates) \
            .eq("id", watch_id) \
            .execute()

    except Exception as e:
        logger.error(f"[Watcher] Poll failed for watch {watch_id}: {e}")

        # Increment failure count
        try:
            current = db_config.client.table("sharepoint_watches") \
                .select("consecutive_failures") \
                .eq("id", watch_id) \
                .single() \
                .execute()
            failures = (current.data.get("consecutive_failures", 0) or 0) + 1
            db_config.client.table("sharepoint_watches") \
                .update({"consecutive_failures": failures, "last_error": str(e)}) \
                .eq("id", watch_id) \
                .execute()
        except Exception as update_err:
            logger.error(f"[Watcher] Failed to update failure count: {update_err}")


async def poll_loop():
    """Main polling loop — runs forever as a background task."""
    logger.info("[Watcher] SharePoint watch poller started")

    while True:
        try:
            watches = await _get_active_watches()

            now = datetime.now(timezone.utc)
            for watch in watches:
                last_polled = watch.get("last_polled_at")
                interval = watch.get("poll_interval_minutes", 15)

                if last_polled:
                    # Parse ISO timestamp — handles both Z suffix and +00:00
                    last_dt = datetime.fromisoformat(last_polled.replace("Z", "+00:00"))
                    if last_dt.tzinfo is None:
                        last_dt = last_dt.replace(tzinfo=timezone.utc)
                    elapsed = (now - last_dt).total_seconds() / 60
                    if elapsed < interval:
                        continue

                await _poll_watch(watch)

        except Exception as e:
            logger.error(f"[Watcher] Poll loop error: {e}", exc_info=True)

        await asyncio.sleep(POLL_CHECK_INTERVAL)


_poller_task: Optional[asyncio.Task] = None


def start_poller():
    """Start the background poller (call from app startup)."""
    global _poller_task
    _poller_task = asyncio.create_task(poll_loop())
    logger.info("[Watcher] Background poller task created")


def stop_poller():
    """Stop the background poller."""
    global _poller_task
    if _poller_task:
        _poller_task.cancel()
        _poller_task = None
