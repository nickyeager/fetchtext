"""Tests for DocumentEventBus service."""
import pytest
from app.services.document_event_bus import DocumentEventBus, DocumentEvent


def test_document_event_schema():
    """DocumentEvent dataclass has required fields."""
    event = DocumentEvent(
        event_type="document.processed",
        organization_id="org-123",
        data={"document_id": "doc-456", "extracted_fields": {"vendor": "Acme"}},
    )
    assert event.event_type == "document.processed"
    assert event.organization_id == "org-123"
    assert event.data["document_id"] == "doc-456"
    assert event.timestamp is not None
    assert event.event_id is not None


def test_event_to_payload():
    """DocumentEvent serializes to webhook-compatible dict."""
    event = DocumentEvent(
        event_type="document.processed",
        organization_id="org-123",
        data={"document_id": "doc-456"},
    )
    payload = event.to_payload()
    assert payload["event"] == "document.processed"
    assert payload["organization_id"] == "org-123"
    assert payload["data"]["document_id"] == "doc-456"
    assert "timestamp" in payload
    assert "event_id" in payload


VALID_EVENTS = [
    "document.uploaded",
    "document.processed",
    "document.fields_extracted",
    "document.generated",
    "template.matched",
    "template.auto_created",
]


@pytest.mark.parametrize("event_type", VALID_EVENTS)
def test_valid_event_types(event_type):
    """All defined event types are accepted."""
    event = DocumentEvent(
        event_type=event_type,
        organization_id="org-123",
        data={},
    )
    assert event.event_type == event_type
