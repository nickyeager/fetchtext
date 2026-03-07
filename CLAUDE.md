## Application Goal

**FetchText** is a document processing and generation platform that:
1. **Processes documents** - Extracts structured data from PDFs, images, and text files
2. **Extracts variables** - Uses AI-powered smart templates with LLM-based entity extraction (NO hardcoded regex)
3. **Generates new documents** - Automatically creates new documents using extracted data

## 🧪 PRIME DIRECTIVE: TEST-DRIVEN DEVELOPMENT (TDD)

**When modifying existing code or changing behavior, you MUST adopt a TDD approach.**

### The TDD Workflow

1. **Write the test FIRST** - Before touching any implementation code, write a failing test that defines the expected behavior
2. **Run the test - watch it FAIL** - Verify the test fails for the right reason (proves the test is valid)
3. **Write MINIMAL code to pass** - Only write enough implementation to make the test pass
4. **Run the test - watch it PASS** - Confirm the implementation satisfies the requirement
5. **Refactor if needed** - Clean up the code while keeping tests green

### When TDD is MANDATORY

| Scenario | TDD Required |
|----------|--------------|
| Bug fixes | ✅ Write test that reproduces the bug FIRST |
| Modifying existing functions | ✅ Write test for new behavior FIRST |
| Adding features to existing code | ✅ Write test for the feature FIRST |
| Refactoring | ✅ Ensure tests exist BEFORE refactoring |
| Changing API contracts | ✅ Write integration test FIRST |
| Greenfield code (new files) | Recommended but not mandatory |

### TDD Discipline Rules

- **NEVER modify implementation before writing the test** - The test defines the requirement
- **NEVER skip the "red" phase** - If your test passes immediately, it's not testing new behavior
- **Tests are the specification** - Write tests that describe WHAT the code should do, not HOW
- **One behavior per test** - Each test should verify one specific behavior change
- **Run tests after EVERY change** - Fast feedback loop is essential

### Example TDD Flow

```
## Task: Add validation to prevent empty usernames

### Step 1: Write failing test
it('should reject empty username', () => {
  expect(() => createUser('')).toThrow('Username cannot be empty');
});

### Step 2: Run test - RED
$ npx vitest run user.test.ts
❌ FAIL - createUser('') did not throw (expected)

### Step 3: Write minimal implementation
function createUser(username: string) {
  if (!username) throw new Error('Username cannot be empty');
  // ... existing code
}

### Step 4: Run test - GREEN
$ npx vitest run user.test.ts
✓ PASS - 1 test passed

### Step 5: Refactor if needed (tests stay green)
```

## 🚫 PRIME DIRECTIVE: NO MOCKS OR SKIPS IN TESTS

**ALL tests MUST test real systems. Mocked tests are FORBIDDEN.**

### Absolute Rules

| Rule | Enforcement |
|------|-------------|
| **NO vi.mock()** | Tests must call real backend APIs, real databases, real services |
| **NO .skip()** | Every test must run. If a test can't pass, it must FAIL loudly, not skip |
| **NO mocked responses** | Tests must verify actual extracted values from real data |
| **NO synthetic data** | Use real fixture files from `tests/fixtures/` directory |
| **Playwright REQUIRED** | All UI tests must run in real browser with real user interactions |
| **Console errors = FAIL** | Tests must verify browser console has ZERO errors |

### Forbidden Patterns

```typescript
// ❌ FORBIDDEN - Mocking backend services
vi.mock('@/lib/document-processor-enhanced');
vi.mock('@/services/unified-document-service');
vi.mock('@/lib/supabase');

// ❌ FORBIDDEN - Skipping tests
it.skip('should process documents', () => { ... });
describe.skip('Template Matching', () => { ... });

// ❌ FORBIDDEN - Silent pass when service unavailable
if (!backendAvailable) {
  console.log('Skipping - services not available');
  return; // Silently passes!
}

// ❌ FORBIDDEN - Fake inline data
const testFile = new File(['fake content'], 'test.pdf');

// ❌ FORBIDDEN - Claiming a fix works without proof
"The fix has been applied" // Where's the test output?
```

### Required Patterns

```typescript
// ✅ REQUIRED - Fail when services unavailable
if (!backendAvailable) {
  throw new Error('Backend not available - cannot run integration test');
}

// ✅ REQUIRED - Use real fixtures
const contractFile = await loadFixture('real-test-contract.txt');

// ✅ REQUIRED - Call real APIs
const response = await fetch(`${BACKEND_URL}/api/enhanced-documents/evaluate`);

// ✅ REQUIRED - Assert on actual extracted values
expect(result.extracted_fields.vendor_name).toBe('Acme Corp');

// ✅ REQUIRED - Check for console errors in Playwright
page.on('console', msg => {
  if (msg.type() === 'error') {
    throw new Error(`Console error: ${msg.text()}`);
  }
});
```

### Test Structure Requirements

1. **Backend Health Check** - Verify services are running before test execution
2. **Real Data Upload** - Upload actual fixture files to test document processing
3. **UI Verification** - Use Playwright to verify toast notifications, extracted values, UI updates
4. **Console Monitoring** - Fail test if ANY console errors appear
5. **Database Verification** - Query real database to verify persistence
6. **Complete Workflows** - Test from upload → extract → display → save (end-to-end)

**If a test uses mocks, it's not a test - it's a lie.**

## ⚠️ PRIME DIRECTIVE: VERIFY EVERY CHANGE

**NEVER declare any change complete without showing actual test output that proves it works.**

### After ANY Code Change

1. **Backend Python changes** → Rebuild container → Run test → Verify output
2. **Frontend changes** → Build → Run tests → Verify in browser
3. **Algorithm/logic changes** → Run before/after comparison with real numbers

### For Bug Fixes

Before claiming ANY fix is complete:
1. **Write a test that replicates the exact user scenario** - Not a simplified version
2. **Run the test BEFORE the fix** - It MUST fail (proves the test catches the bug)
3. **Apply the fix**
4. **Run the test AFTER the fix** - It MUST pass (proves the fix works)
5. **Show the test output** - Both failing and passing runs

### For Feature Completion

Before declaring ANY feature complete or deployable:
1. **Document the exact end-user workflow** - Step-by-step instructions for testing in the admin frontend
2. **Create comprehensive tests** - Cover the ACTUAL real-world usage
3. **RUN THE TESTS** - Actually execute and verify they pass
4. **Identify any blockers** - Note authentication, UI, or functionality issues
5. **Provide workarounds** - If blockers exist, explain how to work around them

### Mandatory Gate Test — Stucco Contract Upload

**After EVERY implementation session**, before declaring work complete, you MUST run the stucco contract E2E test. This is the primary smoke test for the full document processing pipeline (upload → SSE streaming → template matching → field extraction → detail page rendering).

```bash
cd localai-admin-dashboard
source ~/.nvm/nvm.sh && nvm use 20
E2E_SKIP_GLOBAL_SETUP=1 npx playwright test tests/e2e/document-processing/stucco-upload-e2e.pw.spec.ts --reporter=list
```

**Expected result**: 2 passed (backend health + full upload flow)
**Key assertions verified**: SSE streaming, Qdrant template matching, extracted field rendering, "Nicholas Yeager" and "$8,000" values visible on detail page.

**If this test fails, the implementation is NOT complete.** Investigate and fix before finishing.

### Integration Test Location

All integration tests go in: `src/__tests__/integration/`
Naming convention: `{feature-name}.test.ts`

### End-User Verification Template

```
## End-User Testing Instructions for [Feature Name]

### Prerequisites:
- Services running: `python start_services.py --profile cpu`
- User account created (provide specific steps)

### Step-by-Step User Workflow:
1. Navigate to http://localhost:5173
2. [Specific UI interactions...]
3. [Expected results at each step...]

### Known Issues & Workarounds:
- [Any authentication or UI blockers]
- [Temporary solutions for testing]

### Verification Checklist:
- [ ] User can complete full workflow without technical intervention
- [ ] All expected functionality works as described
- [ ] Error states are handled gracefully
```

## ⚠️ CRITICAL: No Hardcoded Regex for Entity Extraction

**ALL entity extraction MUST use LLM-based approaches.**

**NEVER use hardcoded regex patterns for entity extraction.** This includes:
- Named Entity Recognition (NER) - persons, organizations, locations
- Field extraction - dates, currencies, emails, phone numbers, addresses
- Document type detection based on content patterns
- Template field matching

### Allowed Uses of Regex

Regex is ONLY acceptable for:
1. **JSON parsing/cleanup** - Fixing malformed LLM responses (trailing commas, etc.)
2. **HTML/text processing** - Stripping tags, normalizing whitespace
3. **LLM-generated patterns** - If the LLM creates a regex for a specific field, that can be cached and reused
4. **Validation (not extraction)** - Confirming an LLM-extracted email has valid format

### Entity Extraction Architecture

```
Document Text → [LLM Entity Extractor] → [Entity Index]
    ├─ Send text + extraction prompt to LLM
    ├─ Request structured JSON output with entity types
    ├─ Parse response and validate
    └─ Store with embeddings for similarity search
```

```python
# ❌ BAD - Hardcoded regex
def extract_emails(text):
    return re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}', text)

# ✅ GOOD - LLM-based extraction
async def extract_entities(text: str, llm_service) -> dict:
    prompt = """Extract all entities from this document.
    Return JSON with: persons, organizations, dates, currencies, emails, etc.
    Include confidence scores and source context for each entity."""
    response = await llm_service.generate(prompt + text)
    return parse_llm_response(response)
```

Tests for entity extraction must use real documents, call actual LLM services, and validate against ground truth.

See [docs/guides/LLM_ENTITY_EXTRACTION.md](docs/guides/LLM_ENTITY_EXTRACTION.md) for detailed guide.

## Architecture Overview

Self-hosted AI platform with three main components:

1. **LocalAI Admin Dashboard** (`localai-admin-dashboard/`) - React/TypeScript frontend with TanStack Router
2. **Document Processor** (`document-processor/`) - Python FastAPI service for document processing using Docling
3. **Service Infrastructure** - Docker Compose orchestrated services including Supabase, N8N, Ollama, and monitoring

**IMPORTANT**: Always source NVM and use Node 20 before running pnpm commands:
```bash
source ~/.nvm/nvm.sh && nvm use 20 && npx pnpm [command]
```

### Key Documentation

- **Documentation Index**: [docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md)
- **Document Upload Flow**: [localai-admin-dashboard/DOCUMENT_UPLOAD_FLOW.md](localai-admin-dashboard/DOCUMENT_UPLOAD_FLOW.md)
- **Architecture**: [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)
- **Project Structure**: [docs/architecture/PROJECT_STRUCTURE.md](docs/architecture/PROJECT_STRUCTURE.md)
- **Deployment Plan**: [docs/architecture/DEPLOYMENT_PLAN.md](docs/architecture/DEPLOYMENT_PLAN.md)
- **Document Processing Guide**: [docs/guides/DOCUMENT_PROCESSING_COMPLETE_GUIDE.md](docs/guides/DOCUMENT_PROCESSING_COMPLETE_GUIDE.md)
- **Template Matching**: [docs/guides/TEMPLATE_MATCHING_CURRENT_STATE.md](docs/guides/TEMPLATE_MATCHING_CURRENT_STATE.md)
- **Frontend Testing Checklist**: [docs/guides/MANUAL_FRONTEND_TESTING_CHECKLIST.md](docs/guides/MANUAL_FRONTEND_TESTING_CHECKLIST.md)
- **Supabase Deployment Log**: [docs/supabase-deployment-log.md](docs/supabase-deployment-log.md)

### Service Architecture

The platform uses Docker Compose with Caddy as SSL-terminating reverse proxy:
- **External Access Ports**: N8N (:8001), Open WebUI (:8002), Flowise (:8003), Supabase (:8005)
- **Internal Services**: PostgreSQL (:5432), Redis (:6379), Qdrant (:6333), ClickHouse, MinIO
- **AI Services**: Document Processor (:8090/health), Neo4j graph database
- **LLM Support**: Ollama (local) and Azure OpenAI (cloud) - configurable via environment variables

## ⚠️ Authentication & Database Issues (Lessons Learned)

Critical authentication failure that cascaded into database access issues:
1. JWT Token Mismatch between frontend and backend
2. Kong CORS blocking PostgREST headers (`Accept-Profile`, `Content-Profile`)
3. PostgreSQL role permission failure
4. RLS policy conflicts from duplicate policies

### Prevention

- **JWT Sync**: Frontend `.env.local` ANON_KEY must match root `.env`. See [Environment Configuration](#environment-configuration).
- **CORS**: Ensure Kong includes `Accept-Profile` and `Content-Profile` headers
- **Role Permissions**: Always grant: `GRANT anon, authenticated, service_role TO authenticator;`
- **RLS**: Use `DROP POLICY IF EXISTS` before creating. Specify roles explicitly. Single source of truth in migrations.

### Recovery Checklist

1. Check JWT token match: Frontend `.env.local` vs Backend `.env`
2. Verify Kong CORS headers include PostgREST requirements
3. Test PostgreSQL role permissions: `SELECT current_setting('role')`
4. Review RLS policies for duplicates: `SELECT * FROM pg_policies`
5. Clear browser cache and re-login
6. Restart: `docker compose -p localai restart supabase-rest supabase-kong`

### Database Safety Protocol

1. **Always backup** before modifying roles/permissions
2. **Test on single table** before applying database-wide changes
3. **Use transactions** for permission changes
4. **Document all changes** in migration files
5. **Never drop/recreate** auth schema or user tables

## Common Development Commands

### Starting Services
```bash
python start_services.py --profile cpu          # CPU only
python start_services.py --profile gpu-nvidia   # NVIDIA GPU
python start_services.py --profile gpu-amd      # AMD GPU
python start_services.py --profile gpu-nvidia --environment public  # Production
```

### Docker Management
```bash
# Use `docker compose` (modern syntax, not `docker-compose`)
docker compose -p localai -f docker-compose.yml --profile cpu up -d
docker compose -p localai down
docker compose logs -f [service_name]
docker compose ps
```

### ⚠️ CRITICAL: Auto-Restart Servers After Code Changes

**MANDATORY: Claude MUST automatically restart services after modifying server code. Do NOT tell the user to restart - DO IT YOURSELF.**

| Change Type | Required Action | Command |
|-------------|-----------------|---------|
| `document-processor/app/**/*.py` | **Rebuild container** | `docker compose -p localai up -d --build document-processor` |
| `localai-admin-dashboard/**` | **Rebuild immediately** | `source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm build` |
| `.env` changes | **Restart ALL containers** | `docker compose -p localai restart` |
| `supabase/migrations/` | **Apply migration** | Use Supabase CLI or MCP tool |

**CRITICAL: `restart` reuses old image (changes ignored). `--build` rebuilds from source (changes applied).**

After rebuilding, verify health:
```bash
docker compose -p localai ps document-processor
docker compose -p localai logs document-processor --tail=20
# Look for: "Application startup complete"
```

### Frontend Development
```bash
cd localai-admin-dashboard/
npx pnpm build        # Production build (preferred for testing changes)
npx pnpm test         # Run Vitest tests (DO NOT use --watch flag)
npx pnpm test:auth    # Run authentication compliance tests
npx pnpm check:auth   # Quick authentication compliance check
npx pnpm lint         # ESLint
npx pnpm format       # Prettier formatting
```

### Document Processor Testing

⚠️ **Always install ALL dependencies before running tests:**
```bash
cd document-processor/ && pip install -r requirements.txt
```

```bash
cd document-processor/
python run_tests.py          # Comprehensive test suite
python test_api_quick.py     # Quick API tests
pytest tests/ -v             # Direct pytest
```

### Supabase Management

⚠️ **Production uses Managed Supabase, not Docker**

**Local Development**:
```bash
cd supabase/
npx pnpm dev:studio       # Local Supabase Studio
npx pnpm generate:types   # Generate TypeScript types
```

**Production** (Managed Supabase):
- **Instance**: https://rawhmcrtzfdhryyfovee.supabase.co
- **SQL Editor**: https://app.supabase.com/project/rawhmcrtzfdhryyfovee/sql/new
- **Deployment Log**: [docs/supabase-deployment-log.md](docs/supabase-deployment-log.md)
- **Migration Process**: Test locally → Document in deployment log → Apply via SQL Editor → Verify

### ⚠️ Database Synchronization Rule

**Both LOCAL Docker Supabase and PRODUCTION managed Supabase MUST stay in sync.**

1. **Apply to local Docker first** - Test the migration locally
2. **Then apply to production** - Use the Supabase MCP tool or SQL Editor
3. **Reload PostgREST schema cache** - `docker kill -s SIGUSR1 supabase-rest`

```bash
# Local Docker
docker exec supabase-db psql -U postgres -d postgres -c "YOUR SQL HERE"
docker kill -s SIGUSR1 supabase-rest
docker exec supabase-db psql -U postgres -d postgres -c "\d table_name"

# Production
mcp__supabase__apply_migration(project_id="rawhmcrtzfdhryyfovee", name="migration_name", query="SQL")
```

**Sync Checklist:**
- [ ] Applied to local Docker Supabase
- [ ] PostgREST schema cache reloaded locally
- [ ] Applied to production Supabase
- [ ] Tested in both environments
- [ ] Documented in deployment log

## Key Technical Patterns

### Development Priorities
1. **Working Code** - Functionality first, optimization later
2. **Validation** - Comprehensive testing with real data
3. **Readability** - Clear, maintainable code structure
4. **Static Analysis** - Type safety and linting

### Module Design Standards
- **Maximum 500 lines per file** - Break down larger modules
- **Comprehensive documentation headers** - Document purpose, inputs, outputs
- **Prefer functions over classes** - Functional approach for better testability
- **Type hints consistently** - TypeScript strict mode and Python `typing` library
- **Avoid conditional imports** - Keep imports at module top level

### Testing Framework
- **Vitest** for all frontend tests (`npx vitest run`, never `--watch`)
- Test files: `.test.ts`, `.test.tsx` extensions
- Co-locate tests with source or use `__tests__/` directories
- All integration tests in `src/__tests__/integration/`
- **pytest** for backend Python tests
- See [No Mocks directive](#-prime-directive-no-mocks-or-skips-in-tests) for all testing rules

### Playwright Integration Testing
- **All UI tests must use Playwright** with real browser interactions
- Test complete user journeys from login to final action
- Include assertion for every user-visible change
- Test error states and edge cases, not just happy paths

### E2E Tests for Long-Running Async Operations (SSE, Polling, WebSockets)

**NEVER use a single long `waitForURL` or `waitForTimeout` for async operations.** This hides stalls and hangs.

| Rule | Enforcement |
|------|-------------|
| **Per-stage monitoring** | Track each processing stage and assert it completes within a timeout |
| **Stall detection** | If no progress for N seconds, FAIL with diagnostics (not silent timeout) |
| **Error state detection** | Watch for error UI states during the operation, fail immediately |
| **Diagnostic screenshots** | Take screenshots at every stage transition AND on failure |
| **Network request monitoring** | Track the async request (SSE/fetch) for HTTP errors and disconnections |
| **Structured results** | Return processing result with stages, timing, and status for assertions |

**Use the stream monitor helper** (`tests/e2e/helpers/stream-monitor.ts`) for SSE document processing tests:

```typescript
// ❌ BAD - Blind wait hides stalls
await page.waitForURL(/\/documents\/[a-f0-9-]+/, { timeout: 240_000 });

// ✅ GOOD - Monitor stages with stall detection
const result = await waitForProcessingCompletion(page, {
  stageTimeout: 90_000,   // Max 90s between stages
  totalTimeout: 240_000,  // Max total time
  screenshotDir: '/tmp/e2e-screenshots',
  log,
});
assertProcessingComplete(result);
// THEN wait for navigation (should be fast after processing completes)
await page.waitForURL(/\/documents\/[a-f0-9-]+/, { timeout: 30_000 });
```

**Required `data-testid` attributes for monitorable async components:**
- `data-testid="processing-log-header"` — status header (Processing Document/Complete/Error)
- `data-testid="processing-progress"` — progress percentage
- `data-testid="processing-stage-entry"` with `data-stage` and `data-stage-status` — each stage
- `data-testid="processing-error-banner"` — error message display

### Comprehensive Logging
Always include structured logging for debugging:
1. Log at every major step (entry/exit, state changes)
2. Log data transformations (before/after states)
3. Include timestamps and context
4. Log API requests/responses and errors with full stack traces
5. Log performance metrics for slow operations

```typescript
console.log('[DocumentUpload] Starting upload process', {
  timestamp: new Date().toISOString(),
  userId: user.id,
  fileSize: file.size,
  fileType: file.type
});
```

### Docker Infrastructure
- Services follow `localai-<service-name>` naming pattern
- Supabase runs in parent Docker setup - DO NOT create new instances
- **macOS Storage**: Uses MinIO S3 backend (port 9010) via docker-compose.override.yml
- **Network**: All services MUST be in the `localai` Docker network

### Frontend Architecture (localai-admin-dashboard/)
- **TanStack Router** for routing (not React Router)
- **shadcn/ui** components from `@/components/ui/`
- **Absolute imports** with `@/` prefix
- **TypeScript strict mode** - always type props and state
- **@tanstack/react-query** for data fetching
- **Supabase client** from `@/lib/supabase` for auth operations

### React Best Practices (Prevent Infinite Loops)

**Common causes & fixes:**
1. **useEffect Dependencies**: Use `useCallback`/`useMemo` for functions/objects in dependency arrays
2. **Hook Return Values**: Memoize with `useMemo` or return stable references
3. **setState in useEffect**: Always use dependency arrays and conditional logic
4. **TanStack Router Hooks**: Call at component top level only, never inside useEffect/useCallback

```typescript
// ❌ Causes infinite loop
useEffect(() => {
  validator.validate(template);
}, [template, validator]); // validator recreates on every render

// ✅ Fixed version
useEffect(() => {
  validator.validate(template);
}, [template]);
```

#### Authentication System (CRITICAL)
- **ALWAYS use authentication utilities** from `@/lib/supabase-auth-utils`
- **`withAuthentication()`** - Wrap all database operations
- **`requireAuthentication()`** - Use for simple auth verification
- **NEVER use `supabase.auth.getUser()` directly** in service files
- **Check compliance**: Run `pnpm check:auth` / `pnpm test:auth`

#### Template Service Architecture
- **Master Template Service** (`master-template-service.ts`): Unified interface for all template types
- **Smart Template Service** (`smart-template-service.ts`): AI-powered templates with extraction
- **Unified Template Service** (`unified-template-service.ts`): Legacy adapter (use `getAllTemplates()`)
- **Template Service** (`template-service.ts`): Standard workflow templates
- **Note**: Rating functionality disabled - `rateTemplate()` methods return false/no-op

### Styling & Theme System
- **TailwindCSS v4** with `@tailwindcss/vite` plugin (no config file needed)
- **CSS Custom Properties** for theming with `oklch()` color space
- **Component Library**: shadcn/ui with `cva` (class-variance-authority)
- **Theme Support**: Light/dark mode with CSS custom properties
- **Always use semantic tokens**: `text-primary`, `bg-secondary` (never hardcoded colors)

```css
/* Primary brand colors */
--primary: oklch(0.208 0.042 265.755);
--primary-foreground: oklch(0.984 0.003 247.858);
--secondary: oklch(0.968 0.007 247.896);
--accent: oklch(0.968 0.007 247.896);
--destructive: oklch(0.577 0.245 27.325);
```

### Email Service Integration
- **Always use N8N workflows** for email delivery, never Supabase Edge Functions
- N8N webhook endpoints: `http://localhost:5678/webhook/[email-type]`
- SendGrid via N8N. Verified sender: `nick@fetchtext.io`

### File Structure
```
localai-admin-dashboard/src/
├── components/       # Reusable UI components
├── features/        # Feature-specific modules
├── lib/            # Utilities and services
├── routes/         # TanStack Router routes
├── types/          # TypeScript type definitions
└── __tests__/      # Test files (when not co-located)

document-processor/
├── app/
│   ├── models/      # Pydantic models
│   ├── routers/     # FastAPI route handlers
│   ├── services/    # Business logic
│   └── config/      # Configuration management
├── tests/           # Test files (pytest)
└── requirements.txt # Python dependencies
```

### Environment Configuration

⚠️ **CRITICAL**: Frontend and backend MUST use the same JWT tokens!

**Backend** (root `.env`):
- Database: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`
- N8N: `N8N_ENCRYPTION_KEY`, `N8N_USER_MANAGEMENT_JWT_SECRET`
- Langfuse: `LANGFUSE_SALT`, `NEXTAUTH_SECRET`
- Azure OpenAI: `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME`, `AZURE_OPENAI_API_VERSION`

**Frontend** (`localai-admin-dashboard/.env.local`):
- `VITE_SUPABASE_URL`: Must point to Kong gateway (default: `http://localhost:8000`)
- `VITE_SUPABASE_ANON_KEY`: **MUST match `ANON_KEY` from root `.env`**

```bash
# Verify JWT tokens match:
grep ANON_KEY .env
grep VITE_SUPABASE_ANON_KEY localai-admin-dashboard/.env.local
```

### AI Services

Dual AI providers switchable via Settings UI (`/settings/ai-models`):

1. **Ollama (Local)** - CPU-based local models on port 11434. Slower but privacy-focused.
2. **Azure OpenAI (Cloud)** - Fast cloud GPT models (~150x faster). Uses `AZURE_OPENAI_*` env vars from root `.env`.

- Default: Ollama. Change via API: `POST http://localhost:8090/models/provider/select {"provider": "azure_openai"}`
- User preference persists across sessions
- Frontend includes timeout handling and fallback evaluation

## Service-Specific Notes

### Document Processor
- FastAPI-based Python service using Docling
- Health endpoint: `:8090/health`
- Shared volumes for document uploads, processing, and temp files
- **Package Management**: Use `uv` with `pyproject.toml`
- **Recommended**: `loguru` for logging, `typer` for CLI

### Supabase Integration
- Local URL: `http://localhost:8000` (Kong gateway)
- Auth context in `@/context/auth-context.tsx`
- Use Row Level Security (RLS) for data access control

#### Database Schema - Templates
Unified template architecture (migration 010):
- **`smart_templates`**: Single table with AI-powered extraction and regex fallback
  - `smart_variables`: AI-powered field definitions
  - `regex_fallback`: Fallback patterns when AI confidence is low
  - `generation_settings`: Document generation config
- **`template_categories`**: Categories for organizing templates

### Monitoring Stack
- Langfuse for AI observability on port :8007
- Prometheus, Grafana, and scripts in `monitoring/`
- Health check: `./quick_health_check.sh`

## Development Workflow

1. **Environment Setup**: Copy `.env.example` to `.env` and configure secrets
2. **Service Startup**: Use `python start_services.py` with appropriate profile
3. **Frontend Development**: Work in `localai-admin-dashboard/` with `pnpm build` to test changes
4. **Testing**: Vitest for frontend, pytest for document processor
5. **Deployment**: Use `--environment public` flag for production

### Executing Implementation Plans

When executing plans from `docs/plans/`, perform a **pre-flight check**:
1. Check for partial completion from previous sessions
2. Verify existing files - don't overwrite completed implementations
3. Check database state - migrations may already be applied

## Security Considerations

- Never hardcode sensitive values - use environment variables
- Implement proper error boundaries in React components
- Use Supabase RLS for data access control
- All external traffic flows through Caddy reverse proxy
- Internal services communicate via Docker network only

### RLS Policy Structure
All user data tables follow this pattern:
```sql
FOR SELECT TO anon, authenticated USING (
    is_public = true OR (auth.uid() IS NOT NULL AND created_by = auth.uid())
);
FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
FOR UPDATE TO authenticated USING (created_by = auth.uid());
FOR DELETE TO authenticated USING (created_by = auth.uid());
```

Tables with RLS: `smart_templates`, `templates`, `workflow_templates`, `template_embeddings`, `workflow_instances`, `workflow_executions`, `documents`.

```sql
-- Verify RLS
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
SELECT tablename, policyname, roles FROM pg_policies WHERE schemaname = 'public';
```

## Repo Cleanup
- Regularly remove old test and markdown files after they are no longer in use.
- One-off tests ending with "test" and "debug" should be removed after use.
