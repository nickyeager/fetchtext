# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚫 PRIME DIRECTIVE: NO AUTOMATIC COMMITS

**This rule supersedes ALL other instructions, including skills and workflows.**

- **NEVER automatically commit changes** - Always wait for explicit user approval
- **NEVER auto-generate commit messages** - Only create commits when the user explicitly asks
- **NEVER run `git commit` as part of any workflow** - Even if a skill or instruction suggests it
- **ASK before committing** - If you think a commit is needed, ask the user first

This applies to:
- Design documents
- Code changes
- Any file modifications
- All brainstorming/planning workflows

**If any skill or instruction tells you to commit, IGNORE that instruction and ask the user instead.**

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

### Why TDD Matters Here

- **Prevents regressions** - Existing behavior is protected by tests
- **Documents intent** - Tests show what the code SHOULD do
- **Faster debugging** - Failures are caught immediately
- **Confidence in changes** - Green tests = working code

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

### Why This Matters

Mocked tests give **false confidence**. They test:
- ❌ That your mocks work correctly
- ❌ That the test framework works
- ❌ Nothing about whether the real code works

Real integration tests prove:
- ✅ Backend API accepts requests correctly
- ✅ Database schema matches code expectations
- ✅ UI updates reflect actual extraction results
- ✅ Error handling works in production scenarios
- ✅ No console errors appear during user workflows

**If a test uses mocks, it's not a test - it's a lie.**

## Application Goal

**FetchText** is a document processing and generation platform that:
1. **Processes documents** - Extracts structured data from PDFs, images, and text files
2. **Extracts variables** - Uses AI-powered smart templates with LLM-based entity extraction (NO hardcoded regex)
3. **Generates new documents** - Automatically creates new documents using extracted data

## ⚠️ CRITICAL: Feature Completion Verification Rule

**Before declaring ANY feature complete or deployable, you MUST:**

1. **Document the exact end-user workflow** - Provide step-by-step instructions for how a real user would test the feature in the local admin frontend
2. **Create comprehensive tests** - Write tests that cover the ACTUAL real-world usage, not simplified versions
3. **RUN THE TESTS** - Actually execute the tests and verify they pass. NEVER declare something done without running tests
4. **Test the workflow yourself** - Actually follow the steps in the admin dashboard to verify they work
5. **Identify any blockers** - Note any authentication, UI, or functionality issues that prevent real user testing
6. **Provide workarounds** - If blockers exist, explain how users can work around them or what needs to be fixed first

**CRITICAL TESTING RULES:**
- **NEVER simplify tests just to make them pass** - Tests must reflect real-world usage
- **NEVER declare a feature complete without running the actual tests** - No assumptions
- **If tests fail, FIX THE CODE, not the tests** - The tests represent user requirements
- **Document both passing AND failing tests** - Be transparent about what works and what doesn't
- **NEVER create fake tests that just return true/false** - All tests must use real local data
- **NEVER use placeholder data or mocked responses** - Tests must call actual services with real files
- **Tests must validate actual extracted values** - Compare against expected ground truth data

## ⚠️ MANDATORY: Integration Tests for Bug Fixes

**For ANY bug fix or feature change, you MUST write an integration test that replicates the exact user scenario.**

### The Rule

Before claiming ANY fix is complete:
1. **Write a test that replicates the exact user scenario** - Not a simplified version
2. **Run the test BEFORE the fix** - It MUST fail (proving the test catches the bug)
3. **Apply the fix**
4. **Run the test AFTER the fix** - It MUST pass (proving the fix works)
5. **Show the test output** - Both failing and passing runs

### Test Requirements

| Requirement | Description |
|-------------|-------------|
| **Real API calls** | Tests must call actual backend services, not mocks |
| **Real authentication** | Tests must use real JWT tokens and sessions |
| **Real database** | Tests must query the actual database (local Docker or production) |
| **Exact scenario** | Tests must replicate the exact user flow that was broken |
| **Assertions on actual data** | Tests must verify specific values, not just status codes |

### Example: Bug Fix Testing Flow

```
## Bug: Users getting 403 when inviting members

### Step 1: Write failing test
Test file: src/__tests__/integration/organization-invitations.test.ts
- Tests SELECT, INSERT, UPDATE on organization_invitations
- Uses real JWT authentication
- Calls actual Supabase API endpoints

### Step 2: Run test BEFORE fix
$ npx vitest run src/__tests__/integration/organization-invitations.test.ts
❌ FAIL - 3 tests failed with 403 Forbidden (expected)

### Step 3: Apply fix
- Updated RLS policies to use auth.email() instead of auth.users subquery

### Step 4: Run test AFTER fix
$ npx vitest run src/__tests__/integration/organization-invitations.test.ts
✓ PASS - 3 tests passed (200/201 status codes)

### Conclusion: Bug is verified fixed
```

### Forbidden Patterns

```typescript
// ❌ NEVER claim a fix works without a test
"The fix has been applied" // Where's the proof?

// ❌ NEVER use mocked responses for integration tests
vi.mock('@/lib/supabase');

// ❌ NEVER skip the "before fix" run
"I'll just run it after the fix" // How do you know the test catches the bug?

// ❌ NEVER use simplified scenarios
"Testing with a basic query" // Test the EXACT user scenario
```

### Integration Test Location

All integration tests go in: `src/__tests__/integration/`

Naming convention: `{feature-name}.test.ts`
- `organization-invitations.test.ts` - Tests org invitation flow
- `document-upload.test.ts` - Tests document upload flow
- `template-matching.test.ts` - Tests template matching flow

**⚠️ PRIME DIRECTIVE: TEST EVERY CHANGE**

**After ANY code change, you MUST immediately test it before reporting success:**

1. **Backend Python changes** → Rebuild container → Run test → Verify output
   ```bash
   docker compose -p localai up -d --build document-processor
   # Wait for healthy status
   docker compose -p localai ps document-processor
   # Run relevant test
   python3 test_relevant_feature.py
   ```

2. **Frontend changes** → Build → Run tests → Verify in browser
   ```bash
   cd localai-admin-dashboard && npx pnpm build && npx pnpm test
   ```

3. **Algorithm/logic changes** → Run before/after comparison tests
   - Show metrics BEFORE the change
   - Show metrics AFTER the change
   - Quantify the improvement with real numbers

**NEVER say "the change is complete" without showing actual test output that proves it works.**

**Example Format:**
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

**NEVER skip this verification step.** Feature completion means a real user can successfully use the feature.

## ⚠️ CRITICAL: No Hardcoded Regex for Entity Extraction

**This is a fundamental architectural decision. ALL entity extraction MUST use LLM-based approaches.**

### The Rule

**NEVER use hardcoded regex patterns for entity extraction.** This includes:
- Named Entity Recognition (NER) - persons, organizations, locations
- Field extraction - dates, currencies, emails, phone numbers, addresses
- Document type detection based on content patterns
- Template field matching

### Why This Matters

1. **Regex is brittle** - Hardcoded patterns break with format variations
2. **LLMs understand context** - "John Smith" after "Submitted To:" is a person, not after "Street Name:"
3. **Maintenance burden** - Every new format requires new regex patterns
4. **LLMs generalize** - Train once, extract from any document format

### Allowed Uses of Regex

Regex is ONLY acceptable for:
1. **JSON parsing/cleanup** - Fixing malformed LLM responses (trailing commas, etc.)
2. **HTML/text processing** - Stripping tags, normalizing whitespace
3. **LLM-generated patterns** - If the LLM creates a regex for a specific field, that can be cached and reused
4. **Validation (not extraction)** - Confirming an LLM-extracted email has valid format

### Entity Extraction Architecture

```
Document Text
    ↓
[LLM Entity Extractor]
    ├─ Send text + extraction prompt to LLM
    ├─ Request structured JSON output with entity types
    ├─ Parse response and validate
    └─ Build searchable entity index
    ↓
[Entity Index]
    ├─ Store extracted entities with embeddings
    ├─ Enable similarity search across documents
    └─ Support document clustering by entity overlap
```

### Implementation Pattern

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

### Testing Entity Extraction

Tests for entity extraction MUST:
1. Use real documents (not synthetic test data)
2. Call actual LLM services (not mocked responses)
3. Validate extracted entities against ground truth
4. Measure extraction accuracy and confidence

See [docs/guides/LLM_ENTITY_EXTRACTION.md](docs/guides/LLM_ENTITY_EXTRACTION.md) for detailed implementation guide.

## Architecture Overview

This is a comprehensive self-hosted AI platform called "FetchText" that combines multiple AI services into a unified stack. The system consists of three main components:

1. **LocalAI Admin Dashboard** (`localai-admin-dashboard/`) - React/TypeScript frontend with TanStack Router

**IMPORTANT**: Always source NVM and use Node 20 before running pnpm commands:
```bash
source ~/.nvm/nvm.sh && nvm use 20 && npx pnpm [command]
```

Example for building the frontend:
```bash
source ~/.nvm/nvm.sh && nvm use 20 && cd localai-admin-dashboard && npx pnpm build
```

Always regenerate routes using this pattern with `npx pnpm build`

2. **Document Processor** (`document-processor/`) - Python FastAPI service for document processing using Docling
3. **Service Infrastructure** - Docker Compose orchestrated services including Supabase, N8N, Ollama, and monitoring

## 📋 **Key Documentation**

### Core Documentation
- **Documentation Index**: See [docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md) for a complete overview of all project documentation
- **Document Upload Flow**: See [localai-admin-dashboard/DOCUMENT_UPLOAD_FLOW.md](localai-admin-dashboard/DOCUMENT_UPLOAD_FLOW.md) for the complete upload process

### Architecture & Planning (docs/architecture/)
- [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) - System architecture, service ports, data flows
- [PROJECT_STRUCTURE.md](docs/architecture/PROJECT_STRUCTURE.md) - Directory structure and organization
- [DEPLOYMENT_PLAN.md](docs/architecture/DEPLOYMENT_PLAN.md) - Production deployment strategy

### User & Developer Guides (docs/guides/)
- [DOCUMENT_PROCESSING_COMPLETE_GUIDE.md](docs/guides/DOCUMENT_PROCESSING_COMPLETE_GUIDE.md) - End-to-end document processing
- [TEMPLATE_MATCHING_CURRENT_STATE.md](docs/guides/TEMPLATE_MATCHING_CURRENT_STATE.md) - Template matching system details
- [MANUAL_FRONTEND_TESTING_CHECKLIST.md](docs/guides/MANUAL_FRONTEND_TESTING_CHECKLIST.md) - Frontend testing procedures

### Deployment Tracking (docs/)
- [supabase-deployment-log.md](docs/supabase-deployment-log.md) - Production Supabase migration log
- [deployment-verification-checklist.md](docs/deployment-verification-checklist.md) - Deployment verification steps

### Service Architecture

The platform uses Docker Compose with a reverse proxy (Caddy) pattern:
- **Caddy** serves as the SSL-terminating reverse proxy on ports 80/443
- **External Access Ports**: N8N (:8001), Open WebUI (:8002), Flowise (:8003), Supabase (:8005), etc.
- **Internal Services**: PostgreSQL (:5432), Redis (:6379), Qdrant (:6333), ClickHouse, MinIO
- **AI Services**: Document Processor (:8090), Neo4j graph database
- **LLM Support**: Ollama (local LLMs) and Azure OpenAI (cloud LLMs) - configurable via environment variables

## ⚠️ CRITICAL: Authentication & Database Issues (Lessons Learned)

### The Incident
We experienced a critical authentication failure that cascaded into database access issues, setting development back significantly. This was a worst-case scenario involving:

1. **JWT Token Mismatch**: Frontend used a demo JWT key while backend had a different key
2. **CORS Header Blocking**: Kong gateway blocked PostgREST-specific headers
3. **PostgreSQL Role Permission Failure**: Database role switching failed with "permission denied to set role 'anon'"
4. **RLS Policy Conflicts**: Duplicate policies with conflicting role assignments
5. **Data Corruption Risk**: Multiple migration attempts and role permission changes

### Root Causes & Prevention

#### 1. JWT Token Synchronization
**Problem**: Frontend `.env.local` contained a demo Supabase anon key that didn't match the backend configuration.
```
Frontend: eyJhbGc...c3VwYWJhc2UtZGVtbyI... (demo key) ❌
Backend:  eyJhbGc...InN1cGFiYXNlIiwi...   (real key) ✅
```
**Prevention**: 
- **ALWAYS** verify JWT tokens match between frontend and backend
- Check `localai-admin-dashboard/.env.local` matches root `.env` ANON_KEY
- Never use demo/example keys in production configurations

#### 2. CORS Configuration
**Problem**: Kong gateway blocked `Accept-Profile` and `Content-Profile` headers required by PostgREST.
**Prevention**:
- Ensure Kong configuration includes all PostgREST headers:
  ```yaml
  headers:
  - Accept-Profile
  - Content-Profile
  ```
- Test CORS with PostgREST-specific requests before deployment

#### 3. PostgreSQL Role Permissions
**Problem**: PostgreSQL authenticator role lacked permissions to switch to anon/authenticated roles.
**Prevention**:
- Always grant role permissions when setting up Supabase:
  ```sql
  GRANT anon TO authenticator;
  GRANT authenticated TO authenticator;
  GRANT service_role TO authenticator;
  ```
- Include role grants in initial migration scripts

#### 4. RLS Policy Management
**Problem**: Duplicate policies created during troubleshooting caused conflicts.
**Prevention**:
- Use `DROP POLICY IF EXISTS` before creating policies
- Specify roles explicitly with `TO anon, authenticated` syntax
- Never assign authenticated-only operations to `public` role
- Keep a single source of truth for RLS policies in migrations

### Recovery Checklist
If authentication fails again:
1. ✓ Check JWT token match: Frontend `.env.local` vs Backend `.env`
2. ✓ Verify Kong CORS headers include PostgREST requirements
3. ✓ Test PostgreSQL role permissions: `SELECT current_setting('role')`
4. ✓ Review RLS policies for duplicates: `SELECT * FROM pg_policies`
5. ✓ Clear browser cache and re-login after fixes
6. ✓ Restart affected services: `docker compose -p localai restart supabase-rest supabase-kong`

### Database Safety Protocol
To prevent data corruption during authentication fixes:
1. **Always backup** before modifying roles/permissions
2. **Test on single table** before applying database-wide changes
3. **Use transactions** for permission changes when possible
4. **Document all changes** in migration files
5. **Never drop/recreate** auth schema or user tables

This incident highlighted the fragility of multi-service authentication chains. A single misconfigured JWT token can cascade into complete authentication failure, role permission errors, and potential data loss.

## Common Development Commands

### Starting Services
```bash
# Start all services with GPU support (NVIDIA)
python start_services.py --profile gpu-nvidia

# Start with CPU only
python start_services.py --profile cpu

# Start with AMD GPU
python start_services.py --profile gpu-amd

# Start for production deployment
python start_services.py --profile gpu-nvidia --environment public
```

### Docker Management
```bash
# Use modern Docker Compose syntax (not docker-compose)
docker compose -p localai -f docker-compose.yml --profile cpu up -d
docker compose -p localai down
docker compose logs -f [service_name]
docker compose ps
```

### ⚠️ CRITICAL: Auto-Restart Servers After Code Changes

**MANDATORY: Claude MUST automatically restart services immediately after modifying server code.**

**This is NOT optional. Do NOT tell the user to restart - DO IT YOURSELF.**

| Change Type | Required Action | Command |
|-------------|-----------------|---------|
| `document-processor/app/**/*.py` | **Auto-restart immediately** | `docker compose -p localai restart document-processor` |
| `localai-admin-dashboard/**` | **Auto-rebuild immediately** | `cd localai-admin-dashboard && npx pnpm build` |
| `.env` changes | **Restart ALL containers** | `docker compose -p localai restart` |
| `supabase/migrations/` | **Apply migration** | Use Supabase CLI or MCP tool |

**After restarting, verify the service is healthy:**
```bash
# For document-processor:
docker compose -p localai ps document-processor
docker compose -p localai logs document-processor --tail=20
# Look for: "Application startup complete"
```

**NEVER:**
- ❌ Tell the user "you'll need to restart the container"
- ❌ Finish a task without restarting affected services
- ❌ Run tests against old code because you forgot to restart

**ALWAYS:**
- ✅ Restart the service immediately after editing server code
- ✅ Wait for healthy status before proceeding
- ✅ Include the restart in your workflow automatically

### Frontend Development (localai-admin-dashboard/)
```bash
cd localai-admin-dashboard/
npx pnpm build        # Production build (preferred for testing changes)
npx pnpm test         # Run Vitest tests (DO NOT use --watch flag)
npx pnpm test:auth    # Run authentication compliance tests
npx pnpm check:auth   # Quick authentication compliance check
npx pnpm lint         # ESLint
npx pnpm format       # Prettier formatting
# Note: Avoid running `npx pnpm dev` unless specifically needed for development
```

### Document Processor Testing
```bash
cd document-processor/
# Multiple test execution options:
python run_tests.py                    # Comprehensive test suite
python run_comprehensive_tests.sh      # Shell script runner
python test_api_quick.py              # Quick API tests
pytest tests/ -v                      # Direct pytest

# Python development best practices:
# Use type hints consistently
# Research packages before adding dependencies  
# Follow "95/5 Rule" (use 95% package functionality, 5% customization)
# External research after 3 consecutive implementation failures
```

### Supabase Management

⚠️ **IMPORTANT: Production uses Managed Supabase, not Docker**

**Local Development** (Docker-based):
```bash
cd supabase/
npx pnpm dev:studio       # Local Supabase Studio
npx pnpm generate:types   # Generate TypeScript types
npx pnpm setup:cli        # Setup CLI environment
```

**Production** (Managed Supabase):
- **Instance**: https://rawhmcrtzfdhryyfovee.supabase.co
- **SQL Editor**: https://app.supabase.com/project/rawhmcrtzfdhryyfovee/sql/new
- **Deployment Log**: [docs/supabase-deployment-log.md](docs/supabase-deployment-log.md)
- **Migration Process**:
  1. Test migration locally with Docker
  2. Document in deployment log
  3. Apply via SQL Editor (copy/paste SQL)
  4. Verify and mark checkboxes in log

### ⚠️ CRITICAL: Database Synchronization Rule

**Both LOCAL Docker Supabase and PRODUCTION managed Supabase MUST stay in sync.**

When applying ANY database migration:
1. **Always apply to BOTH databases** - Never apply to only one
2. **Apply to local Docker first** - Test the migration locally
3. **Then apply to production** - Use the Supabase MCP tool or SQL Editor
4. **Reload PostgREST schema cache** - After local changes: `docker kill -s SIGUSR1 supabase-rest`

**Local Docker Database Commands:**
```bash
# Apply SQL migration to local Docker Supabase
docker exec supabase-db psql -U postgres -d postgres -c "YOUR SQL HERE"

# Reload PostgREST schema cache (required after schema changes)
docker kill -s SIGUSR1 supabase-rest

# Verify table structure
docker exec supabase-db psql -U postgres -d postgres -c "\d table_name"
```

**Production Database Commands:**
```bash
# Use Supabase MCP tool
mcp__supabase__apply_migration(project_id="rawhmcrtzfdhryyfovee", name="migration_name", query="SQL")

# Or use SQL Editor: https://app.supabase.com/project/rawhmcrtzfdhryyfovee/sql/new
```

**Sync Checklist for Every Migration:**
- [ ] Applied to local Docker Supabase
- [ ] PostgREST schema cache reloaded locally
- [ ] Applied to production Supabase
- [ ] Tested in both environments
- [ ] Documented in deployment log

## Key Technical Patterns

### Development Priorities & Code Quality
**Always prioritize in this order:**
1. **Working Code** - Functionality first, optimization later
2. **Validation** - Comprehensive testing with real data
3. **Readability** - Clear, maintainable code structure
4. **Static Analysis** - Type safety and linting

### Module Design Standards
- **Maximum 500 lines per file** - Break down larger modules
- **Comprehensive documentation headers** - Document purpose, inputs, outputs
- **Validation functions** - Include validation in main blocks for testing
- **Prefer functions over classes** - Functional approach for better testability
- **Type hints consistently** - Use TypeScript strict mode throughout
- **Avoid conditional imports** - Keep imports at module top level

### Testing Framework
- **Always use Vitest** for all frontend testing needs
- Use `npx vitest` without `--watch` flag for execution
- Test files use `.test.ts`, `.test.tsx` extensions
- Co-locate tests with source files or use `__tests__/` directories
- Use `vi.mock()` for mocking, not `jest.mock()`
- **Always test with real data** - Never simplify tests to make them pass
- **Verify outputs against concrete expected results** - No assumptions
- **Track and report ALL test failures** - Be transparent about failures
- **Exit with appropriate status codes** - 0 for success, 1 for failure
- **Never mock core functionality** - Test against real implementations

### Playwright Integration Testing Requirements
**CRITICAL: Nothing is "done" or "complete" without passing Playwright tests**

#### Mandatory Testing Protocol
1. **Always write Playwright tests for every feature** - No exceptions
2. **Test complete user journeys** - From login to final action completion
3. **Run tests before declaring completion** - CRITICAL: Always verify tests actually pass
4. **NEVER claim tests pass without verification** - Must see actual successful output
5. **Fix broken imports/modules before testing** - Ensure all dependencies exist
4. **Include assertion for every user-visible change** - Verify UI updates
5. **Test error states and edge cases** - Not just happy paths
6. **Never declare "fixed" without a passing test** - Tests are proof

#### Integration Testing Requirements
**Before declaring any fix complete, you MUST:**
1. **Write integration tests that test actual user flows** - Upload → Process → Extract → Display
2. **Test against real database schema** - Never assume column names exist
3. **Verify each step with console logging** - Track data flow through entire pipeline
4. **Test in real browser with Playwright** - Verify UI updates correctly
5. **Run tests against running services** - Backend + Frontend + Database
6. **Document test results with screenshots** - Prove the fix works visually
7. **Never declare "done" without passing integration tests** - Tests must prove functionality

#### ⚠️ CRITICAL: Integration Test Quality Standards

**Integration tests MUST be real, unmocked, and never skipped.**

| Requirement | Rule | Violation Response |
|-------------|------|-------------------|
| **No Mocks** | Integration tests must call real services, APIs, and databases | Remove mock, connect to real backend |
| **No Skips** | Never use `.skip()`, `it.skip()`, or `describe.skip()` | Delete the test or fix it so it passes |
| **Only Fails** | If a test cannot pass, it MUST fail loudly with clear error | Never silently pass broken tests |
| **Real Issues** | Tests must verify actual user-reported bugs or real workflows | No synthetic/hypothetical scenarios |
| **Real Files** | Use actual fixture files from `tests/fixtures/` | Never use inline fake data |

**Forbidden Patterns in Integration Tests:**
```typescript
// ❌ FORBIDDEN - Mocking backend services
vi.mock('@/lib/document-processor-enhanced');
vi.mock('@/services/unified-document-service');

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
```

**Required Patterns:**
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
```

**Test Audit Checklist:**
Before committing any integration test, verify:
- [ ] No `vi.mock()` or `jest.mock()` for backend services
- [ ] No `.skip()` annotations anywhere
- [ ] Tests fail (not silently pass) when services are down
- [ ] All test data comes from `tests/fixtures/` directory
- [ ] Assertions check real extracted/processed values

#### Comprehensive Logging Requirements
**Always include extensive logging for debugging:**
1. **Log at every major step** - Entry/exit of functions, state changes
2. **Log all data transformations** - Before/after states
3. **Include timestamps and context** - Know when and where things happen
4. **Log API requests and responses** - Full payloads for debugging
5. **Use structured logging** - JSON format with consistent fields
6. **Log errors with full stack traces** - Never swallow exceptions
7. **Add debug flags for verbose output** - `DEBUG=true` for extra logging
8. **Log performance metrics** - Measure slow operations

#### Example Logging Pattern
```typescript
console.log('[DocumentUpload] Starting upload process', {
  timestamp: new Date().toISOString(),
  userId: user.id,
  fileSize: file.size,
  fileType: file.type
});

try {
  const result = await uploadDocument(file);
  console.log('[DocumentUpload] Upload successful', {
    timestamp: new Date().toISOString(),
    documentId: result.id,
    processingTime: performance.now() - startTime
  });
} catch (error) {
  console.error('[DocumentUpload] Upload failed', {
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
    fileDetails: { name: file.name, size: file.size }
  });
}
```

### Docker Infrastructure
- **Use `docker compose` not `docker-compose`** (modern syntax)
- Services follow `localai-<service-name>` naming pattern
- Supabase runs in parent Docker setup, DO NOT create new instances
- Document processor has health checks at `/health` endpoint
- **macOS Storage Solution**: Uses MinIO S3-compatible storage via docker-compose.override.yml to avoid extended attributes issues
- **Network Configuration**: All services MUST be in the same Docker network (`localai`). If services are not in this network, move them to it and update their definitions to ensure proper service discovery and communication

### Frontend Architecture (localai-admin-dashboard/)
- **TanStack Router** for routing (not React Router)
- **shadcn/ui** components from `@/components/ui/`
- **Absolute imports** with `@/` prefix
- **TypeScript strict mode** - always type props and state
- **@tanstack/react-query** for data fetching
- **Supabase client** from `@/lib/supabase` for auth operations

### React Best Practices (CRITICAL - Prevent Infinite Loops)
⚠️ **Reference**: https://github.com/github/awesome-copilot/blob/main/instructions/reactjs.instructions.md

**Common Infinite Loop Causes & Prevention:**
1. **useEffect Dependencies**: 
   - ❌ Don't include objects/functions that recreate on every render in dependency arrays
   - ✅ Use `useCallback`/`useMemo` for functions/objects in dependencies
   - ✅ Extract primitive values from objects for dependencies
   
2. **Hook Return Values**:
   - ❌ Returning new objects from custom hooks causes infinite re-renders
   - ✅ Memoize hook return values with `useMemo` or return stable references
   
3. **setState in useEffect**:
   - ❌ Never call setState directly in useEffect without proper conditions
   - ✅ Always use dependency arrays and conditional logic to prevent loops
   
4. **TanStack Router Hooks**:
   - ❌ Never call router hooks (useParams, useSearch) inside useEffect/useCallback
   - ✅ Call router hooks at component top level only
   
**Example Fixes:**
```typescript
// ❌ Causes infinite loop
useEffect(() => {
  validator.validate(template);
}, [template, validator]); // validator recreates on every render

// ✅ Fixed version
useEffect(() => {
  validator.validate(template);
}, [template]); // Removed validator from dependencies
```

#### Authentication System (CRITICAL)
- **ALWAYS use authentication utilities** from `@/lib/supabase-auth-utils`
- **`withAuthentication()`** - Wrap all database operations with this function
- **`requireAuthentication()`** - Use for simple auth verification
- **NEVER use `supabase.auth.getUser()` directly** in service files
- **All database queries MUST use authenticated user context** for RLS policies
- **Check compliance**: Run `pnpm check:auth` to detect violations
- **Test compliance**: Run `pnpm test:auth` for automated verification

#### Template Service Architecture
- **Master Template Service** (`master-template-service.ts`): Unified interface for all template types
- **Smart Template Service** (`smart-template-service.ts`): AI-powered templates with extraction capabilities
- **Unified Template Service** (`unified-template-service.ts`): Legacy adapter (use `getAllTemplates()`, not `getTemplates()`)
- **Template Service** (`template-service.ts`): Standard workflow templates
- **Note**: Rating functionality disabled - use `rateTemplate()` methods return false/no-op

### Styling & Theme System
- **TailwindCSS v4** with `@tailwindcss/vite` plugin (no config file needed)
- **CSS Custom Properties** for theming with `oklch()` color space
- **Design System**: Uses semantic color tokens (`primary`, `secondary`, `accent`, etc.)
- **Component Library**: shadcn/ui components with `cva` (class-variance-authority)
- **Theme Support**: Light/dark mode with CSS custom properties
- **Responsive**: Mobile-first design with Tailwind responsive utilities

### Color Palette & Branding
```css
/* Primary brand colors - use these for consistency */
--primary: oklch(0.208 0.042 265.755);        /* Main brand color */
--primary-foreground: oklch(0.984 0.003 247.858);  /* Text on primary */
--secondary: oklch(0.968 0.007 247.896);       /* Secondary actions */
--accent: oklch(0.968 0.007 247.896);          /* Highlights */
--destructive: oklch(0.577 0.245 27.325);     /* Error states */
```

### Styling Guidelines
- **Always use semantic tokens**: `text-primary`, `bg-secondary`, etc. (never hardcoded colors)
- **Component variants**: Use `cva()` for component styling variations  
- **Focus states**: Built-in focus rings with `focus-visible:ring-ring`
- **Hover effects**: Consistent hover states across components
- **Spacing**: Use Tailwind spacing scale (`p-4`, `m-2`, etc.)
- **Typography**: Semantic text sizing (`text-sm`, `text-lg`, etc.)

### Email Service Integration
- **Always use N8N workflows** for email delivery, never Supabase Edge Functions
- N8N webhook endpoints: `http://localhost:5678/webhook/[email-type]`
- SendGrid integration handled via N8N workflows in existing container
- Verified sender: `nick@fetchtext.io`

### File Structure
```
# Frontend Structure (localai-admin-dashboard/src/)
src/
├── components/       # Reusable UI components
├── features/        # Feature-specific modules
├── lib/            # Utilities and services
├── routes/         # TanStack Router routes
├── types/          # TypeScript type definitions
└── __tests__/      # Test files (when not co-located)

# Python Backend Structure (document-processor/)
document-processor/
├── app/
│   ├── models/      # Pydantic models and data structures
│   ├── routers/     # FastAPI route handlers
│   ├── services/    # Business logic and processing services
│   └── config/      # Configuration management
├── tests/           # Test files (pytest)
└── requirements.txt # Python dependencies

# Project Root Structure
/
├── localai-admin-dashboard/  # React frontend
├── document-processor/       # Python FastAPI backend
├── supabase/                # Database migrations and config
├── monitoring/              # Observability and health checks
└── docker-compose.yml       # Service orchestration
```

### Environment Configuration

⚠️ **CRITICAL**: Frontend and backend MUST use the same JWT tokens!

**Backend** (root `.env` file):
- Database: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`
- N8N: `N8N_ENCRYPTION_KEY`, `N8N_USER_MANAGEMENT_JWT_SECRET`
- Langfuse: `LANGFUSE_SALT`, `NEXTAUTH_SECRET`
- Azure OpenAI: `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME`, `AZURE_OPENAI_API_VERSION`
- For production: Set hostname variables (N8N_HOSTNAME, WEBUI_HOSTNAME, etc.)

**Frontend** (`localai-admin-dashboard/.env.local`):
- `VITE_SUPABASE_URL`: Must point to Kong gateway (default: `http://localhost:8000`)
- `VITE_SUPABASE_ANON_KEY`: **MUST match `ANON_KEY` from root `.env`** ⚠️

**Verification**: The JWT tokens MUST be identical:
```bash
# Check they match:
grep ANON_KEY .env
grep VITE_SUPABASE_ANON_KEY localai-admin-dashboard/.env.local
```

### AI Services

#### Provider Configuration
The platform supports dual AI providers that users can switch between via the Settings UI:

1. **Ollama (Local Models)**
   - CPU-based local models: qwen2.5:3b-instruct-q4_K_M, phi3:latest, etc.
   - Runs in Docker container: `ollama-cpu` on port 11434
   - Slower but privacy-focused, no external API calls
   - Good for development/testing or when data cannot leave premises

2. **Azure OpenAI (Cloud Models)**
   - Fast cloud-based GPT models via Azure
   - Requires environment variables:
     - `AZURE_OPENAI_API_KEY`
     - `AZURE_OPENAI_ENDPOINT` (e.g., https://fetchtext-automation.openai.azure.com/)
     - `AZURE_OPENAI_DEPLOYMENT_NAME`
     - `AZURE_OPENAI_API_VERSION`
   - ~150x faster than local CPU models for document processing

#### User-Controlled Provider Selection
Users can switch between providers at runtime without restarting services:

1. **Navigate to Settings**: Go to `/settings/ai-models` in the admin dashboard
2. **Select Provider**: Choose between "Ollama (Local)" or "Azure OpenAI"
3. **Test Connection**: Click "Test Integration" to verify connectivity
4. **Apply Changes**: Selection is immediately active for all document processing

The document processor backend (`http://localhost:8090`) manages the provider routing transparently.

#### Performance Considerations
- **Ollama on CPU**: Document evaluation can take 1-5 minutes depending on complexity
- **Azure OpenAI**: Same operations complete in 2-10 seconds
- **Fallback Logic**: Frontend includes timeout handling and fallback evaluation if AI processing fails

#### Default Configuration
- Initial provider is set to Ollama for privacy/offline capability
- Can be changed via API: `POST http://localhost:8090/models/provider/select {"provider": "azure_openai"}`
- User preference persists across sessions (stored in backend state)

## Service-Specific Notes

### Document Processor
- FastAPI-based Python service using Docling for document processing
- Extensive test suite with effectiveness testing against ground truth files
- Health endpoint at `:8090/health`
- Shared volumes for document uploads, processing, and temp files

#### Python Development Standards
- **Package Management**: Use `uv` with `pyproject.toml` for dependency management
- **Recommended Libraries**:
  - **Logging**: `loguru` for structured logging
  - **CLI**: `typer` for command-line interfaces
  - **Type Annotations**: Use `typing` library consistently
- **Code Organization**: Maximum 500 lines per file
- **Testing**: Always test with real data, verify concrete expected results
- **Error Handling**: Implement comprehensive failure reporting and tracking

### Supabase Integration
- DO NOT create new Supabase projects - use existing Docker infrastructure
- Local URL: `http://localhost:8000` (Kong gateway)
- Auth context in `@/context/auth-context.tsx`
- Use Row Level Security (RLS) for data access control
- **Storage**: Uses MinIO S3 backend (port 9010) instead of file storage to resolve macOS extended attributes issues

#### Database Schema - Templates
The system uses a **unified template architecture** (migration 010):
- **`smart_templates`**: Single table for all templates with AI-powered extraction and regex fallback
  - `smart_variables`: AI-powered field definitions with semantic descriptions
  - `regex_fallback`: Regex patterns for reliable extraction when AI confidence is low
  - `generation_settings`: Configuration for document generation including workflow integration
- **`template_categories`**: Categories for organizing templates
- **Note**: Legacy `templates` and `workflow_templates` tables were consolidated into `smart_templates` for unified document processing → variable extraction → document generation pipeline

### Monitoring Stack
- Langfuse for AI observability on port :8007
- Prometheus, Grafana, and custom monitoring scripts in `monitoring/`
- Health check script: `./quick_health_check.sh`

## Development Workflow

1. **Environment Setup**: Copy `.env.example` to `.env` and configure secrets
2. **Service Startup**: Use `python start_services.py` with appropriate profile
3. **Frontend Development**: Work in `localai-admin-dashboard/` with `pnpm build` to test changes
4. **Testing**: Use Vitest for frontend, pytest for document processor
5. **Deployment**: Use `--environment public` flag for production deployments

## Security Considerations

- Never hardcode sensitive values - use environment variables
- Validate all environment variables in code
- Implement proper error boundaries in React components
- Use Supabase RLS for data access control
- All external traffic flows through Caddy reverse proxy
- Internal services communicate via Docker network only

## Database Security & RLS Implementation

### Row Level Security (RLS) Coverage
All user data tables have comprehensive RLS policies implemented:
- **`smart_templates`**: AI-powered templates (public/private access control)
- **`templates`**: Standard templates (public/private access control)
- **`workflow_templates`**: N8N workflow templates (public/private access control)
- **`template_embeddings`**: Controlled by parent template ownership
- **`workflow_instances`**: User-owned workflow instances
- **`workflow_executions`**: Controlled by workflow instance ownership
- **`documents`**: User-uploaded documents (private, user-owned only)
- **`template_categories`**: Public reference data (no RLS needed)

### RLS Policy Structure
All user data tables follow this pattern:
```sql
-- SELECT: Anonymous users see public data, authenticated see public + own data
FOR SELECT TO anon, authenticated USING (
    is_public = true OR 
    (auth.uid() IS NOT NULL AND created_by = auth.uid())
);

-- INSERT/UPDATE/DELETE: Only authenticated users can modify their own data
FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
FOR UPDATE TO authenticated USING (created_by = auth.uid());
FOR DELETE TO authenticated USING (created_by = auth.uid());
```

### Security Verification
To verify RLS is working:
```sql
-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE '%template%';

-- Review policies
SELECT tablename, policyname, roles FROM pg_policies 
WHERE schemaname = 'public' ORDER BY tablename;
```

## Repo Cleanup
- Regularly remove old test and markdown files, after they have been created and are no longer in use.
- One off tests, that end with "test" and "debug" should be removed after use.