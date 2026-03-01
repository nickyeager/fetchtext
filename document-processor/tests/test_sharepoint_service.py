"""Unit tests for SharePoint service — Graph API client layer."""
import pytest
from app.services.sharepoint_service import SharePointService, SharePointItem


def test_sharepoint_service_instantiates():
    """Service can be created with an access token."""
    svc = SharePointService(access_token="test-token")
    assert svc.access_token == "test-token"
    assert svc.base_url == "https://graph.microsoft.com/v1.0"


def test_sharepoint_item_dataclass():
    """SharePointItem holds file metadata."""
    item = SharePointItem(
        id="item-123",
        name="invoice.pdf",
        size=1024,
        mime_type="application/pdf",
        web_url="https://contoso.sharepoint.com/invoice.pdf",
        is_folder=False,
        last_modified="2026-02-28T10:00:00Z",
        drive_id="drive-abc",
    )
    assert item.name == "invoice.pdf"
    assert not item.is_folder


@pytest.mark.parametrize("ext,expected", [
    ("invoice.pdf", True),
    ("report.docx", True),
    ("photo.jpg", True),
    ("readme.txt", True),
    ("script.exe", False),
    ("archive.zip", False),
])
def test_is_processable_file(ext, expected):
    """Only document/image files are considered processable."""
    svc = SharePointService(access_token="test")
    assert svc.is_processable(ext) == expected
