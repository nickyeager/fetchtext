# GitHub Copilot Instructions

## Project Overview
This is a FetchText admin dashboard with Docker-based services including Supabase, N8N, Flowise, and monitoring stack.

## Testing Framework
- **Always use Vitest** for all testing needs in this project
- When generating test code, use Vitest syntax and utilities
- For test configuration, prefer `vitest.config.ts` over other test runners
- Use Vitest's built-in mocking, assertions, and testing utilities
- When creating new test files, use Vitest's `describe`, `it`, `expect` syntax
- For React component testing, use `@testing-library/react` with Vitest
- Use Vitest's `vi.mock()` for mocking instead of `jest.mock()`

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
- Leverage Vitest's watch mode for development with `--watch`

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

## Authentication & Supabase
- Use Supabase client from `@/lib/supabase` for all auth operations
- Authentication context is in `@/context/auth-context.tsx`
- Always check user session before protected operations
- Use environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

## React & TypeScript Patterns
- Use TanStack Router for routing (not React Router)
- Import components using absolute paths with `@/` prefix
- Use TypeScript strictly - always type props and state
- Prefer function components over class components
- Use React hooks for state management

## UI Component Library
- Use shadcn/ui components from `@/components/ui/`
- Follow the existing component patterns
- Use Tailwind CSS for styling
- Maintain consistent spacing and typography

## File Organization
- Components go in `src/components/`
- Features go in `src/features/`
- Utilities go in `src/lib/`
- Types go in `src/types/`
- Tests should be co-located with source files

## Code Generation Preferences
When suggesting code, always:
- Import test utilities from `vitest` instead of `jest`
- Use `vi` namespace for mocking utilities
- Include proper TypeScript types for test functions
- Follow the project's existing test patterns and structure
- Use the project's established folder structure
- Include proper error handling and loading states
- Use async/await instead of .then() for promises

## Security & Environment
- Never hardcode sensitive values - use environment variables
- Always validate environment variables in code
- Use proper CORS settings for API calls
- Implement proper error boundaries in React components 