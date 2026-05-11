<!-- markdownlint-disable-file -->
# Task Research Notes: Supabase URL Embed Policy and Playwright CI Integration

## Research Executed

### File Analysis
- docker-compose.yml
  - `dashboard` build args set `VITE_SUPABASE_URL: http://localhost:8000` and `VITE_SUPABASE_ANON_KEY: ${ANON_KEY}`; backend services use internal `SUPABASE_URL: http://supabase-kong:8000`.
- dashboard/Dockerfile
  - Accepts `ARG VITE_SUPABASE_URL` and `ARG VITE_SUPABASE_ANON_KEY`; exports them to `ENV` so Vite can embed values during build.
- dashboard/src/lib/supabase.ts
  - Supabase client constructed from `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; confirms build-time embedding behavior applies.
- dashboard/tests/e2e/config-embed.pw.spec.ts
  - E2E test asserts production bundle JS contains `http://localhost:8000` and not Docker-internal hosts (`kong`, `supabase-kong`). Guards against regressions.
- dashboard/tests/auth/global-setup.ts
  - `globalSetup` performs a password grant against `SUPABASE_URL` with `SUPABASE_ANON_KEY`, writes Playwright `storageState` with session; expects `BASE_URL` front-end health to be 200.
- .github/instructions/ARCHITECTURE.md and ARCHITECTURE.md
  - Document split between host URL (`http://localhost:8000`) for browser and internal DNS (`http://supabase-kong:8000`) for container-to-container calls.
- .github/instructions/copilot-instructions.md
  - Contains outdated guidance suggesting `VITE_SUPABASE_URL: http://kong:8000` for browser builds. This contradicts the corrected policy and must be updated.
- Caddyfile
  - `reverse_proxy supabase-kong:8000` aligns internal upstream to service DNS while public access uses `http://localhost:8000`.

### Code Search Results
- "VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY|import.meta.env"
  - Found in front-end config, tests, `.env*`, and Vitest config; consistent usage of `http://localhost:8000` for browser context.
- "supabase-kong|\\bkong:8000\\b|http://localhost:8000|SUPABASE_URL|ANON_KEY"
  - Internal services and scripts use `supabase-kong:8000`; public docs and tests point to `http://localhost:8000`. Outdated references remain in `.github/instructions/copilot-instructions.md`.

### External Research
- #fetch:https://vitejs.dev/guide/env-and-mode.html
  - Vite exposes variables prefixed with `VITE_` at build time via `import.meta.env`; changing them requires rebuilding the bundle.
- #fetch:https://playwright.dev/docs/test-auth#global-setup-for-authentication
  - Playwright supports `globalSetup` to authenticate once and reuse `storageState` across tests; file path configured via `use.storageState`.
- #fetch:https://supabase.com/docs/reference/auth/signinwithpassword
  - Supabase password sign-in uses GoTrue; programmatic auth with `grant_type=password` is supported via `/auth/v1/token` with `apikey` and bearer headers.
- #fetch:https://docs.konghq.com/gateway/latest/
  - Kong acts as the API gateway; services are reachable internally by service name (`supabase-kong`) and externally via host port (`http://localhost:8000`).

### Project Conventions
- Standards referenced: `.github/instructions/ARCHITECTURE.md`, `ARCHITECTURE.md`, `.env*` patterns, Vite `VITE_*` env usage, Playwright config in `playwright.config.ts`.
- Instructions followed: Enforce host URL for browser builds; use internal DNS for container networking; rebuild Vite bundle on env changes; authenticate via Playwright `globalSetup` with real Supabase.

## Key Discoveries

### Project Structure
Front-end (Vite + React) reads `VITE_*` env at build time; Docker image builds embed `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Backend services (e.g., document-processor) use runtime `SUPABASE_URL` pointing to `http://supabase-kong:8000`. Kong listens on host `:8000` and routes to internal services.

### Implementation Patterns
- Browser builds must never reference Docker-internal DNS (`kong`, `supabase-kong`) due to DNS resolution failures (net::ERR_NAME_NOT_RESOLVED) in the user's network context.
- Vite env changes require a rebuild (`docker compose build dashboard`) and container restart to take effect.
- Playwright uses `globalSetup` to perform a password grant against Supabase and persists `storageState` to start tests authenticated.
- A regression test (`config-embed.pw.spec.ts`) asserts the built JS includes `http://localhost:8000` only.

### Complete Examples
```ts
// Source: dashboard/tests/auth/global-setup.ts (verified)
import { request } from '@playwright/test';

const ctx = await request.newContext({
  baseURL: process.env.SUPABASE_URL!,
  extraHTTPHeaders: {
    apikey: process.env.SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY!}`,
    'Content-Type': 'application/json',
  },
});
const resp = await ctx.post('/auth/v1/token?grant_type=password', {
  data: { email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD },
});
if (resp.status() !== 200) throw new Error(`Auth failed: ${resp.status()} ${await resp.text()}`);
```

### API and Schema Documentation
- Supabase Auth (GoTrue) password grant: `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` with headers `apikey` and `Authorization: Bearer <anon_key>`; payload `{ email, password }`.
- Vite env: `import.meta.env.VITE_*` variables are injected at build time; no runtime substitution without rebuild.
- Playwright `storageState`: `use.storageState` can point to JSON created during `globalSetup` to preload localStorage/cookies.

### Configuration Examples
```yaml
# docker-compose.yml (frontend build args)
services:
  dashboard:
    build:
      args:
        VITE_SUPABASE_URL: http://localhost:8000
        VITE_SUPABASE_ANON_KEY: ${ANON_KEY}
    environment:
      # Runtime-only env for other libs if needed; Vite values come from build args
      NODE_ENV: production

# Playwright env (.env.e2e)
SUPABASE_URL=http://localhost:8000
SUPABASE_ANON_KEY=${ANON_KEY}
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=changeme
```

### Technical Requirements
- Front-end must embed `VITE_SUPABASE_URL=http://localhost:8000` for browser usage; any `kong`/`supabase-kong` references in the bundle are invalid.
- Backend/container services must use `SUPABASE_URL=http://supabase-kong:8000` for internal networking.
- Changes to `VITE_*` require full rebuild of the dashboard image and container restart.
- E2E tests should include a regression check that the bundle does not contain internal DNS.

## Recommended Approach
Adopt and enforce a split-URL policy with automation:
- Browser builds: `VITE_SUPABASE_URL=http://localhost:8000` (embedded by Vite at build time).
- Container-to-container: `SUPABASE_URL=http://supabase-kong:8000`.
- Add/keep an E2E bundle assertion test to prevent regressions.
- Update contributor guidance to remove outdated suggestions of `VITE_SUPABASE_URL=http://kong:8000`.
- Integrate Playwright E2E (including config-embed and auth checks) into CI, using `.env.e2e` to supply test credentials and Supabase URL/keys.

## Implementation Guidance
- Objectives: Prevent browser DNS failures; ensure correct Supabase URL is embedded; validate auth endpoints; automate checks in CI.
- Key Tasks: 
  - Update `.github/instructions/copilot-instructions.md` to replace `VITE_SUPABASE_URL: http://kong:8000` with `http://localhost:8000` (browser builds), keeping `supabase-kong` for containers only.
  - Ensure `docker-compose.yml` continues to pass correct build args for the dashboard and runtime env for backends.
  - Run `docker compose build --no-cache dashboard && docker compose up -d dashboard` on env changes.
  - Run Playwright tests with `globalSetup` to verify auth and `config-embed.pw.spec.ts` to guard against regressions.
  - Wire E2E into CI pipeline with a minimal Supabase subset started and `.env.e2e` secrets injected.
- Dependencies: Supabase services via Kong (`:8000`), ANON_KEY in `.env`, Playwright test runner, Docker.
- Success Criteria: 
  - Built JS bundle contains `http://localhost:8000` and excludes `kong`/`supabase-kong`.
  - `globalSetup` can perform password grant and produce a valid `storageState`.
  - Auth verification tests pass against `http://localhost:8000` endpoints.
  - CI run fails if bundle contains internal DNS or auth endpoints are unreachable.
