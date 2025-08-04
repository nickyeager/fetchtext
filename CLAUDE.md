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
- **AI Services**: Ollama (local LLMs), Document Processor (:8090), Neo4j graph database

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
pnpm dev          # Development server
pnpm build        # Production build
pnpm test         # Run Vitest tests (DO NOT use --watch flag)
pnpm lint         # ESLint
pnpm format       # Prettier formatting
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

### Frontend Architecture (localai-admin-dashboard/)
- **TanStack Router** for routing (not React Router)
- **shadcn/ui** components from `@/components/ui/`
- **Absolute imports** with `@/` prefix
- **TypeScript strict mode** - always type props and state
- **@tanstack/react-query** for data fetching
- **Supabase client** from `@/lib/supabase` for auth operations

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
All services use environment variables from root `.env` file:
- Database: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`
- N8N: `N8N_ENCRYPTION_KEY`, `N8N_USER_MANAGEMENT_JWT_SECRET`
- Langfuse: `LANGFUSE_SALT`, `NEXTAUTH_SECRET`
- For production: Set hostname variables (N8N_HOSTNAME, WEBUI_HOSTNAME, etc.)

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

### Monitoring Stack
- Langfuse for AI observability on port :8007
- Prometheus, Grafana, and custom monitoring scripts in `monitoring/`
- Health check script: `./quick_health_check.sh`

## Development Workflow

1. **Environment Setup**: Copy `.env.example` to `.env` and configure secrets
2. **Service Startup**: Use `python start_services.py` with appropriate profile
3. **Frontend Development**: Work in `localai-admin-dashboard/` with `pnpm dev`
4. **Testing**: Use Vitest for frontend, pytest for document processor
5. **Deployment**: Use `--environment public` flag for production deployments

## Security Considerations

- Never hardcode sensitive values - use environment variables
- Validate all environment variables in code
- Implement proper error boundaries in React components
- Use Supabase RLS for data access control
- All external traffic flows through Caddy reverse proxy
- Internal services communicate via Docker network only