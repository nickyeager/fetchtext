# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in FetchText, please report it
privately. **Do not open a public GitHub issue.**

Email: **security@fetchtext.io**

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce (proof-of-concept code, minimal reproduction)
- The version, commit SHA, or deployment configuration affected
- Any suggested mitigation, if known

We will acknowledge your report within **3 business days** and aim to provide
an initial assessment within **7 business days**. Critical issues will be
prioritized for an out-of-band release; lower-severity issues will be batched
into the next scheduled release.

We follow coordinated disclosure: please give us a reasonable window
(typically 90 days) to release a fix before publishing details.

## Supported Versions

FetchText is pre-1.0. Only the `main` branch receives security fixes during
this period. Pinned releases may receive backports on a case-by-case basis.

## Scope

In scope:

- The FetchText admin dashboard (`dashboard/`)
- The document processor service (`document-processor/`)
- Service orchestration (`docker-compose.yml`, `start_services.py`,
  `Caddyfile`)
- Default configuration shipped in `.env.example`

Out of scope (report directly to upstream):

- Vulnerabilities in third-party dependencies (Supabase, n8n, Ollama, etc.) —
  please report to the upstream project
- Issues that require an attacker to already have privileged access to the
  host (e.g., root on the Docker host)
- Self-inflicted misconfiguration not introduced by FetchText defaults

## Hall of Fame

Security researchers who report valid issues will be credited in release
notes (with permission).
