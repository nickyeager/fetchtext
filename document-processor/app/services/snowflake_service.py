"""
Snowflake Service

Connects to Snowflake using Key-Pair or OAuth authentication,
browses stages/files, and downloads files via pre-signed URLs.
"""

import asyncio
import logging
import tempfile
import os
from typing import Optional, Dict, Any, List, Callable, TypeVar
from pathlib import Path

T = TypeVar("T")

import httpx

from .vault_service import vault_service
from .integrations.oauth_manager import OAuthManager
from ..config.database import db_config

logger = logging.getLogger(__name__)

# Snowflake identifier validation: alphanumeric, underscores, dots (for db.schema.stage)
import re
_SAFE_IDENTIFIER = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$')


def _validate_identifier(name: str, label: str = "identifier") -> str:
    """Validate a Snowflake identifier to prevent SQL injection."""
    if not name or not _SAFE_IDENTIFIER.match(name):
        raise ValueError(
            f"Invalid Snowflake {label}: '{name}'. "
            "Only alphanumeric characters, underscores, and dots are allowed."
        )
    return name


# File extensions that can be processed by Docling
DOCLING_EXTENSIONS = {
    ".pdf", ".docx", ".doc", ".pptx", ".ppt",
    ".xlsx", ".xls", ".html", ".htm",
    ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".gif",
    ".txt", ".md", ".rtf",
}

# Data file extensions that need conversion before processing
DATA_EXTENSIONS = {".csv", ".json", ".jsonl", ".parquet", ".avro"}

# All processable extensions
PROCESSABLE_EXTENSIONS = DOCLING_EXTENSIONS | DATA_EXTENSIONS


class SnowflakeService:
    """Service for connecting to Snowflake and browsing stages."""

    def __init__(self):
        self._connections: Dict[str, Any] = {}

    # Credential fields stored in Vault (looked up by deterministic name)
    VAULT_CREDENTIAL_FIELDS = [
        "account_identifier", "username", "private_key", "warehouse", "database",
    ]

    async def _get_credentials(self, organization_id: str) -> Dict[str, str]:
        """Retrieve Snowflake credentials from Vault for an organization.

        Uses deterministic name-based vault lookup instead of stored vault IDs,
        which eliminates stale-ID failures after vault upsert cycles.
        """
        if not db_config.client:
            raise RuntimeError("Database not configured")

        result = db_config.client.table("organization_integrations").select(
            "metadata"
        ).eq("organization_id", organization_id).eq(
            "integration_type", "snowflake"
        ).maybe_single().execute()

        if not result or not result.data:
            raise ValueError("Snowflake integration not found for this organization")

        metadata = result.data.get("metadata", {})

        # Retrieve credentials from Vault using deterministic name pattern.
        # Names follow: integration_{org_id}_snowflake_{field_name}
        credentials = {}
        for field_name in self.VAULT_CREDENTIAL_FIELDS:
            vault_key = f"integration_{organization_id}_snowflake_{field_name}"
            secret = await vault_service.get_secret_by_name(vault_key)
            if secret:
                credentials[field_name] = secret

        if not credentials:
            raise ValueError("No Snowflake credentials found in Vault")

        # Add non-sensitive metadata fields (override vault values with metadata
        # for fields that are also stored as non-sensitive metadata)
        credentials["account_identifier"] = metadata.get("account_identifier", "") or credentials.get("account_identifier", "")
        credentials["username"] = metadata.get("username", "") or credentials.get("username", "")
        credentials["warehouse"] = metadata.get("warehouse", "") or credentials.get("warehouse", "")
        credentials["database"] = metadata.get("database", "") or credentials.get("database", "")
        credentials["role"] = metadata.get("role", "")

        # Detect auth method (OAuth vs key-pair)
        if metadata.get("auth_method") == "oauth":
            credentials["auth_method"] = "oauth"
            # Fetch the OAuth access token from vault via OAuthManager
            access_token = await OAuthManager.get_access_token(
                organization_id, "snowflake"
            )
            if access_token:
                credentials["oauth_access_token"] = access_token
            else:
                raise ValueError("OAuth access token not available or expired. Re-authenticate with Snowflake.")

        return credentials

    def _get_connection(self, organization_id: str, credentials: Dict[str, str]):
        """Create a Snowflake connection, dispatching based on auth method."""
        if credentials.get("auth_method") == "oauth":
            return self._get_connection_oauth(organization_id, credentials)
        return self._get_connection_keypair(organization_id, credentials)

    def _get_connection_keypair(self, organization_id: str, credentials: Dict[str, str]):
        """Create a Snowflake connection using key-pair auth."""
        try:
            import snowflake.connector
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.backends import default_backend
        except ImportError:
            raise RuntimeError(
                "snowflake-connector-python and cryptography packages are required. "
                "Install with: pip install snowflake-connector-python[pandas] cryptography"
            )

        private_key_pem = credentials.get("private_key", "")
        if not private_key_pem:
            raise ValueError("Private key is required for Snowflake key-pair authentication")

        # Parse PEM private key
        private_key = serialization.load_pem_private_key(
            private_key_pem.encode("utf-8"),
            password=None,
            backend=default_backend(),
        )

        # Get DER-encoded private key bytes for the connector
        private_key_bytes = private_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

        connect_params = {
            "account": credentials["account_identifier"],
            "user": credentials["username"],
            "private_key": private_key_bytes,
            "warehouse": credentials.get("warehouse"),
        }

        if credentials.get("database"):
            connect_params["database"] = credentials["database"]
        if credentials.get("role"):
            connect_params["role"] = credentials["role"]

        conn = snowflake.connector.connect(**connect_params)
        return conn

    def _get_connection_oauth(self, organization_id: str, credentials: Dict[str, str]):
        """Create a Snowflake connection using OAuth token."""
        try:
            import snowflake.connector
        except ImportError:
            raise RuntimeError(
                "snowflake-connector-python is required. "
                "Install with: pip install snowflake-connector-python[pandas]"
            )

        # Get the OAuth access token (synchronously via the stored vault ID)
        # The access token should already be in the credentials from _get_credentials
        access_token = credentials.get("oauth_access_token", "")
        if not access_token:
            raise ValueError("OAuth access token not available. Re-authenticate with Snowflake.")

        connect_params = {
            "account": credentials["account_identifier"],
            "token": access_token,
            "authenticator": "oauth",
            "warehouse": credentials.get("warehouse"),
        }

        if credentials.get("database"):
            connect_params["database"] = credentials["database"]
        if credentials.get("role"):
            connect_params["role"] = credentials["role"]

        conn = snowflake.connector.connect(**connect_params)
        return conn

    async def test_connection(self, organization_id: str) -> Dict[str, Any]:
        """Test Snowflake connectivity and return account info."""
        try:
            credentials = await self._get_credentials(organization_id)

            def _test(creds):
                conn = self._get_connection(organization_id, creds)
                try:
                    cursor = conn.cursor()
                    cursor.execute("SELECT CURRENT_ACCOUNT(), CURRENT_USER(), CURRENT_ROLE(), CURRENT_WAREHOUSE()")
                    row = cursor.fetchone()
                    cursor.close()
                    return {
                        "success": True,
                        "message": f"Connected as {row[1]}@{row[0]}",
                        "user_info": {
                            "account": row[0],
                            "user": row[1],
                            "role": row[2],
                            "warehouse": row[3],
                        },
                    }
                finally:
                    conn.close()

            return await asyncio.to_thread(_test, credentials)
        except Exception as e:
            logger.exception("Snowflake connection test failed")
            return {
                "success": False,
                "message": f"Connection failed: {str(e)}",
            }

    async def list_databases(self, organization_id: str) -> List[Dict[str, str]]:
        """List available databases."""
        credentials = await self._get_credentials(organization_id)

        def _query(creds):
            conn = self._get_connection(organization_id, creds)
            try:
                cursor = conn.cursor()
                cursor.execute("SHOW DATABASES")
                databases = []
                for row in cursor:
                    databases.append({
                        "name": row[1],
                        "created_on": str(row[0]) if row[0] else "",
                    })
                cursor.close()
                return databases
            finally:
                conn.close()

        return await asyncio.to_thread(_query, credentials)

    async def list_schemas(self, organization_id: str, database: str) -> List[Dict[str, str]]:
        """List schemas in a database."""
        _validate_identifier(database, "database")
        credentials = await self._get_credentials(organization_id)

        def _query(creds):
            conn = self._get_connection(organization_id, creds)
            try:
                cursor = conn.cursor()
                cursor.execute(f"SHOW SCHEMAS IN DATABASE {database}")
                schemas = []
                for row in cursor:
                    schemas.append({
                        "name": row[1],
                        "database": database,
                    })
                cursor.close()
                return schemas
            finally:
                conn.close()

        return await asyncio.to_thread(_query, credentials)

    async def list_stages(
        self,
        organization_id: str,
        database: Optional[str] = None,
        schema: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List stages in a schema."""
        if database:
            _validate_identifier(database, "database")
        if schema:
            _validate_identifier(schema, "schema")

        credentials = await self._get_credentials(organization_id)

        def _query(creds):
            conn = self._get_connection(organization_id, creds)
            try:
                cursor = conn.cursor()

                if database and schema:
                    cursor.execute(f"SHOW STAGES IN SCHEMA {database}.{schema}")
                elif database:
                    cursor.execute(f"SHOW STAGES IN DATABASE {database}")
                else:
                    cursor.execute("SHOW STAGES")

                stages = []
                for row in cursor:
                    stages.append({
                        "name": row[1],
                        "database_name": row[2] if len(row) > 2 else "",
                        "schema_name": row[3] if len(row) > 3 else "",
                        "type": row[5] if len(row) > 5 else "",
                    })
                cursor.close()
                return stages
            finally:
                conn.close()

        return await asyncio.to_thread(_query, credentials)

    async def list_stage_files(
        self,
        organization_id: str,
        stage_name: str,
        path_prefix: Optional[str] = None,
        pattern: Optional[str] = None,
        file_type_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        List files in a Snowflake stage.

        Args:
            organization_id: Organization ID
            stage_name: Stage name (e.g., "my_stage" or "db.schema.my_stage")
            path_prefix: Filter by path prefix
            pattern: SQL LIKE pattern for filtering
            file_type_filter: "documents", "data", or None for all
        """
        _validate_identifier(stage_name, "stage_name")

        credentials = await self._get_credentials(organization_id)

        def _query(creds):
            conn = self._get_connection(organization_id, creds)
            try:
                cursor = conn.cursor()

                # Build the LIST command
                stage_ref = f"@{stage_name}"
                if path_prefix:
                    stage_ref = f"{stage_ref}/{path_prefix}"

                query = f"LIST {stage_ref}"
                if pattern:
                    query += f" PATTERN='{pattern}'"

                cursor.execute(query)

                files = []
                for row in cursor:
                    file_name = row[0]  # name column
                    file_size = row[1] if len(row) > 1 else 0  # size column
                    last_modified = str(row[2]) if len(row) > 2 else ""  # last_modified

                    # Extract just the filename from the full path
                    # LIST returns paths like "stage_name/path/file.pdf"
                    display_name = file_name
                    if "/" in file_name:
                        display_name = file_name.split("/")[-1]

                    # Get extension - strip .gz suffix since Snowflake auto-compresses
                    check_name = display_name
                    if check_name.lower().endswith(".gz"):
                        check_name = check_name[:-3]
                    ext = Path(check_name).suffix.lower()

                    is_processable = ext in PROCESSABLE_EXTENSIONS
                    is_document = ext in DOCLING_EXTENSIONS
                    is_data = ext in DATA_EXTENSIONS

                    # Apply type filter
                    if file_type_filter == "documents" and not is_document:
                        continue
                    if file_type_filter == "data" and not is_data:
                        continue

                    files.append({
                        "name": display_name,
                        "full_path": file_name,
                        "size": file_size,
                        "last_modified": last_modified,
                        "extension": ext,
                        "is_processable": is_processable,
                        "file_category": "document" if is_document else ("data" if is_data else "other"),
                    })

                cursor.close()
                return files
            finally:
                conn.close()

        return await asyncio.to_thread(_query, credentials)

    async def get_presigned_url(
        self,
        organization_id: str,
        stage_name: str,
        file_path: str,
        expiry_seconds: int = 3600,
    ) -> str:
        """Get a pre-signed URL for a file in a stage."""
        _validate_identifier(stage_name, "stage_name")
        # Sanitize file_path - allow alphanumeric, underscores, hyphens, dots, slashes
        if not re.match(r'^[A-Za-z0-9_./ -]+$', file_path):
            raise ValueError(f"Invalid file path: '{file_path}'")

        credentials = await self._get_credentials(organization_id)

        def _query(creds):
            conn = self._get_connection(organization_id, creds)
            try:
                cursor = conn.cursor()
                cursor.execute(
                    f"SELECT GET_PRESIGNED_URL(@{stage_name}, '{file_path}', {expiry_seconds})"
                )
                row = cursor.fetchone()
                cursor.close()
                if not row or not row[0]:
                    raise ValueError(f"Could not generate pre-signed URL for {file_path}")
                return row[0]
            finally:
                conn.close()

        return await asyncio.to_thread(_query, credentials)

    async def download_file_via_presigned_url(
        self,
        presigned_url: str,
        target_path: Optional[str] = None,
    ) -> str:
        """Download a file from a pre-signed URL to a temporary location."""
        if not target_path:
            suffix = Path(presigned_url.split("?")[0]).suffix or ".bin"
            fd, target_path = tempfile.mkstemp(suffix=suffix)
            os.close(fd)

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(presigned_url)
            response.raise_for_status()

            with open(target_path, "wb") as f:
                f.write(response.content)

        logger.info(f"Downloaded file to {target_path} ({os.path.getsize(target_path)} bytes)")
        return target_path

    async def download_file_via_get(
        self,
        organization_id: str,
        stage_name: str,
        file_path: str,
    ) -> str:
        """
        Download a file from a stage using the Snowflake GET command.

        This works for internal stages where pre-signed URLs may not be available.
        Returns the path to the downloaded file.
        """
        _validate_identifier(stage_name, "stage_name")

        credentials = await self._get_credentials(organization_id)

        def _download(creds):
            conn = self._get_connection(organization_id, creds)
            tmp_dir = tempfile.mkdtemp(prefix="snowflake_dl_")
            try:
                cursor = conn.cursor()
                # file_path from LIST includes the stage prefix (e.g., "stage_name/file.pdf.gz")
                # Strip the stage prefix since we already reference the stage in @stage_name
                clean_path = file_path
                stage_basename = stage_name.split(".")[-1].lower()
                if clean_path.lower().startswith(stage_basename + "/"):
                    clean_path = clean_path[len(stage_basename) + 1:]

                # GET '@stage/path' 'file:///tmp/dir/' - quote for paths with spaces
                stage_ref = f"@{stage_name}/{clean_path}"
                cursor.execute(f"GET '{stage_ref}' 'file://{tmp_dir}/'")
                cursor.close()

                # Find the downloaded file in tmp_dir
                downloaded_files = os.listdir(tmp_dir)
                if not downloaded_files:
                    raise ValueError(f"GET command did not download any files from {stage_ref}")

                downloaded_path = os.path.join(tmp_dir, downloaded_files[0])
                logger.info(f"Downloaded file via GET to {downloaded_path} ({os.path.getsize(downloaded_path)} bytes)")
                return downloaded_path
            finally:
                conn.close()

        return await asyncio.to_thread(_download, credentials)

    def convert_data_file_to_text(
        self,
        file_path: str,
        max_rows: int = 1000,
    ) -> Dict[str, Any]:
        """
        Convert a data file (CSV, JSON, Parquet) to text for processing.

        Returns a dict with 'text' (markdown content) and 'metadata'.
        """
        ext = Path(file_path).suffix.lower()

        if ext == ".csv":
            return self._convert_csv(file_path, max_rows)
        elif ext in (".json", ".jsonl"):
            return self._convert_json(file_path, max_rows)
        elif ext == ".parquet":
            return self._convert_parquet(file_path, max_rows)
        else:
            raise ValueError(f"Unsupported data file format: {ext}")

    def _convert_csv(self, file_path: str, max_rows: int) -> Dict[str, Any]:
        """Read CSV and return markdown table + metadata."""
        import csv

        rows = []
        headers = []
        with open(file_path, "r", newline="", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            for i, row in enumerate(reader):
                if i == 0:
                    headers = row
                elif i <= max_rows:
                    rows.append(row)
                else:
                    break

        total_rows = len(rows)

        # Build markdown table
        if not headers:
            return {"text": "(empty CSV file)", "metadata": {"format": "csv", "rows": 0, "columns": 0}}

        lines = []
        lines.append("| " + " | ".join(headers) + " |")
        lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
        for row in rows:
            # Pad or truncate row to match headers
            padded = row + [""] * (len(headers) - len(row))
            lines.append("| " + " | ".join(padded[:len(headers)]) + " |")

        text = "\n".join(lines)

        return {
            "text": text,
            "metadata": {
                "format": "csv",
                "rows": total_rows,
                "columns": len(headers),
                "headers": headers,
                "truncated": total_rows >= max_rows,
            },
        }

    def _convert_json(self, file_path: str, max_rows: int) -> Dict[str, Any]:
        """Read JSON/JSONL and return formatted text + metadata."""
        import json

        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            # Try as JSONL
            lines = content.strip().split("\n")
            data = []
            for line in lines[:max_rows]:
                try:
                    data.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

        if isinstance(data, list):
            truncated = len(data) > max_rows
            data = data[:max_rows]
            text = json.dumps(data, indent=2, default=str)
            return {
                "text": text,
                "metadata": {
                    "format": "json",
                    "rows": len(data),
                    "type": "array",
                    "truncated": truncated,
                },
            }
        else:
            text = json.dumps(data, indent=2, default=str)
            return {
                "text": text,
                "metadata": {
                    "format": "json",
                    "type": "object",
                },
            }

    def _convert_parquet(self, file_path: str, max_rows: int) -> Dict[str, Any]:
        """Read Parquet via pyarrow and return markdown table + metadata."""
        try:
            import pyarrow.parquet as pq
        except ImportError:
            raise RuntimeError("pyarrow is required for Parquet files. Install with: pip install pyarrow")

        table = pq.read_table(file_path)
        total_rows = table.num_rows
        total_columns = table.num_columns

        # Convert to pandas for easy formatting
        df = table.slice(0, min(max_rows, total_rows)).to_pandas()
        headers = list(df.columns)

        lines = []
        lines.append("| " + " | ".join(str(h) for h in headers) + " |")
        lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
        for _, row in df.iterrows():
            lines.append("| " + " | ".join(str(v) for v in row) + " |")

        text = "\n".join(lines)

        return {
            "text": text,
            "metadata": {
                "format": "parquet",
                "rows": total_rows,
                "columns": total_columns,
                "headers": headers,
                "truncated": total_rows > max_rows,
                "schema": str(table.schema),
            },
        }


# Global instance
snowflake_service = SnowflakeService()
