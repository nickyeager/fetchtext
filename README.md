<p align="center">
  <img src="docs/assets/header.svg" alt="FetchText — self-hosted document AI with LLM smart templates" width="100%">
</p>

<p align="center">
  <a href="https://github.com/nickyeager/fetchtext/actions/workflows/ci.yml"><img src="https://github.com/nickyeager/fetchtext/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License: Apache 2.0"></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
  <a href="https://github.com/nickyeager/fetchtext/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22"><img src="https://img.shields.io/github/issues-search/nickyeager/fetchtext?query=is%3Aopen%20label%3A%22good%20first%20issue%22&label=good%20first%20issues&color=7057ff" alt="Good First Issues"></a>
</p>

**Self-hosted document processing, extraction, and generation — powered by
local or cloud LLMs.**

FetchText turns piles of contracts, invoices, forms, and reports into
structured data you can query, generate from, and integrate into your
business systems. Drop in a document, and it:

1. Extracts text (with OCR for scans)
2. Classifies it against your library of smart templates
3. Pulls structured fields using LLM-based entity extraction (no brittle
   regex)
4. Optionally generates new documents from the extracted data

It runs entirely on your own infrastructure — laptop, server, or cloud —
with your choice of local Ollama models or Azure OpenAI.

> **Built on top of** [local-ai-packaged](https://github.com/coleam00/local-ai-packaged)
> by [Cole Medin](https://github.com/coleam00). FetchText adds the document
> processor, admin dashboard, smart template system, and integration layer
> on top of that foundation. See [NOTICE](NOTICE) for full attribution.

---

## What's in the box

- **Document Processor** — FastAPI service using
  [Docling](https://github.com/DS4SD/docling) for layout-aware extraction.
  Three-tier strategy: PyMuPDF (fast embedded text) → Docling layout-only
  → Docling with OCR. Streams progress over SSE.
- **Admin Dashboard** — React/TypeScript SPA built on
  [TanStack Router](https://tanstack.com/router) and
  [shadcn/ui](https://ui.shadcn.com/). Upload, review, edit templates,
  manage integrations.
- **Smart Templates** — define a template once with field definitions; the
  system extracts those fields from any matching document using LLMs and
  vector similarity (Qdrant).
- **Integrations** — Google Drive, Microsoft 365, Dropbox, Slack,
  QuickBooks, Xero, Snowflake. OAuth + key-pair auth supported.
- **Local + Cloud LLMs** — toggle between Ollama (local) and Azure OpenAI
  per-user via the settings UI.
- **Self-hosted everything** — Supabase (auth + Postgres + storage), n8n
  (workflows), Qdrant (vector DB), Neo4j (graph), Langfuse (LLM
  observability), Open WebUI, Flowise, SearXNG — orchestrated with Docker
  Compose behind Caddy for HTTPS.

## Quickstart

### Prerequisites

- Docker and Docker Compose v2
- Python 3.11+ (for `start_services.py`)
- Node 20 + pnpm (only if you plan to develop the dashboard)
- 8 GB RAM minimum, 16 GB recommended (Docling layout models are heavy)

### Run it

```bash
git clone https://github.com/<your-fork>/fetchtext.git
cd fetchtext

# 1. Configure
cp .env.example .env
# Edit .env — at minimum set:
#   POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY,
#   N8N_ENCRYPTION_KEY, DASHBOARD_PASSWORD
# See .env.example for the full list with comments.

# 2. Start the stack
python start_services.py --profile cpu
# Or: --profile gpu-nvidia / --profile gpu-amd

# 3. Wait for services to come up (~2 minutes first time)
curl http://localhost:8090/health   # document processor
open http://localhost:5173          # admin dashboard
```

The first launch downloads Docling layout models (~1 GB) and any Ollama
models you've configured. Subsequent starts are fast.

### Service URLs (defaults)

| Service           | URL                       |
|-------------------|---------------------------|
| Admin Dashboard   | http://localhost:5173     |
| Document API      | http://localhost:8090     |
| Supabase Studio   | http://localhost:8000     |
| n8n               | http://localhost:8001     |
| Open WebUI        | http://localhost:8002     |
| Flowise           | http://localhost:8003     |
| Langfuse          | http://localhost:8007     |
| Ollama            | http://localhost:11434    |

## Configuration

All configuration lives in `.env`. The big knobs:

- `STORAGE_BACKEND` — set to `s3` to use the bundled MinIO; required for
  document upload to work
- LLM provider — defaults to Ollama. Switch to Azure OpenAI by setting the
  `AZURE_OPENAI_*` vars and toggling provider in Settings → AI Models
- Integration OAuth credentials — see `.env.example` for Google, Microsoft,
  Dropbox, Slack, QuickBooks, Xero, Snowflake

## Architecture

```mermaid
%%{ init: { 'theme': 'base', 'themeVariables': {
  'primaryColor': '#1E293B',
  'primaryTextColor': '#F8FAFC',
  'primaryBorderColor': '#475569',
  'lineColor': '#64748B',
  'fontFamily': '-apple-system, system-ui, sans-serif'
}}}%%
flowchart LR
    classDef user fill:#0F172A,stroke:#60A5FA,color:#F8FAFC
    classDef edge fill:#1E293B,stroke:#A78BFA,color:#F8FAFC
    classDef app fill:#1E40AF,stroke:#60A5FA,color:#F8FAFC
    classDef data fill:#5B21B6,stroke:#A78BFA,color:#F8FAFC
    classDef ai fill:#9D174D,stroke:#F472B6,color:#F8FAFC
    classDef ext fill:#065F46,stroke:#34D399,color:#F8FAFC

    User([User])

    subgraph Edge[" "]
      direction TB
      Caddy["Caddy<br/><i>HTTPS / reverse proxy</i>"]
    end

    subgraph Apps["Application Layer"]
      direction TB
      Dashboard["Admin Dashboard<br/><i>React · TanStack · shadcn/ui</i>"]
      Processor["Document Processor<br/><i>FastAPI · SSE streaming</i>"]
      N8N["n8n<br/><i>Workflows · webhooks</i>"]
      WebUI["Open WebUI<br/><i>Chat interface</i>"]
    end

    subgraph DataLayer["Data &amp; Storage"]
      direction TB
      Supabase["Supabase<br/><i>Auth · Postgres · Storage</i>"]
      Qdrant["Qdrant<br/><i>Vector DB</i>"]
      Neo4j["Neo4j<br/><i>Knowledge graph</i>"]
      MinIO["MinIO<br/><i>S3-compatible store</i>"]
    end

    subgraph AILayer["AI &amp; Extraction"]
      direction TB
      Docling["Docling<br/><i>Layout · OCR · tables</i>"]
      Ollama["Ollama<br/><i>Local LLMs</i>"]
      Azure["Azure OpenAI<br/><i>Cloud LLMs</i>"]
      Langfuse["Langfuse<br/><i>LLM observability</i>"]
    end

    subgraph Integrations["External Integrations"]
      direction TB
      Drive["Google Drive"]
      M365["Microsoft 365"]
      Snowflake["Snowflake"]
      Other["Dropbox · Slack ·<br/>QuickBooks · Xero"]
    end

    User -->|HTTPS| Caddy
    Caddy --> Dashboard
    Caddy --> Processor
    Caddy --> N8N
    Caddy --> WebUI

    Dashboard -->|REST + Realtime| Supabase
    Dashboard -->|SSE| Processor
    Processor --> Supabase
    Processor --> Docling
    Processor -->|template matching| Qdrant
    Processor --> Neo4j
    Processor -->|switchable| Ollama
    Processor -->|switchable| Azure
    Processor -->|traces| Langfuse
    Processor --> MinIO

    N8N -->|webhooks| Processor
    Processor -.->|fetch documents| Drive
    Processor -.-> M365
    Processor -.-> Snowflake
    Processor -.-> Other

    User:::user
    Caddy:::edge
    Dashboard:::app
    Processor:::app
    N8N:::app
    WebUI:::app
    Supabase:::data
    Qdrant:::data
    Neo4j:::data
    MinIO:::data
    Docling:::ai
    Ollama:::ai
    Azure:::ai
    Langfuse:::ai
    Drive:::ext
    M365:::ext
    Snowflake:::ext
    Other:::ext
```

Source: [`docs/assets/architecture.mmd`](docs/assets/architecture.mmd) ·
Full breakdown: [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)

## Documentation

- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Project Structure](docs/architecture/PROJECT_STRUCTURE.md)
- [Document Processing Guide](docs/guides/DOCUMENT_PROCESSING_COMPLETE_GUIDE.md)
- [Template Matching](docs/guides/TEMPLATE_MATCHING_CURRENT_STATE.md)
- [LLM Entity Extraction](docs/guides/LLM_ENTITY_EXTRACTION.md)
- [Walkthroughs](docs/walkthroughs/) — end-to-end feature walkthroughs

## Status

Pre-1.0. Public API and database schema may change. We use FetchText
internally and ship breaking changes as we learn.

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup,
code standards, and the PR process. Please follow our
[Code of Conduct](CODE_OF_CONDUCT.md).

For security issues, see [SECURITY.md](SECURITY.md) — please do not open
public issues for vulnerabilities.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
Includes upstream code from `local-ai-packaged` (also Apache 2.0); see
[NOTICE](NOTICE).
