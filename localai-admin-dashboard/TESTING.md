# Testing Documentation

## Overview

This project has a comprehensive testing infrastructure with multiple layers of testing to ensure reliability and integration between all services.

## Test Structure

### Unit Tests
- **Location**: `src/components/**/*.test.tsx`, `src/lib/**/*.test.ts`
- **Purpose**: Test individual components and utilities in isolation
- **Framework**: Vitest with React Testing Library

### Integration Tests
- **Location**: `src/__tests__/integration/`
- **Purpose**: Test interactions between components and services
- **Examples**:
  - `documents-route-comparison.test.tsx` - Route and component integration
  - `ollama-document-extraction.test.tsx` - Ollama service integration

### End-to-End Tests
- **Location**: `src/__tests__/e2e/`
- **Purpose**: Test complete workflows across all services
- **Examples**:
  - `document-processing-e2e.test.tsx` - Full document processing pipeline

## Service Dependencies

### Required Services for E2E Tests
- **N8N** (localhost:5678) - Workflow automation
- **Ollama** (localhost:11434) - AI model serving
- **Admin Dashboard** (localhost:5174) - Web interface
- **Supabase** (localhost:8000) - Database and authentication

### Docker Services Status
Check service status with:
```bash
docker compose ps
```

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Types
```bash
# Unit tests only
npm test -- --run src/components/

# Integration tests
npm test -- --run src/__tests__/integration/

# E2E tests
npm test -- --run src/__tests__/e2e/
```

### E2E Test Runner Script
For comprehensive E2E testing with service health checks:
```bash
./scripts/run-e2e-tests-simple.sh
```

This script:
1. Verifies Docker is running
2. Checks all required services are responding
3. Runs the E2E test suite
4. Provides detailed feedback on failures

## Test Configuration

### Vitest Config
- **File**: `vitest.config.ts`
- **Environment**: jsdom for React component testing
- **Setup**: `vitest.setup.ts` for global test configuration

### Mocking Strategy
- **External Services**: Mocked in unit/integration tests
- **React Components**: Mocked for isolation when needed
- **API Calls**: Real calls in E2E tests, mocked otherwise

## E2E Test Features

### Service Health Checks
- Validates all required services are running and responsive
- Tests actual API endpoints with real network calls
- Provides clear feedback on which services are down

### N8N Integration
- Tests N8N API accessibility
- Validates webhook endpoints (when workflows are configured)
- Handles authentication requirements gracefully

### Ollama Integration
- Lists available models
- Tests actual text generation (can be slow)
- Validates model responses

### Admin Dashboard
- Tests web interface accessibility
- Validates core application functionality
- Checks authentication flows

### Supabase Integration
- Tests database connectivity through Kong gateway
- Validates REST API endpoints
- Checks authentication services

## Troubleshooting

### Common Issues

#### Services Not Running
```
✗ Some services are not responding. Tests may fail.
```
**Solution**: Start Docker services with `docker compose up -d`

#### N8N Authentication Required
```
Failed to create N8N workflow: Unauthorized
```
**Note**: This is expected in secure environments. E2E tests fall back to basic API checks.

#### Ollama Model Loading
```
should test Ollama API directly (slow)
```
**Note**: First-time model loading can take 10-30 seconds. This is normal.

#### Test Timeouts
If tests hang or timeout:
1. Check Docker memory allocation (recommend 4GB+)
2. Verify no port conflicts
3. Restart Docker services

### Debug Commands

```bash
# Check service logs
docker compose logs [service-name]

# Test individual services
curl http://localhost:5678/healthz  # N8N
curl http://localhost:11434/api/tags  # Ollama
curl http://localhost:5174/  # Admin Dashboard
curl http://localhost:8000/rest/v1/  # Supabase

# Run specific test with verbose output
npm test -- --run src/__tests__/e2e/document-processing-e2e.test.tsx --reporter=verbose
```

## Continuous Integration

### Prerequisites for CI/CD
1. Docker environment with sufficient resources
2. All required ports available (5678, 11434, 5174, 8000)
3. Network access for model downloads (Ollama)

### Environment Variables
Tests respect these environment variables:
- `CI=true` - Adjusts timeouts and behavior for CI environments
- `NODE_ENV=test` - Enables test-specific configurations

## Adding New Tests

### Unit Tests
1. Create test file next to component: `Component.test.tsx`
2. Import from `vitest` and `@testing-library/react`
3. Mock external dependencies
4. Test component behavior in isolation

### Integration Tests
1. Create test in `src/__tests__/integration/`
2. Test interactions between real components
3. Mock external services only
4. Focus on data flow and state management

### E2E Tests
1. Create test in `src/__tests__/e2e/`
2. Use real services (no mocking)
3. Test complete user workflows
4. Include setup and cleanup steps

## Best Practices

### Test Writing
- Use descriptive test names
- Group related tests with `describe`
- Set appropriate timeouts for different operations
- Clean up resources in `afterEach` or `afterAll`

### Service Integration
- Always check service health before running tests
- Provide fallback behavior for service failures
- Use realistic test data
- Respect service rate limits

### Maintenance
- Keep test dependencies up to date
- Review and update mocks when APIs change
- Monitor test execution times
- Document any special requirements

## Performance Notes

### Test Execution Times
- **Unit Tests**: < 1 second each
- **Integration Tests**: 1-5 seconds each
- **E2E Tests**: 10-30 seconds each (due to real service calls)

### Resource Usage
- **Memory**: 2-4 GB recommended for full test suite
- **CPU**: Tests are mostly I/O bound, moderate CPU usage
- **Network**: E2E tests make real HTTP requests

### Optimization Tips
- Run unit tests in parallel (default)
- Run E2E tests sequentially to avoid resource conflicts
- Use test filtering to run specific test suites during development
- Consider test data cleanup strategies for large test suites
