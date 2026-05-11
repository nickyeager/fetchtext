# Roadmap

This is a living document. Priorities shift as users tell us what
matters. If something here matters to you (or something missing does!),
open an issue or comment on an existing one.

**Last updated:** 2026-05-11

> **Legend** — 🟢 in progress · 🟡 planned next · 🔵 explored, not committed · ⚪ open question

---

## Now (v0.1 → v0.2)

The focus right now is removing rough edges that block someone from
self-hosting FetchText on a Tuesday afternoon and trusting it by Friday.

- 🟢 **Quickstart that actually works on a fresh clone**
  Continuously verified — see CI + the `Makefile` proposal in
  [#issues](https://github.com/nickyeager/fetchtext/issues).
- 🟡 **Smart-template editor UX overhaul**
  The current editor works but is dense. Want a side-by-side preview
  showing template ↔ extracted fields against a sample document.
- 🟡 **Lint / type-check debt paydown**
  ~1,800 frontend lint warnings + Python files without strict typing.
  Currently non-blocking in CI — goal is to make lint blocking by 0.3.
- 🟡 **Comprehensive E2E test gate**
  Reuse the existing "stucco contract" Playwright spec as the canonical
  smoke test; run it nightly + on every PR via container-based test
  harness.
- 🟡 **Pay-down of internal Azure-specific workflows**
  Several deploy workflows still assume Azure resources. Generalize or
  move to a separate "production reference" branch.

---

## Next (v0.2 → v0.3)

Extraction quality and integrations.

- 🟡 **Multi-exemplar training**
  Today a smart template ships with one example doc. Real-world
  templates need 3–10 exemplars to converge on stable extraction.
  Backend already supports it; UI needs to expose it.
- 🟡 **Box.com integration**
  Mirror the existing Dropbox flow. Pinned as good-first-issue
  ([#21](https://github.com/nickyeager/fetchtext/issues/21)).
- 🟡 **Field-level similarity search across vendors**
  "Show me all extracted `vendor_pricing_structure` values across every
  procurement contract" — uses the existing Qdrant + Neo4j layers.
- 🟡 **Confidence-driven re-extraction**
  When confidence < threshold, automatically re-prompt the LLM with
  additional context (neighboring text, layout cues, similar
  successful extractions).
- 🔵 **OneDrive personal account support**
  Microsoft 365 work accounts are supported today; personal is asked
  for occasionally.

---

## Later (v0.3+)

Bigger bets that need design work.

- 🔵 **Graph-RAG / LightRAG hybrid retrieval**
  Augment Qdrant vector matching with Neo4j knowledge graph edges.
  Enables structural pattern matching ("find me other documents that
  reference the same parties with similar payment terms"), not just
  semantic similarity. Design notes in `.agents/` (local-only).
- 🔵 **Form-to-form translation**
  Upload an unfamiliar form → extract every field → map fields to an
  existing internal template automatically. Bridges the
  "every-customer-has-their-own-format" gap.
- 🔵 **Webhook-driven document ingestion**
  Today: users upload via UI. Want: customers POST documents from
  their systems → n8n workflow → FetchText pipeline → extracted data
  back to their system.
- 🔵 **Native multi-tenancy**
  Currently single-org per deployment with RLS for user isolation.
  True multi-tenant deployments (one FetchText, N orgs with hard
  isolation) requires schema work.
- 🔵 **Document generation from templates**
  The "T" in FetchText: extract from doc A, fill template B. Backend
  has scaffolding; UX needs design.

---

## Open questions

These are things we genuinely don't know the answer to yet. If you
have a strong opinion, please open an issue with the `discussion`
label.

- ⚪ **Should the smart-template DSL be human-editable or always
  generated?** Today it's JSON in the DB. A YAML/Markdown form
  checked into git would enable templates-as-code workflows but adds
  a sync surface.
- ⚪ **How opinionated should the default Ollama model be?**
  `llama3.1:8b` works but isn't the fastest. Should the installer
  recommend a specific model + quantization, or stay neutral?
- ⚪ **Plugin architecture for integrations?**
  Right now integrations live in-tree. As the list grows, a plugin
  protocol (probably MCP-shaped) becomes attractive.
- ⚪ **Hosted version?**
  We'd run a managed FetchText cloud only if the OSS core is
  clearly its own thing and remains complete on its own. No plans to
  add OSS-only telemetry or paywalled features.

---

## Not on the roadmap

A few things we're explicitly **not** planning, so you don't have to
ask:

- **No SaaS-only features**, ever. If it ships, it's in the OSS repo.
- **No CLA**. DCO (sign-off in commits) only. See [CONTRIBUTING.md](CONTRIBUTING.md).
- **No telemetry / phone-home** in the OSS deployment. Period.
- **No swap-in alternatives to Docling.** It's the right tool, and
  proliferating extraction backends fragments the field-extraction
  quality story.

---

## How to influence this list

1. **Open an issue** describing the problem you're hitting. We care
   far more about the underlying need than the proposed solution.
2. **Reply to an existing item** with how it would affect your use
   case. A +1 with context beats a +1 alone.
3. **Open a PR**. Code wins. The
   [good-first-issue list](https://github.com/nickyeager/fetchtext/issues?q=is%3Aopen+label%3A%22good+first+issue%22)
   is the easiest way in.

The roadmap is _intent_, not _promise_. Anything here may slip,
re-prioritize, or get replaced by something better.
