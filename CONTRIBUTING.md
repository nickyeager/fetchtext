# Contributing to FetchText

Thanks for your interest in contributing! FetchText is a self-hosted
document processing platform built on top of
[local-ai-packaged](https://github.com/coleam00/local-ai-packaged).
Contributions of all kinds are welcome — bug reports, feature requests,
documentation, and code.

## Getting Started

1. Fork the repository and clone your fork.
2. Copy `.env.example` to `.env` and fill in the required values
   (see "Environment Configuration" in the [README](README.md)).
3. Start the stack:
   ```bash
   python start_services.py --profile cpu
   ```
4. Verify everything is healthy:
   ```bash
   curl http://localhost:8090/health
   ```

## Development Workflow

### Frontend (`localai-admin-dashboard/`)

```bash
cd localai-admin-dashboard
source ~/.nvm/nvm.sh && nvm use 20
npx pnpm install
npx pnpm build         # production build
npx pnpm test          # vitest (one-shot, no watch)
npx pnpm lint          # eslint
npx pnpm format        # prettier
```

### Document Processor (`document-processor/`)

```bash
cd document-processor
pip install -r requirements.txt
pytest tests/ -v
```

After modifying Python code, rebuild the container:

```bash
docker compose -p localai up -d --build document-processor
```

## Code Standards

- **TypeScript**: strict mode, absolute imports with `@/` prefix, prefer
  functional components and hooks.
- **Python**: type hints, prefer functions over classes, max 500 lines per
  file.
- **No hardcoded regex for entity extraction** — use LLM-based extraction.
  See [docs/guides/LLM_ENTITY_EXTRACTION.md](docs/guides/LLM_ENTITY_EXTRACTION.md).
- **Tests use real systems** — no mocks, no skips. See the testing section
  in [CLAUDE.md](CLAUDE.md) for the full rationale.

## Pull Request Process

1. Create a topic branch off `main` (e.g., `fix/upload-progress-stall`).
2. Keep PRs focused. One logical change per PR.
3. Add or update tests for any behavior change.
4. Run `pnpm lint`, `pnpm test`, and `pytest` locally before opening the PR.
5. Write a clear PR description explaining **why**, not just what.
6. Be patient — reviews may take a few days.

## Commits

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add OCR fallback for scanned PDFs
fix: prevent infinite loop in template validator
docs: clarify Snowflake key-pair setup
chore: bump docling to 2.x
```

Sign your commits with `Signed-off-by:` (DCO) — `git commit -s`.

## Reporting Bugs

Open a GitHub Issue with:

- What you expected to happen
- What actually happened (logs, screenshots help)
- Minimum steps to reproduce
- Your environment (OS, Docker version, profile, LLM provider)

For security issues, see [SECURITY.md](SECURITY.md) — **do not open a
public issue**.

## Code of Conduct

By participating, you agree to abide by the
[Code of Conduct](CODE_OF_CONDUCT.md). In short: be respectful, assume
good faith, and help us keep this a welcoming community.

## License

By contributing, you agree that your contributions will be licensed under
the [Apache License 2.0](LICENSE).
