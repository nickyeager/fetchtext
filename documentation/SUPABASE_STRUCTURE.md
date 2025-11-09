# Supabase Services & Schema Overview

_Last updated: 2025-11-09 18:23:53 UTC_

## Runtime Services
The following Supabase containers are currently reported as healthy via `docker ps`:

- `supabase-db`: Postgres cluster with extensions (`uuid-ossp`, `pgcrypto`, `vector`).
- `supabase-rest`: PostgREST API exposed through Kong on `http://localhost:8000`.
- `supabase-auth`: GoTrue authentication server (`http://localhost:54321`).
- `supabase-storage`: Storage API for buckets/objects.
- `supabase-kong`: Gateway/ingress proxy for external access.
- `supabase-studio`: Web UI for inspecting the project database.
- `supabase-meta`, `supabase-imgproxy`, `supabase-realtime`: supporting metadata, image proxy, and realtime services.

All containers originated from the root `docker-compose.yml` stack. Restart individual services with `docker compose restart <service>` if one becomes unhealthy.

## Database Schema Snapshot
Migrations live in `supabase/migrations/*.sql` and have all been applied in order (001 → 011). Key tables/policies now in place:

- `smart_templates`: Canonical template store with markdown `template_content`, `smart_variables`, `regex_fallback`, and `generation_settings`. Indexes cover category, visibility, and ownership for fast filtering.
- `documents`: Stores uploaded document metadata, text extract, JSON metadata, and optional `template_id` that references `smart_templates(id)`. RLS grants:
  - Authenticated users may CRUD rows they own (`uploaded_by = auth.uid()`).
  - `service_role` has a blanket policy for backend ingestion as well as sequence usage grants.
  - Indexes exist on uploader, status, type, creation time, metadata (GIN), and template ID.
- `workflow_instances` / `workflow_executions`: Track workflow deployments and run history with triggers to auto-update `updated_at`.
- `template_embeddings`: Vector-backed embeddings (using the `vector` extension) limited to smart templates after the consolidation migration.
- Storage bucket policies (`008_storage_rls_policies.sql`) now drop/recreate deterministic RLS rules for the `documents` bucket so authenticated users can manage their own files while anon/service roles have read scopes as required.

Legacy `templates` / `workflow_templates` tables have been migrated and dropped (`011_cleanup_legacy_templates.sql`). Backup copies (`_backup_templates`, `_backup_workflow_templates`) were also removed once verification passed.

## Verification & Smoke Tests
- `docker exec -e PGPASSWORD=\$POSTGRES_PASSWORD supabase-db psql -U supabase_admin -d postgres -c "select to_regclass('public.documents');"` ⇒ confirms the `documents` relation now exists.
- `curl -H "apikey: \$SERVICE_ROLE_KEY" -H "Authorization: Bearer \$SERVICE_ROLE_KEY" "http://localhost:8000/rest/v1/documents?select=id,name,processing_status"` ⇒ PostgREST responds `200 OK` (rows appear once documents are uploaded under an authenticated user).
- Frontend/dashboard document listing should no longer throw `relation "public.documents" does not exist`; run a quick smoke test after logging in as `admin@fetchtext.local / AdminPass2024!`.

## Operational Notes
- When editing migrations, ensure compatibility with Postgres 15 (no `CREATE POLICY IF NOT EXISTS`). Use `DROP POLICY IF EXISTS …; CREATE POLICY …;` for idempotency.
- To re-apply from scratch, drop the `supabase-db` volume (`docker compose down -v`) and run `docker compose up -d supabase-db` followed by the migration loop in `supabase/migrations`.
- For backend processors (`document-processor` service), set `SERVICE_ROLE_KEY` and optionally `UPLOAD_USER_ID` env vars so inserts satisfy the FK + RLS requirements.
