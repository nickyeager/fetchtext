# GitHub Copilot Instructions

## Project Overview
This is a FetchText admin dashboard with Docker-based services including Supabase, N8N, Flowise, and monitoring stack. Built with Vite + React + TanStack Router + shadcn/ui.

## Testing Framework
- **Always use Vitest** for all testing needs in this project
- When generating test code, use Vitest syntax and utilities
- For test configuration, prefer `vitest.config.ts` over other test runners
- Use Vitest's built-in mocking, assertions, and testing utilities
- When creating new test files, use Vitest's `describe`, `it`, `expect` syntax
- For React component testing, use `@testing-library/react` with Vitest
- Use Vitest's `vi.mock()` for mocking instead of `jest.mock()`
- **Always run vitest without the watcher flag**: Use `npx vitest` instead of `npx vitest --watch`
- For single test files: `npx vitest [test-file] --reporter=verbose`
- For all tests: `npx vitest --reporter=verbose`

## Test File Conventions
- Test files should use `.test.ts`, `.test.tsx`, or `.spec.ts`, `.spec.tsx` extensions
- Place test files either:
  - Adjacent to the source file (recommended)
  - In `__tests__` directories
  - In dedicated `test` or `tests` directories

## Testing Best Practices
- Write unit tests for individual functions and components
- Use integration tests for feature workflows
- Prefer explicit imports over globals when possible
- Use Vitest's built-in coverage reporting with `--coverage` flag
- **Never use watch mode in CI or automated testing**

## Configuration Guidelines
- Use `vitest.config.ts` for test configuration
- Extend from `vite.config.ts` when possible for consistency
- Configure test environment (`jsdom` for React, `node` for backend)
- Set up proper path mapping and aliases in test config

## Docker & Container Rules
- **Always use modern Docker Compose syntax**: Use `docker compose` instead of `docker-compose`
- For all Docker commands, prefer `docker compose` over `docker-compose`
- When writing Docker-related scripts, use the modern syntax
- Container names should follow the pattern: `localai-<service-name>`
- **Mandatory Network Policy**:
  - All containers (existing or newly added) MUST be attached to the shared compose network named `local-ai`.
  - When suggesting new `docker compose` service definitions, always include:
    ```yaml
    networks:
      - local-ai
    ```
    unless the service inherits it via an extension anchor already containing the network.
  - When providing standalone `docker run` examples, ALWAYS include `--network local-ai` (and, if documenting first-time setup, precede with `docker network create local-ai || true`).
  - NEVER create alternative networks for core app services; reuse `local-ai` to ensure inter-service DNS works (e.g., `document-processor`, `supabase-kong`, `ollama`).
  - If a service requires isolation, document rationale explicitly and STILL attach an additional network rather than removing `local-ai`.
  - Review diffs to ensure no new service omits the network; missing network attachment is a blocking issue.

## Supabase Infrastructure
- **Supabase is already running** in the parent directory Docker setup (`../docker-compose.yml`)
- **DO NOT create new Supabase projects** - use the existing infrastructure
- Supabase is included via: `include: - ./supabase/docker/docker-compose.yml`
- Environment variables are set in parent `.env` file:
  - `VITE_SUPABASE_URL: http://kong:8000` (via Docker internal network)
  - `VITE_SUPABASE_ANON_KEY: ${ANON_KEY}` (from parent .env)
- Local Supabase URL: `http://localhost:8000` (Kong gateway)
- Edge Functions run in: `supabase-edge-functions` container
- Use existing Supabase containers: `supabase-db`, `supabase-auth`, `supabase-storage`, etc.
- Use Supabase client from `@/lib/supabase` for all auth operations
- Authentication context is in `@/context/auth-context.tsx`
- Always check user session before protected operations

## Email Service Configuration
- **Always use N8N workflows for all email delivery** - DO NOT use Supabase Edge Functions
- **DO NOT create or use Supabase Edge Functions** for email services
- **DO NOT use direct SendGrid API calls** from the frontend
- Use N8N webhook endpoints for email integration: `http://localhost:5678/webhook/[email-type]`
- Email configuration handled via N8N workflow variables and parent environment
- SendGrid API Key: Store in parent `.env` file for N8N workflow access
- Verified sender: `yeag123@gmail.com`
- N8N workflows are deployed in the existing N8N container
- Use N8N development mode for testing, production N8N workflows for real emails
- Frontend should call N8N webhook endpoints directly (e.g., `http://localhost:5678/webhook/password-reset-email`)
- N8N provides better email template management, workflow automation, and debugging capabilities
- All email types (password reset, welcome, two-factor) should use dedicated N8N workflows

## React & TypeScript Patterns
- Use TanStack Router for routing (not React Router)
- Import components using absolute paths with `@/` prefix
- Use TypeScript strictly - always type props and state
- Prefer function components over class components
- Use React hooks for state management
- Use `@tanstack/react-query` for data fetching and caching
- Use `@tanstack/react-table` for complex table functionality

## UI Component Library
- Use shadcn/ui components from `@/components/ui/`
- Follow the existing component patterns
- Use Tailwind CSS for styling
- Maintain consistent spacing and typography
- Use Radix UI primitives as the foundation for components
- Use Lucide React for icons

## File Organization
- Components go in `src/components/`
- Features go in `src/features/`
- Utilities go in `src/lib/`
- Types go in `src/types/`
- Tests should be co-located with source files
- Routes go in `src/routes/` (auto-generated routeTree.gen.ts)

## Code Generation Preferences
When suggesting code, always:
- Import test utilities from `vitest` instead of `jest`
- Use `vi` namespace for mocking utilities
- Include proper TypeScript types for test functions
- Follow the project's existing test patterns and structure
- Use the project's established folder structure
- Include proper error handling and loading states
- Use async/await instead of .then() for promises
- Use TanStack Router navigation patterns
- Include proper form validation with react-hook-form and zod

## Security & Environment
- Never hardcode sensitive values - use environment variables
- Always validate environment variables in code
- Use proper CORS settings for API calls
- Implement proper error boundaries in React components
- Use Supabase RLS (Row Level Security) for data access control
- Validate all user inputs on both client and server side

## Development Workflow
- Use `pnpm` as the package manager
- Run `pnpm dev` for development server
- Use `pnpm test` for running tests
- Use `pnpm lint` for code linting
- Use `pnpm format` for code formatting
- Integration tests expect services to be running via Docker Compose

## Planning & Documentation
- **Create all development plans in the `/plans/` directory** at the root of the repository
- Plans should be written in Markdown format with clear sections
- Include: Problem Statement, Current Implementation Analysis, Proposed Solution, Implementation Steps, Success Criteria
- Name plans descriptively: `YYYYMMDD-feature-name-plan.md` (e.g., `20240904-template-generation-fix-plan.md`)
- Plans should be actionable and include technical details
- Update plans as implementation progresses with status updates 

## End-to-End (Playwright) Testing Policies (Document Processing & Uploads)
These policies govern Playwright E2E tests that exercise the document processing workflow (file upload → backend extraction → progressive / final results). They enforce a strict no-mock requirement.

### 1. Backend Health Enforcement
- Before performing any upload or extraction assertions, tests MUST probe `http://localhost:8090/health/` with a maximum timeout of 3000 ms.
- If the health check does not return an HTTP 200 OK, the test MUST fail fast (throw) — do NOT silently skip or fallback.
- Rationale: The frontend has internal mock/fallback logic when the backend is absent; we must never let E2E tests pass via those code paths.

### 2. Real Network Request Verification
- A `page.waitForRequest()` listener MUST be registered *before* calling `setInputFiles()` to capture at least one real backend-bound request whose URL matches one of:
  - `/api/enhanced-documents/` (enhanced processing endpoints)
  - `/documents/upload` (basic upload path)
- If no qualifying request is observed within 15s after file selection, the test MUST fail.
- Do NOT broaden the matcher to generic `localhost:8090` unless additional routes become part of the official API contract.

### 3. No Mock / Fallback Mode
- The document processor service code can return mock data when `NODE_ENV === 'test'` or when the backend is unreachable.
- E2E tests MUST run in an environment where `NODE_ENV` is not forcing the mock path (prefer the preview/production build or dev server with backend running) and the backend is reachable.
- Any introduction of explicit mocking (network interception, fixtures replacing responses) is prohibited for these flows.

### 4. Progressive Processing Instrumentation
- Tests may rely on hidden instrumentation markers:
  - `data-testid="processing-heartbeat"` with attributes `data-updates` & `data-ticks` (activity / liveness)
  - `data-testid="processing-init"` (initialization)
  - `data-testid="processing-generic-started"` (generic fallback branch)
- Heartbeat presence or arrival of new log lines resets idle timers.
- An idle threshold of 15s (no new logs and no heartbeat changes) should trigger early diagnostic capture (`idle-dom`, `idle-logs`) and terminate the wait loop.

### 5. Completion Criteria
- Template (smart) mode: Success requires `extracted-fields` container visibility AND at least one `extracted-field` child with non-empty text.
- Log-only completion (terminal `COMPLETED` line without extracted fields) is considered a failure UNLESS explicitly annotated as a temporary soft condition. If a temporary soft path is used (e.g., `test.skip` after attaching diagnostics), an issue MUST be created to track restoration of full extraction.
- Generic mode (no template): Either `extracted-fields` OR `generic-processed-document` is acceptable.

### 6. Diagnostics & Attachments
- On any non-terminal timeout or idle timeout, attach:
  - Final DOM snapshot (`final-dom` or `idle-dom`).
  - Tail logs (`processing-logs-final` or `idle-logs`) truncated to last 8–10 KB.
  - Optional: heartbeat attributes snapshot if available.
- On missing extraction in template mode (but logs show `COMPLETED`), attach `completed-no-fields` before failing or soft-skipping.

### 7. Fast Failure Philosophy
- Health fail → immediate throw.
- No backend request observed → immediate throw (after 15s observer window max).
- Idle detection before global max wait (e.g., 120s) → fail early with diagnostics; do not wait out full timeout.

### 8. Test Structure Requirements
- Register backend request watcher BEFORE `setInputFiles` to avoid race conditions.
- Encapsulate wait logic in a helper (e.g., `waitForProcessing`) that implements:
  - Terminal detection (logs regex + extracted fields + generic fallback) 
  - Heartbeat / idle monitoring
  - Diagnostic attachments on early exits
- Use explicit polling intervals ≥ 500ms to reduce flakiness & CPU load.

### 9. Prohibited Patterns
- No unconditional `page.waitForTimeout` used as a primary completion strategy (only small grace windows < 5s after detection of near-complete state are allowed).
- No network interception that stubs backend responses.
- No silent skipping when backend unavailable; failure must be explicit.

### 10. Extensibility Guidelines
- If new backend endpoints are introduced for processing, extend the request matcher list and document the addition here.
- If additional instrumentation attributes are added (e.g., `data-phase`), update wait helper logic and this section in the same PR.

### 11. Local Run Expectations
Prerequisites before running E2E processing tests:
1. All docker services (including document processor on port 8090) are up.
2. Supabase & auth layers initialized (global setup handles auth state unless `E2E_SKIP_GLOBAL_SETUP=1`).
3. Test template referenced by `TEST_TEMPLATE_ID` exists with at least one smart variable.

### 12. Issue Tracking
- Any relaxation (skip on completion without extracted fields) MUST link an issue ID in a code comment above the conditional skip so it is tracked and later removed.

---
Failure to follow the above E2E policies may allow silent regressions in real document processing or accidental reliance on mock data; enforce strictly in code review.