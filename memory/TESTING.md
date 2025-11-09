# Testing Guidelines

This document outlines the testing strategy and rules for the Local AI Admin Dashboard.

## ⚠️ Critical Testing Rules

### No Watch Mode Policy
- **Always run tests without the watcher** - Use `pnpm test` (runs once) instead of watch mode
- **Never use watch mode in CI or automated testing**
- **Use explicit run commands** for all test execution
- **Watch mode is only for development debugging** - use `pnpm test:ui` instead

### Test Execution Commands

```bash
# ✅ CORRECT - Run tests once (recommended)
pnpm test

# ✅ CORRECT - Run specific test file
npx vitest path/to/test.test.ts --run

# ✅ CORRECT - Run with verbose output
npx vitest --run --reporter=verbose

# ✅ CORRECT - Run with coverage
pnpm test:coverage

# ✅ CORRECT - UI mode for debugging (dev only)
pnpm test:ui

# ❌ WRONG - Don't use watch mode in CI
npx vitest --watch

# ❌ WRONG - Don't use watch mode in scripts
pnpm test --watch
```

## Test Types

### Unit Tests
- Test individual components and functions
- Located in `src/__tests__/` directories
- Use Vitest + Testing Library
- Fast execution (< 1 second per test)

### Integration Tests
- Test feature workflows and service interactions
- Located in `src/__tests__/integration/`
- Test real service connections (N8N, Supabase, Ollama)
- May take longer due to external dependencies

### E2E Tests
- Test complete user workflows
- Located in `src/__tests__/e2e/`
- Require all services to be running
- Use comprehensive service health checks

## Test Configuration

### Vitest Configuration
- **Watch mode disabled by default** in `vitest.config.ts`
- Single fork execution for stability
- 10-second timeout for all tests
- JSDOM environment for React components

### Environment Variables
Tests use the following environment variables:
```env
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=test_anon_key
```

## Running Tests

### Development
```bash
# Run all tests once
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
npx vitest src/__tests__/path/to/test.test.ts --run

# Debug with UI (development only)
pnpm test:ui
```

### CI/CD
```bash
# Always use --run flag in CI
npx vitest --run

# With coverage
npx vitest --run --coverage

# With verbose output
npx vitest --run --reporter=verbose
```

### E2E Testing
```bash
# Run E2E tests with service checks
./scripts/run-e2e-tests-simple.sh

# Run comprehensive E2E tests
./scripts/run-e2e-tests.sh
```

## Test Writing Guidelines

### Vitest Best Practices
- Use `describe`, `it`, `expect` syntax
- Use `vi.mock()` for mocking (not `jest.mock()`)
- Use `vi.fn()` for function mocks
- Use `vi.spyOn()` for method spies
- Use `beforeEach` and `afterEach` for setup/teardown

### Component Testing
```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### Service Testing
```typescript
import { describe, it, expect, vi } from 'vitest'
import { myService } from './myService'

describe('myService', () => {
  it('handles API calls correctly', async () => {
    const mockResponse = { data: 'test' }
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(mockResponse)
    } as Response)

    const result = await myService.fetchData()
    expect(result).toEqual(mockResponse)
  })
})
```

## Coverage Requirements

- **Minimum 80% coverage** for new code
- **100% coverage** for critical business logic
- **Integration tests** for all external service interactions
- **E2E tests** for all user workflows

## Debugging Tests

### Common Issues
1. **Tests hanging**: Check for unhandled promises or async operations
2. **Mock not working**: Ensure mocks are set up before the code under test runs
3. **Environment variables**: Verify test environment is properly configured
4. **Service dependencies**: Ensure required services are running for integration tests

### Debug Commands
```bash
# Run single test with verbose output
npx vitest path/to/test.test.ts --run --reporter=verbose

# Run tests in UI mode for debugging
pnpm test:ui

# Run with debug logging
DEBUG=* npx vitest --run
```

## Performance Guidelines

- **Unit tests**: Should complete in < 1 second
- **Integration tests**: Should complete in < 10 seconds
- **E2E tests**: Should complete in < 30 seconds
- **Total test suite**: Should complete in < 2 minutes

## Continuous Integration

### GitHub Actions
- Tests run on every push and PR
- **No watch mode** in CI environment
- Coverage reports generated automatically
- E2E tests run on main branch only

### Pre-commit Hooks
- Lint and format code
- Run unit tests
- Check test coverage
- **No watch mode** in hooks

## Troubleshooting

### Test Failures
1. Check if all required services are running
2. Verify environment variables are set correctly
3. Ensure mocks are properly configured
4. Check for timing issues with async operations

### Performance Issues
1. Use `vi.useFakeTimers()` for time-dependent tests
2. Mock heavy operations and external APIs
3. Use `vi.spyOn()` instead of full mocks when possible
4. Consider test parallelization for large test suites

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Documentation](https://testing-library.com/)
- [React Testing Best Practices](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest to Vitest Migration Guide](https://vitest.dev/guide/migration.html)
