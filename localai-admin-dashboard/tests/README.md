# Test Organization

This directory contains end-to-end tests using Playwright. Unit and integration tests using Vitest are kept alongside their source files.

## Test Structure

### `/tests/e2e/` - End-to-End Tests (Playwright)
- Full user flow tests
- Browser-based testing
- Authentication flows
- Document upload and processing
- Template generation workflows

### `/tests/fixtures/` - Test Data
- Sample documents for testing
- Mock data files

### `/tests/integration/` - Integration Tests (Playwright)
- API integration tests
- Multi-service tests

## Unit/Integration Tests (Vitest)

Located within the source code:

### `/src/__tests__/` - Core Tests
- `auth-compliance.test.ts` - Authentication compliance
- `backend-connectivity.test.ts` - Backend service tests
- `document-processor-backend.test.ts` - Document processor tests
- `google-docs-integration.test.ts` - Google Docs integration

### `/src/__tests__/integration/` - Integration Tests
- Database tests
- Service integration tests
- Route integration tests

### `/src/__tests__/services/` - Service Tests
- Individual service unit tests
- Mock-based testing

### Component Tests
- Located alongside components in `__tests__` folders
- Example: `/src/components/documents/__tests__/`
- Example: `/src/features/documents/components/__tests__/`

## Running Tests

### E2E Tests (Playwright)
```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test
pnpm playwright test tests/e2e/template-generation.spec.ts

# Run with UI
pnpm playwright test --ui

# Run headed (see browser)
pnpm playwright test --headed
```

### Unit/Integration Tests (Vitest)
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run coverage
pnpm test:coverage

# Run specific test file
pnpm test src/components/documents/__tests__/DocumentCard.test.tsx
```

## Test Configuration

- **Playwright Config**: `/playwright.config.ts`
- **Vitest Config**: `/vitest.config.ts`
- **Vitest Setup**: `/vitest.setup.ts`