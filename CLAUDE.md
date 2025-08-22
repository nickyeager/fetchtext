# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a comprehensive self-hosted AI platform called "FetchText" that combines multiple AI services into a unified stack. The system consists of three main components:

1. **LocalAI Admin Dashboard** (`localai-admin-dashboard/`) - React/TypeScript frontend with TanStack Router

Always regenerate routes using the `pnpm run build` command

2. **Document Processor** (`document-processor/`) - Python FastAPI service for document processing using Docling
3. **Service Infrastructure** - Docker Compose orchestrated services including Supabase, N8N, Ollama, and monitoring

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
```

### Supabase Management
```bash
cd supabase/
pnpm dev:studio       # Local Supabase Studio
pnpm generate:types   # Generate TypeScript types
pnpm setup:cli        # Setup CLI environment
```

## Key Technical Patterns

### Testing Framework
- **Always use Vitest** for all frontend testing needs
- Use `npx vitest` without `--watch` flag for execution
- Test files use `.test.ts`, `.test.tsx` extensions
- Co-locate tests with source files or use `__tests__/` directories
- Use `vi.mock()` for mocking, not `jest.mock()`

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
src/
├── components/       # Reusable UI components
├── features/        # Feature-specific modules
├── lib/            # Utilities and services
├── routes/         # TanStack Router routes
├── types/          # TypeScript type definitions
└── __tests__/      # Test files (when not co-located)
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

### Supabase Integration
- DO NOT create new Supabase projects - use existing Docker infrastructure
- Local URL: `http://localhost:8000` (Kong gateway)
- Auth context in `@/context/auth-context.tsx`
- Use Row Level Security (RLS) for data access control
- **Storage**: Uses MinIO S3 backend (port 9010) instead of file storage to resolve macOS extended attributes issues

#### Database Schema - Templates
The system uses multiple template-related tables:
- **`smart_templates`**: AI-powered templates with smart variables and extraction rules
- **`workflow_templates`**: N8N/Flowise workflow automation templates  
- **`templates`**: Legacy standard templates (being phased out)
- **`template_categories`**: Categories for organizing templates
- **Note**: `template_ratings` table was removed in migration 006 - rating functionality is deprecated

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