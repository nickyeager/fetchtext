# Changelog

All notable changes to FetchText will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note on pre-1.0 versions:** Breaking changes can ship in any 0.x minor
> release. Database schema migrations and API changes will be called out
> explicitly under "Breaking" so you know when to read the migration notes.

## [Unreleased]

### Added
- _Track planned work on the [public roadmap](ROADMAP.md)._

---

## [0.1.0] — 2026-05-11

**Initial open-source release.** Apache 2.0.

### Added
- **Document Processor** (FastAPI) — three-tier extraction (PyMuPDF →
  Docling layout → Docling OCR), SSE-streamed progress, LLM-based field
  extraction with confidence scores and source spans
- **Admin Dashboard** (React 19 + TanStack Router + shadcn/ui) —
  document upload, smart-template editor, integration management,
  per-user LLM provider toggle
- **Smart Templates** — vector-similarity classification via Qdrant,
  LLM extraction with regex fallback for low-confidence fields
- **Integrations** — Google Drive, Microsoft 365, Dropbox, Slack,
  QuickBooks, Xero, Snowflake (OAuth + key-pair auth)
- **LLM Providers** — Ollama (local) and Azure OpenAI (cloud),
  switchable per-user via Settings UI
- **Bundled stack** — Supabase (auth + Postgres + storage), n8n
  (workflows), Open WebUI, Flowise, Neo4j (knowledge graph), Langfuse
  (LLM observability), Qdrant (vectors), SearXNG, MinIO, all behind
  Caddy for HTTPS
- **Apache 2.0** license with full attribution to upstream
  [`local-ai-packaged`](https://github.com/coleam00/local-ai-packaged)
- Standard OSS scaffolding: `README.md`, `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, `SECURITY.md`, `NOTICE`
- CI pipeline (GitHub Actions) — frontend build, document processor
  tests, gitleaks secret scan
- 5 seeded `good first issue` tickets for new contributors

### Security
- Full git-history rewrite to scrub historical credential leaks
  (SendGrid keys, Azure AD client secrets, dev passwords)
- `.gitleaks.toml` allowlist for known-safe public Supabase demo
  tokens and test fixtures, preventing CI false positives

### Known limitations
- Frontend has ~1,800 pre-existing eslint warnings — lint is
  non-blocking in CI while contributors pay down the debt
- Frontend unit tests follow a "no mocks" policy (see CLAUDE.md) and
  require a live backend; they run pre-merge locally, not in CI
- Smart-template editor UX is functional but spartan (see ROADMAP)
- Box.com integration not yet implemented ([#21](https://github.com/nickyeager/fetchtext/issues/21))

[Unreleased]: https://github.com/nickyeager/fetchtext/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nickyeager/fetchtext/releases/tag/v0.1.0
