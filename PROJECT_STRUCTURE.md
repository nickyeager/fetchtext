# Project Structure

## Core Orchestration
- `docker-compose.yml` – primary Compose file defining Local AI, Supabase, monitoring, and supporting services.
- `docker-compose.override*.yml` – environment-specific overrides (public/private, Supabase variants).
- `start_services.py`, `kill-and-restart-services.py`, `monitor_services.py` – helper scripts for lifecycle management and health checks.

## Applications & Services
- `document-processor/` – Python service (FastAPI) with `app/` routers, models, and services plus extensive tests and scripts.
- `localai-admin-dashboard/` – Vite/TypeScript admin UI with Playwright tests, build assets, and Docker artefacts.
- `monitoring/` – Alerting dashboards, health checks, and supporting docker-compose configurations for observability.
- `flowise/` – Exported Flowise chatflows and custom tool definitions.
- `searxng/`, `neo4j/`, `infra/` – Service-specific configuration (search engine, graph database, Azure Bicep deployment modules).

## Data, Backups, and Shared Assets
- `backups/` – Supabase dumps and policy backups (`supabase_migration/`) plus legacy snapshots.
- `data/` – Sample documents used across testing scenarios.
- `shared/` – Shared artefacts such as `Document_Template_AI_Extraction.json` for cross-service access.
- `assets/` – Static media (e.g. `n8n-demo.gif`).

## Workflow & Automation Resources
- `n8n/` – Backup directory for n8n workflows and credentials.
- `n8n-tool-workflows/` – Additional n8n workflow exports.
- `scripts/` – Utility scripts for document processing tests, validation, and PR preparation.
- `plans/`, `memory/`, `documentation/` – Project plans, historical notes, and formal documentation (supabase setup, monitoring guides, etc.).

## Supabase Stack
- `supabase/docker/` – Service-specific configuration (Kong, Storage, etc.) and volume mounts.
- `supabase/migrations/` – Database migrations and SQL change sets.
- `supabase/volumes/` – Persistent storage directories for Supabase services.
- Supabase data volume named `supabase_postgres_data_new` declared in `docker-compose.yml`.

## Dependencies & Configuration
- `package.json`, `pnpm-lock.yaml`, `node_modules/` – JavaScript/TypeScript dependencies for tooling and UI components.
- `tsconfig.json`, `azure-dev.yaml`, various `*.md` knowledge base files – Environment configuration and documentation.
- Python tooling for the document processor defined in `document-processor/pyproject.toml` and associated requirements files.

