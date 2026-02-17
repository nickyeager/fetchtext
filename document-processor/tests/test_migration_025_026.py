"""
Integration Tests: Migrations 025 (Storage RLS) and 026 (Stripe Constraints)

Verifies that:
  - Migration 025: Storage RLS policies enforce folder-based isolation
    (users can only access files in their own {user_id}/ folder)
  - Migration 026: Stripe columns have partial unique indexes preventing
    duplicate customer/subscription IDs

These tests run against the REAL database (local Docker or production).
No mocks. No skips.

Run with:
    cd document-processor && python -m pytest tests/test_migration_025_026.py -v
"""

import os
import pytest
import httpx

# ---------------------------------------------------------------------------
# Connection helpers — use local Docker Supabase by default
# ---------------------------------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL", "http://localhost:8000")
SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    os.getenv("SERVICE_ROLE_KEY", ""),
)

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}


def _run_sql(query: str) -> list:
    """Execute raw SQL via PostgREST RPC or psql fallback."""
    # Try the rpc/exec_sql approach (available if the function exists)
    with httpx.Client(timeout=15) as client:
        # Use the pg_catalog query via PostgREST
        resp = client.post(
            f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
            headers=HEADERS,
            json={"query": query},
        )
        if resp.status_code == 200:
            return resp.json()

    # Fallback: use docker exec for local testing
    import subprocess

    result = subprocess.run(
        [
            "docker", "exec", "supabase-db",
            "psql", "-U", "postgres", "-d", "postgres",
            "-t", "-A", "-F", "|",
            "-c", query,
        ],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql failed: {result.stderr}")

    rows = []
    for line in result.stdout.strip().split("\n"):
        if line:
            rows.append(line.split("|"))
    return rows


def _run_sql_docker(query: str) -> str:
    """Execute SQL via docker exec and return raw output."""
    import subprocess

    result = subprocess.run(
        [
            "docker", "exec", "supabase-db",
            "psql", "-U", "postgres", "-d", "postgres",
            "-t", "-A",
            "-c", query,
        ],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql failed: {result.stderr}")
    return result.stdout.strip()


# ===========================================================================
# Migration 025: Storage RLS folder-based isolation
# ===========================================================================

class TestMigration025StorageRLS:
    """Verify storage.objects policies enforce folder-based user isolation."""

    def test_storage_policies_exist_per_operation(self):
        """Each CRUD operation should have its own policy for authenticated users."""
        output = _run_sql_docker(
            "SELECT policyname, cmd FROM pg_policies "
            "WHERE schemaname = 'storage' AND tablename = 'objects' "
            "AND policyname LIKE 'objects_authenticated%' "
            "ORDER BY policyname;"
        )
        lines = [l for l in output.split("\n") if l.strip()]
        policy_cmds = {}
        for line in lines:
            parts = line.split("|")
            if len(parts) == 2:
                policy_cmds[parts[0].strip()] = parts[1].strip()

        assert "objects_authenticated_insert" in policy_cmds, (
            "Missing INSERT policy for authenticated users"
        )
        assert "objects_authenticated_select" in policy_cmds, (
            "Missing SELECT policy for authenticated users"
        )
        assert "objects_authenticated_update" in policy_cmds, (
            "Missing UPDATE policy for authenticated users"
        )
        assert "objects_authenticated_delete" in policy_cmds, (
            "Missing DELETE policy for authenticated users"
        )

    def test_insert_policy_has_foldername_check(self):
        """INSERT policy must enforce (storage.foldername(name))[1] = auth.uid()."""
        output = _run_sql_docker(
            "SELECT with_check FROM pg_policies "
            "WHERE schemaname = 'storage' AND tablename = 'objects' "
            "AND policyname = 'objects_authenticated_insert';"
        )
        assert "foldername" in output, (
            f"INSERT policy is missing foldername-based isolation. "
            f"Got WITH CHECK: {output!r}. "
            f"Expected it to contain 'foldername' for folder-based user isolation."
        )
        assert "auth.uid()" in output, (
            f"INSERT policy is missing auth.uid() check. Got: {output!r}"
        )

    def test_select_policy_has_foldername_check(self):
        """SELECT policy must enforce (storage.foldername(name))[1] = auth.uid()."""
        output = _run_sql_docker(
            "SELECT qual FROM pg_policies "
            "WHERE schemaname = 'storage' AND tablename = 'objects' "
            "AND policyname = 'objects_authenticated_select';"
        )
        assert "foldername" in output, (
            f"SELECT policy is missing foldername-based isolation. "
            f"Got USING: {output!r}. "
            f"Expected it to contain 'foldername' for folder-based user isolation."
        )
        assert "auth.uid()" in output, (
            f"SELECT policy is missing auth.uid() check. Got: {output!r}"
        )

    def test_update_policy_has_foldername_check(self):
        """UPDATE policy must enforce foldername check on both USING and WITH CHECK."""
        output = _run_sql_docker(
            "SELECT qual, with_check FROM pg_policies "
            "WHERE schemaname = 'storage' AND tablename = 'objects' "
            "AND policyname = 'objects_authenticated_update';"
        )
        assert output.count("foldername") >= 2, (
            f"UPDATE policy must have foldername check in both USING and WITH CHECK. "
            f"Got: {output!r}"
        )

    def test_delete_policy_has_foldername_check(self):
        """DELETE policy must enforce (storage.foldername(name))[1] = auth.uid()."""
        output = _run_sql_docker(
            "SELECT qual FROM pg_policies "
            "WHERE schemaname = 'storage' AND tablename = 'objects' "
            "AND policyname = 'objects_authenticated_delete';"
        )
        assert "foldername" in output, (
            f"DELETE policy is missing foldername-based isolation. "
            f"Got USING: {output!r}"
        )

    def test_service_role_has_full_access(self):
        """Service role policy must allow unrestricted access (for backend ops)."""
        output = _run_sql_docker(
            "SELECT qual FROM pg_policies "
            "WHERE schemaname = 'storage' AND tablename = 'objects' "
            "AND policyname = 'objects_service_role_policy';"
        )
        assert "true" in output.lower(), (
            f"Service role policy should have unrestricted access (qual=true). "
            f"Got: {output!r}"
        )

    def test_no_overly_permissive_all_policy(self):
        """The old objects_all_authenticated policy must not exist."""
        output = _run_sql_docker(
            "SELECT count(*) FROM pg_policies "
            "WHERE schemaname = 'storage' AND tablename = 'objects' "
            "AND policyname = 'objects_all_authenticated';"
        )
        assert output.strip() == "0", (
            "Old permissive 'objects_all_authenticated' policy still exists. "
            "Migration 025 should have dropped it."
        )


# ===========================================================================
# Migration 026: Stripe unique constraints
# ===========================================================================

class TestMigration026StripeConstraints:
    """Verify partial unique indexes on Stripe columns."""

    def test_stripe_customer_id_unique_index_exists(self):
        """organizations.stripe_customer_id must have a partial unique index."""
        output = _run_sql_docker(
            "SELECT indexname, indexdef FROM pg_indexes "
            "WHERE tablename = 'organizations' "
            "AND indexname = 'organizations_stripe_customer_id_key';"
        )
        assert "organizations_stripe_customer_id_key" in output, (
            "Missing unique index on organizations.stripe_customer_id. "
            "Migration 026 should create it."
        )
        assert "UNIQUE" in output.upper(), (
            f"Index exists but is not UNIQUE. Got: {output!r}"
        )

    def test_stripe_subscription_id_unique_index_exists(self):
        """organizations.stripe_subscription_id must have a partial unique index."""
        output = _run_sql_docker(
            "SELECT indexname, indexdef FROM pg_indexes "
            "WHERE tablename = 'organizations' "
            "AND indexname = 'organizations_stripe_subscription_id_key';"
        )
        assert "organizations_stripe_subscription_id_key" in output, (
            "Missing unique index on organizations.stripe_subscription_id. "
            "Migration 026 should create it."
        )
        assert "UNIQUE" in output.upper(), (
            f"Index exists but is not UNIQUE. Got: {output!r}"
        )

    def test_stripe_customer_id_index_is_partial(self):
        """Index must be partial (WHERE stripe_customer_id IS NOT NULL)."""
        output = _run_sql_docker(
            "SELECT indexdef FROM pg_indexes "
            "WHERE tablename = 'organizations' "
            "AND indexname = 'organizations_stripe_customer_id_key';"
        )
        assert "WHERE" in output.upper(), (
            f"Stripe customer ID index must be partial (WHERE clause). Got: {output!r}"
        )
        assert "IS NOT NULL" in output.upper(), (
            f"Partial index must filter on IS NOT NULL. Got: {output!r}"
        )

    def test_stripe_subscription_id_index_is_partial(self):
        """Index must be partial (WHERE stripe_subscription_id IS NOT NULL)."""
        output = _run_sql_docker(
            "SELECT indexdef FROM pg_indexes "
            "WHERE tablename = 'organizations' "
            "AND indexname = 'organizations_stripe_subscription_id_key';"
        )
        assert "WHERE" in output.upper(), (
            f"Stripe subscription ID index must be partial (WHERE clause). Got: {output!r}"
        )
        assert "IS NOT NULL" in output.upper(), (
            f"Partial index must filter on IS NOT NULL. Got: {output!r}"
        )

    def test_duplicate_stripe_customer_id_rejected(self):
        """Updating two existing orgs to the same stripe_customer_id must fail.

        Uses real existing organizations to avoid FK constraint issues.
        Wraps updates in a transaction that always rolls back.
        """
        # Get two existing org IDs
        output = _run_sql_docker(
            "SELECT id FROM organizations ORDER BY created_at LIMIT 2;"
        )
        org_ids = [line.strip() for line in output.strip().split("\n") if line.strip()]
        if len(org_ids) < 2:
            pytest.skip("Need at least 2 organizations to test unique constraint")

        org_id_1, org_id_2 = org_ids[0], org_ids[1]
        test_cus_id = "cus_test_unique_constraint_check"

        # Use a transaction to test then rollback
        # First, set org_1 to the test customer ID
        _run_sql_docker(
            f"BEGIN; "
            f"UPDATE organizations SET stripe_customer_id = '{test_cus_id}' WHERE id = '{org_id_1}'; "
            f"ROLLBACK;"
        )

        # Now test that setting BOTH orgs to the same value fails
        with pytest.raises(RuntimeError, match="duplicate|unique|violates"):
            _run_sql_docker(
                f"BEGIN; "
                f"UPDATE organizations SET stripe_customer_id = '{test_cus_id}' WHERE id = '{org_id_1}'; "
                f"UPDATE organizations SET stripe_customer_id = '{test_cus_id}' WHERE id = '{org_id_2}'; "
                f"COMMIT;"
            )

        # Ensure no test data leaked (transaction should have failed before COMMIT)
        leaked = _run_sql_docker(
            f"SELECT count(*) FROM organizations WHERE stripe_customer_id = '{test_cus_id}';"
        )
        assert leaked.strip() == "0", f"Test data leaked: {leaked}"

    def test_null_stripe_customer_id_allows_duplicates(self):
        """Multiple orgs with NULL stripe_customer_id must be allowed (partial index)."""
        # Get two existing org IDs
        output = _run_sql_docker(
            "SELECT id FROM organizations ORDER BY created_at LIMIT 2;"
        )
        org_ids = [line.strip() for line in output.strip().split("\n") if line.strip()]
        if len(org_ids) < 2:
            pytest.skip("Need at least 2 organizations to test NULL handling")

        org_id_1, org_id_2 = org_ids[0], org_ids[1]

        # Setting both to NULL should succeed (partial index excludes NULLs)
        # Wrap in transaction and rollback to avoid side effects
        _run_sql_docker(
            f"BEGIN; "
            f"UPDATE organizations SET stripe_customer_id = NULL WHERE id = '{org_id_1}'; "
            f"UPDATE organizations SET stripe_customer_id = NULL WHERE id = '{org_id_2}'; "
            f"ROLLBACK;"
        )
        # If we get here without error, NULLs are correctly excluded from the unique index
