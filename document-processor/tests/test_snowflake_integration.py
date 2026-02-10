"""
Snowflake Integration Tests

Requires a real Snowflake account with test data in a stage.
Set these environment variables before running:

  SNOWFLAKE_TEST_ACCOUNT     - Snowflake account identifier (e.g., xy12345.us-east-1)
  SNOWFLAKE_TEST_USER        - Snowflake username
  SNOWFLAKE_TEST_PRIVATE_KEY_PATH - Path to PEM private key file
  SNOWFLAKE_TEST_WAREHOUSE   - Warehouse name (e.g., COMPUTE_WH)
  SNOWFLAKE_TEST_DATABASE    - Database containing test stage
  SNOWFLAKE_TEST_SCHEMA      - Schema containing test stage
  SNOWFLAKE_TEST_STAGE       - Stage name with test files (PDF, CSV, PNG)

Usage:
  cd document-processor
  pytest tests/test_snowflake_integration.py -v
"""

import os
import pytest
import httpx

# Backend URL
BACKEND_URL = os.getenv("DOCUMENT_PROCESSOR_URL", "http://localhost:8090")

# Test configuration from environment
SNOWFLAKE_TEST_ACCOUNT = os.getenv("SNOWFLAKE_TEST_ACCOUNT", "")
SNOWFLAKE_TEST_USER = os.getenv("SNOWFLAKE_TEST_USER", "")
SNOWFLAKE_TEST_PRIVATE_KEY_PATH = os.getenv("SNOWFLAKE_TEST_PRIVATE_KEY_PATH", "")
SNOWFLAKE_TEST_WAREHOUSE = os.getenv("SNOWFLAKE_TEST_WAREHOUSE", "")
SNOWFLAKE_TEST_DATABASE = os.getenv("SNOWFLAKE_TEST_DATABASE", "")
SNOWFLAKE_TEST_SCHEMA = os.getenv("SNOWFLAKE_TEST_SCHEMA", "")
SNOWFLAKE_TEST_STAGE = os.getenv("SNOWFLAKE_TEST_STAGE", "")

# Organization ID for testing (must exist in the database)
TEST_ORG_ID = os.getenv("TEST_ORGANIZATION_ID", "00000000-0000-0000-0000-000000000010")

# Check if Snowflake test environment is configured
SNOWFLAKE_CONFIGURED = all([
    SNOWFLAKE_TEST_ACCOUNT,
    SNOWFLAKE_TEST_USER,
    SNOWFLAKE_TEST_PRIVATE_KEY_PATH,
    SNOWFLAKE_TEST_WAREHOUSE,
])

skip_if_not_configured = pytest.mark.skipif(
    not SNOWFLAKE_CONFIGURED,
    reason="Snowflake test environment not configured. Set SNOWFLAKE_TEST_* env vars."
)


def _read_private_key() -> str:
    """Read the test private key from file."""
    if not SNOWFLAKE_TEST_PRIVATE_KEY_PATH:
        raise ValueError("SNOWFLAKE_TEST_PRIVATE_KEY_PATH not set")
    with open(SNOWFLAKE_TEST_PRIVATE_KEY_PATH, "r") as f:
        return f.read()


@pytest.fixture(scope="session")
def backend_available():
    """Verify the document-processor backend is running."""
    try:
        response = httpx.get(f"{BACKEND_URL}/health", timeout=5.0)
        if response.status_code != 200:
            raise RuntimeError(f"Backend unhealthy: {response.status_code}")
        return True
    except Exception as e:
        raise RuntimeError(
            f"Backend not available at {BACKEND_URL}: {e}. "
            "Start with: docker compose -p localai up -d --build document-processor"
        )


class TestRegistryAndCredentials:
    """Test that Snowflake appears in the integration registry with dual auth mode."""

    def test_snowflake_in_registry(self, backend_available):
        """Snowflake must appear in the integration list with auth_mode=dual."""
        response = httpx.get(f"{BACKEND_URL}/api/integrations/")
        assert response.status_code == 200

        integrations = response.json()
        snowflake = next((i for i in integrations if i["id"] == "snowflake"), None)
        assert snowflake is not None, "Snowflake not found in integrations list"
        assert snowflake["auth_mode"] == "dual"
        assert snowflake["configured"] is True
        assert "credential_fields" in snowflake
        assert len(snowflake["credential_fields"]) >= 4
        # Dual mode should include auth_modes list
        assert "auth_modes" in snowflake
        assert snowflake["auth_modes"] == ["credential", "oauth"]

    def test_snowflake_detail(self, backend_available):
        """Snowflake detail endpoint returns credential_fields and auth_modes."""
        response = httpx.get(f"{BACKEND_URL}/api/integrations/snowflake")
        assert response.status_code == 200

        data = response.json()
        assert data["auth_mode"] == "dual"
        assert data["credential_fields"] is not None
        assert data["auth_modes"] == ["credential", "oauth"]

        field_names = [f["name"] for f in data["credential_fields"]]
        assert "account_identifier" in field_names
        assert "username" in field_names
        assert "private_key" in field_names
        assert "warehouse" in field_names

    def test_existing_integrations_unchanged(self, backend_available):
        """Existing OAuth integrations must still work correctly."""
        response = httpx.get(f"{BACKEND_URL}/api/integrations/")
        assert response.status_code == 200

        integrations = response.json()
        google = next((i for i in integrations if i["id"] == "google"), None)
        assert google is not None
        assert google["auth_mode"] == "oauth"
        assert "credential_fields" not in google or google.get("credential_fields") is None
        # Pure OAuth integrations should not have auth_modes set
        assert not google.get("auth_modes")

    @skip_if_not_configured
    def test_connect_with_credentials(self, backend_available):
        """Connecting with valid credentials stores them and creates integration record."""
        private_key = _read_private_key()

        response = httpx.post(
            f"{BACKEND_URL}/api/integrations/snowflake/connect-credentials",
            json={
                "organization_id": TEST_ORG_ID,
                "credentials": {
                    "account_identifier": SNOWFLAKE_TEST_ACCOUNT,
                    "username": SNOWFLAKE_TEST_USER,
                    "private_key": private_key,
                    "warehouse": SNOWFLAKE_TEST_WAREHOUSE,
                    "database": SNOWFLAKE_TEST_DATABASE or "",
                    "role": "",
                },
            },
            timeout=30.0,
        )
        assert response.status_code == 200

        data = response.json()
        assert data["success"] is True
        assert data["metadata"]["account_identifier"] == SNOWFLAKE_TEST_ACCOUNT

    def test_connect_rejects_missing_fields(self, backend_available):
        """Connecting without required fields must fail with 422."""
        response = httpx.post(
            f"{BACKEND_URL}/api/integrations/snowflake/connect-credentials",
            json={
                "organization_id": "test-org",
                "credentials": {
                    "account_identifier": "test",
                    # Missing username, private_key, warehouse
                },
            },
            timeout=10.0,
        )
        assert response.status_code == 422

    def test_connect_rejects_oauth_integration(self, backend_available):
        """Connecting with credentials on an OAuth integration must fail."""
        response = httpx.post(
            f"{BACKEND_URL}/api/integrations/google/connect-credentials",
            json={
                "organization_id": "test-org",
                "credentials": {"key": "value"},
            },
            timeout=10.0,
        )
        assert response.status_code == 400


class TestSnowflakeOAuthInitiation:
    """Test the per-account OAuth initiation endpoint."""

    def test_initiate_with_account_validates_org(self, backend_available):
        """POST initiate-with-account returns 400 for non-existent organization."""
        # Use a valid UUID format that doesn't exist in the DB
        test_org_id = "00000000-0000-0000-0000-000000000098"
        response = httpx.post(
            f"{BACKEND_URL}/api/integrations/snowflake/oauth/initiate-with-account",
            json={
                "organization_id": test_org_id,
                "account_identifier": "testaccount-test123",
                "client_id": "test-client-id",
                "client_secret": "test-client-secret",
                "redirect_uri": f"{BACKEND_URL}/api/integrations/snowflake/oauth/callback",
            },
            timeout=10.0,
        )
        # The endpoint validates org exists in DB - returns 400 for non-existent org
        assert response.status_code == 400
        data = response.json()
        assert "not found" in data["detail"].lower()

    def test_initiate_rejects_non_oauth_integration(self, backend_available):
        """POST initiate-with-account on a pure OAuth integration without template should fail."""
        # Google uses standard OAuth, not per-account
        response = httpx.post(
            f"{BACKEND_URL}/api/integrations/google/oauth/initiate-with-account",
            json={
                "organization_id": "test-org",
                "account_identifier": "test",
                "client_id": "test",
                "client_secret": "test",
                "redirect_uri": "http://localhost:8090/callback",
            },
            timeout=10.0,
        )
        assert response.status_code == 400

    def test_initiate_rejects_invalid_integration(self, backend_available):
        """POST initiate-with-account for non-existent integration returns 404."""
        response = httpx.post(
            f"{BACKEND_URL}/api/integrations/nonexistent/oauth/initiate-with-account",
            json={
                "organization_id": "test-org",
                "account_identifier": "test",
                "client_id": "test",
                "client_secret": "test",
                "redirect_uri": "http://localhost:8090/callback",
            },
            timeout=10.0,
        )
        assert response.status_code == 404


@skip_if_not_configured
class TestSnowflakeStageBrowsing:
    """Test browsing Snowflake stages (requires real connection)."""

    @pytest.fixture(autouse=True)
    def setup(self, backend_available):
        """Ensure credentials are stored before browsing tests."""
        private_key = _read_private_key()
        httpx.post(
            f"{BACKEND_URL}/api/integrations/snowflake/connect-credentials",
            json={
                "organization_id": TEST_ORG_ID,
                "credentials": {
                    "account_identifier": SNOWFLAKE_TEST_ACCOUNT,
                    "username": SNOWFLAKE_TEST_USER,
                    "private_key": private_key,
                    "warehouse": SNOWFLAKE_TEST_WAREHOUSE,
                    "database": SNOWFLAKE_TEST_DATABASE or "",
                    "role": "",
                },
            },
            timeout=30.0,
        )

    def test_connection(self):
        """Test connection returns account info."""
        response = httpx.get(
            f"{BACKEND_URL}/api/snowflake/test",
            params={"organization_id": TEST_ORG_ID},
            timeout=30.0,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "user_info" in data
        assert data["user_info"]["account"] is not None

    def test_list_databases(self):
        """List databases returns at least one database."""
        response = httpx.get(
            f"{BACKEND_URL}/api/snowflake/databases",
            params={"organization_id": TEST_ORG_ID},
            timeout=30.0,
        )
        assert response.status_code == 200
        data = response.json()
        assert "databases" in data
        assert len(data["databases"]) > 0

    def test_list_schemas(self):
        """List schemas for the test database."""
        if not SNOWFLAKE_TEST_DATABASE:
            pytest.skip("SNOWFLAKE_TEST_DATABASE not set")

        response = httpx.get(
            f"{BACKEND_URL}/api/snowflake/schemas",
            params={
                "organization_id": TEST_ORG_ID,
                "database": SNOWFLAKE_TEST_DATABASE,
            },
            timeout=30.0,
        )
        assert response.status_code == 200
        data = response.json()
        assert "schemas" in data
        assert len(data["schemas"]) > 0

    def test_list_stages(self):
        """List stages in the test schema."""
        if not SNOWFLAKE_TEST_DATABASE or not SNOWFLAKE_TEST_SCHEMA:
            pytest.skip("SNOWFLAKE_TEST_DATABASE/SCHEMA not set")

        response = httpx.get(
            f"{BACKEND_URL}/api/snowflake/stages",
            params={
                "organization_id": TEST_ORG_ID,
                "database": SNOWFLAKE_TEST_DATABASE,
                "schema_name": SNOWFLAKE_TEST_SCHEMA,
            },
            timeout=30.0,
        )
        assert response.status_code == 200
        data = response.json()
        assert "stages" in data

    def test_list_stage_files(self):
        """List files in the test stage."""
        if not SNOWFLAKE_TEST_STAGE:
            pytest.skip("SNOWFLAKE_TEST_STAGE not set")

        stage_name = SNOWFLAKE_TEST_STAGE
        if SNOWFLAKE_TEST_DATABASE and SNOWFLAKE_TEST_SCHEMA:
            stage_name = f"{SNOWFLAKE_TEST_DATABASE}.{SNOWFLAKE_TEST_SCHEMA}.{SNOWFLAKE_TEST_STAGE}"

        response = httpx.get(
            f"{BACKEND_URL}/api/snowflake/stages/{stage_name}/files",
            params={"organization_id": TEST_ORG_ID},
            timeout=30.0,
        )
        assert response.status_code == 200
        data = response.json()
        assert "files" in data

        # Each file should have expected fields
        for file_entry in data["files"]:
            assert "name" in file_entry
            assert "size" in file_entry
            assert "extension" in file_entry
            assert "is_processable" in file_entry
            assert "file_category" in file_entry


@skip_if_not_configured
class TestSnowflakeFileDownload:
    """Test downloading and processing files from stages."""

    @pytest.fixture(autouse=True)
    def setup(self, backend_available):
        """Ensure credentials are stored."""
        private_key = _read_private_key()
        httpx.post(
            f"{BACKEND_URL}/api/integrations/snowflake/connect-credentials",
            json={
                "organization_id": TEST_ORG_ID,
                "credentials": {
                    "account_identifier": SNOWFLAKE_TEST_ACCOUNT,
                    "username": SNOWFLAKE_TEST_USER,
                    "private_key": private_key,
                    "warehouse": SNOWFLAKE_TEST_WAREHOUSE,
                    "database": SNOWFLAKE_TEST_DATABASE or "",
                    "role": "",
                },
            },
            timeout=30.0,
        )

    def _get_stage_name(self):
        if SNOWFLAKE_TEST_DATABASE and SNOWFLAKE_TEST_SCHEMA:
            return f"{SNOWFLAKE_TEST_DATABASE}.{SNOWFLAKE_TEST_SCHEMA}.{SNOWFLAKE_TEST_STAGE}"
        return SNOWFLAKE_TEST_STAGE

    def test_download_and_process(self):
        """Download a file from stage and process it."""
        if not SNOWFLAKE_TEST_STAGE:
            pytest.skip("SNOWFLAKE_TEST_STAGE not set")

        stage_name = self._get_stage_name()

        # First, list files to find one to download
        list_response = httpx.get(
            f"{BACKEND_URL}/api/snowflake/stages/{stage_name}/files",
            params={"organization_id": TEST_ORG_ID},
            timeout=30.0,
        )
        assert list_response.status_code == 200
        files = list_response.json()["files"]

        processable = [f for f in files if f["is_processable"]]
        if not processable:
            pytest.skip("No processable files in test stage")

        # Download and process the first processable file
        test_file = processable[0]
        response = httpx.post(
            f"{BACKEND_URL}/api/snowflake/stages/{stage_name}/download",
            json={
                "organization_id": TEST_ORG_ID,
                "file_path": test_file["full_path"],
                "process_immediately": True,
                "save_to_database": False,
            },
            timeout=120.0,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["processing_status"] == "completed"
        assert data["document_data"] is not None

    def test_download_status(self):
        """Download status endpoint returns correct format."""
        # Test with non-existent job ID
        response = httpx.get(
            f"{BACKEND_URL}/api/snowflake/download-status/non-existent-id",
            timeout=10.0,
        )
        assert response.status_code == 404


class TestSnowflakeEndpointsExist:
    """Verify all Snowflake endpoints are registered (no real connection needed)."""

    def test_endpoints_registered(self, backend_available):
        """All Snowflake REST endpoints must be accessible."""
        # These should return errors for missing params, not 404
        endpoints = [
            ("GET", "/api/snowflake/databases"),
            ("GET", "/api/snowflake/schemas"),
            ("GET", "/api/snowflake/stages"),
            ("GET", "/api/snowflake/stages/test_stage/files"),
            ("GET", "/api/snowflake/test"),
        ]

        for method, path in endpoints:
            if method == "GET":
                response = httpx.get(f"{BACKEND_URL}{path}", timeout=5.0)
            else:
                response = httpx.post(f"{BACKEND_URL}{path}", timeout=5.0)

            # Should NOT be 404 (route not found) - any other error is fine
            assert response.status_code != 404, (
                f"Endpoint {method} {path} returned 404 - route not registered"
            )

    def test_oauth_initiate_endpoint_registered(self, backend_available):
        """Per-account OAuth initiation endpoint must be registered."""
        response = httpx.post(
            f"{BACKEND_URL}/api/integrations/snowflake/oauth/initiate-with-account",
            json={},
            timeout=5.0,
        )
        # Should NOT be 404 - 422 for validation error is expected
        assert response.status_code != 404, (
            "OAuth initiate-with-account endpoint returned 404 - route not registered"
        )
