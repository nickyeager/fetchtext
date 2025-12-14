# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Application Goal

**FetchText** is a document processing and generation platform that:
1. **Processes documents** - Extracts structured data from PDFs, images, and text files
2. **Extracts variables** - Uses AI-powered smart templates with regex fallback for reliable data extraction  
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

## Architecture Overview

This is a comprehensive self-hosted AI platform called "FetchText" that combines multiple AI services into a unified stack. The system consists of three main components:

1. **LocalAI Admin Dashboard** (`localai-admin-dashboard/`) - React/TypeScript frontend with TanStack Router

Always regenerate routes using the `pnpm run build` command

2. **Document Processor** (`document-processor/`) - Python FastAPI service for document processing using Docling
3. **Service Infrastructure** - Docker Compose orchestrated services including Supabase, N8N, Ollama, and monitoring

## 📋 **Key Process Documentation**

- **Template Analysis & Selection**: See `TEMPLATE_ANALYSIS_INSTRUCTIONS.md` for complete details on how the system intelligently matches documents with existing templates using Azure OpenAI
- **Document Upload Flow**: See `localai-admin-dashboard/DOCUMENT_UPLOAD_FLOW.md` for the complete upload process from gallery to document view

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

### ⚠️ CRITICAL: Docker Restart After Code Changes

**IMPORTANT: Backend Python code changes require Docker container restart!**

When you modify any Python files in `document-processor/`, you MUST restart the container:

```bash
# Restart the document processor container
docker compose -p localai restart document-processor

# Verify it's running and healthy
docker compose -p localai ps document-processor

# Check logs for startup confirmation
docker compose -p localai logs -f document-processor
# Wait for: "Application startup complete"
```

**Automatic Restart Rule:**
- ANY changes to `document-processor/app/**/*.py` → Restart container
- Frontend changes (`localai-admin-dashboard/`) → No restart needed (just rebuild with `pnpm build`)
- Environment variable changes (`.env`) → Restart ALL containers
- Database migrations (`supabase/migrations/`) → Apply with Supabase CLI

**Always restart BEFORE running tests after code changes!**

### Frontend Development (localai-admin-dashboard/)
```bash
cd localai-admin-dashboard/
pnpm build        # Production build (preferred for testing changes)
pnpm test         # Run Vitest tests (DO NOT use --watch flag)
pnpm test:auth    # Run authentication compliance tests
pnpm check:auth   # Quick authentication compliance check
pnpm lint         # ESLint
pnpm format       # Prettier formatting
# Note: Avoid running `pnpm dev` unless specifically needed for development
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
```bash
cd supabase/
pnpm dev:studio       # Local Supabase Studio
pnpm generate:types   # Generate TypeScript types
pnpm setup:cli        # Setup CLI environment
```

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
- Verified sender: `yeag123@gmail.com`

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