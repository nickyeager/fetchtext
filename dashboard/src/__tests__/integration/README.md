# Template Generation Integration Tests

This directory contains comprehensive integration tests for the document template generation feature.

## Test Files Overview

### 1. `document-template-generation.test.tsx`
**Frontend Component Integration Tests**

Tests the complete frontend workflow from document upload to template generation:
- Document evaluation and template matching logic
- Automatic template generation triggers
- GeneratedTemplateDialog component interaction
- Template customization and saving
- Error handling in UI components

**Key Test Scenarios:**
- ✅ Automatic generation trigger when no templates exist
- ✅ Template dialog display and field editing
- ✅ Template saving and navigation to editor
- ✅ User customization of generated fields
- ✅ Error state handling and user feedback

### 2. `template-generation-backend.test.tsx`
**DocumentProcessorEnhanced Integration Tests**

Tests the frontend-backend integration layer:
- API endpoint communication
- Response transformation and mapping
- Error handling and fallback mechanisms
- Timeout and abort signal handling

**Key Test Scenarios:**
- ✅ Correct API endpoint calls with proper parameters
- ✅ Response transformation from backend to frontend format
- ✅ Fallback to mock data when API unavailable
- ✅ File type handling and validation
- ✅ Network error and timeout handling

### 3. `template-generation-e2e.test.tsx`
**End-to-End User Workflow Tests**

Tests complete user scenarios using real components:
- Navigation from document gallery to detail view
- Template generation decision logic
- Complete workflow from upload to template application
- Performance and loading state handling

**Key Test Scenarios:**
- ✅ Full user workflow from gallery to template editor
- ✅ Decision logic between existing vs generated templates
- ✅ Template quality metrics display
- ✅ Concurrent request handling
- ✅ Loading states and user feedback

### 4. `template-generation-backend-api.test.tsx`
**Real Backend API Integration Tests**

Tests against the actual running backend service:
- Live API endpoint testing
- Real document processing with AI
- Database integration verification
- Performance and reliability testing

**Key Test Scenarios:**
- ✅ Real PDF/TXT document processing
- ✅ Field detection quality and accuracy
- ✅ Database auto-save functionality
- ✅ Error handling with invalid inputs
- ✅ Performance benchmarks and concurrent load testing

## Running the Tests

### Prerequisites
1. **Backend Services Running**: 
   ```bash
   python start_services.py --profile cpu
   ```
   
2. **Test Data Available**: 
   - Ensure `/data` directory contains sample documents
   - Real PDFs and text files for API testing

3. **Database Setup**:
   - Supabase running with `smart_templates` table
   - Proper authentication configuration

### Test Execution

#### Run All Integration Tests
```bash
cd dashboard
pnpm test src/__tests__/integration/
```

#### Run Specific Test Suites
```bash
# Frontend component tests (fast)
pnpm test document-template-generation.test.tsx

# Backend integration tests (medium)
pnpm test template-generation-backend.test.tsx

# E2E workflow tests (medium)
pnpm test template-generation-e2e.test.tsx

# Real API tests (slow - requires backend)
pnpm test template-generation-backend-api.test.tsx
```

#### Run with Coverage
```bash
pnpm test:coverage src/__tests__/integration/
```

### Test Configuration

**Timeouts:**
- Frontend tests: 10 seconds (default)
- Backend integration: 30 seconds
- API tests: 120 seconds (AI processing)

**Mock Strategy:**
- Component tests: Mock external services
- Integration tests: Mock network calls only
- API tests: No mocks, real backend calls

## Test Data Requirements

### Sample Documents (`/data/`)
Required test files for comprehensive testing:

1. **sample_invoice.txt** - Invoice with line items and totals
2. **sample_receipt.txt** - Retail receipt with payment details
3. **sample_contract.txt** - Service agreement with parties and terms
4. **sample_report.txt** - Business report with metrics
5. **sample_form.txt** - Employee form with personal details
6. **sample_letter.txt** - Business correspondence

### Real PDFs
For API testing with actual document processing:
- **Receipt-2975-4330.pdf** - Real receipt document
- **Hippa_auth_form.pdf** - Medical form
- Additional PDFs in `/data` directory

## Expected Test Results

### Success Criteria

#### Frontend Tests
- ✅ All component interactions work correctly
- ✅ Template generation dialog displays properly
- ✅ Field editing and customization functions
- ✅ Error states are handled gracefully
- ✅ Navigation and routing work as expected

#### Backend Integration Tests  
- ✅ API calls use correct endpoints and parameters
- ✅ Response transformation preserves all data
- ✅ Fallback mechanisms activate when needed
- ✅ File handling works for all supported formats
- ✅ Error scenarios are handled properly

#### E2E Tests
- ✅ Complete user workflows execute successfully
- ✅ Loading states provide appropriate feedback
- ✅ Template quality metrics are accurate
- ✅ Decision logic works for different scenarios
- ✅ Performance is within acceptable limits

#### API Tests
- ✅ Real document processing completes successfully
- ✅ Field detection accuracy meets thresholds
- ✅ Database integration saves templates correctly
- ✅ Performance stays within timeout limits
- ✅ Concurrent requests are handled properly

### Performance Benchmarks

**Expected Processing Times:**
- Text files: < 30 seconds
- PDF files: < 60 seconds
- Complex documents: < 120 seconds

**Accuracy Targets:**
- AI confidence: > 0.7 (70%)
- Field detection: > 3 fields for typical documents
- Extraction success rate: > 80%

## Troubleshooting

### Common Issues

#### Backend Not Available
```
Error: Backend service is not available
```
**Solution:** Start backend services:
```bash
python start_services.py --profile cpu
```

#### Test Data Missing
```
Error: ENOENT: no such file or directory, open 'data/sample_invoice.txt'
```
**Solution:** Ensure test data exists in `/data` directory

#### Timeout Errors
```
Error: Test timed out
```
**Solution:** 
- Check backend performance
- Increase timeout for slow AI processing
- Verify network connectivity

#### Authentication Errors
```
Error: 401 Unauthorized
```
**Solution:**
- Check Supabase configuration
- Verify JWT tokens match between frontend/backend
- Ensure user authentication is properly mocked

### Debug Mode

Run tests with debug logging:
```bash
DEBUG=true pnpm test template-generation --verbose
```

View real-time API calls:
```bash
VITE_API_DEBUG=true pnpm test template-generation-backend-api
```

## Integration with CI/CD

### GitHub Actions Configuration

```yaml
name: Template Generation Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Start backend services
        run: |
          python start_services.py --profile cpu --environment ci &
          sleep 30 # Wait for services to be ready
      
      - name: Run integration tests
        run: pnpm test src/__tests__/integration/
        env:
          TEST_TIMEOUT: 180000
          CI: true
```

### Pre-commit Hooks

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run fast integration tests before commit
pnpm test document-template-generation.test.tsx --run
```

## Contributing

When adding new integration tests:

1. **Follow naming convention**: `feature-scenario.test.tsx`
2. **Include proper setup/teardown**: Clean up resources after tests
3. **Use appropriate timeouts**: Based on expected processing time
4. **Mock external dependencies**: Except for the component being tested
5. **Test both success and failure paths**: Ensure error handling works
6. **Document test scenarios**: Clear descriptions of what's being tested

### Test Structure Template

```typescript
describe('New Feature Integration', () => {
  beforeEach(() => {
    // Setup test data and mocks
  });

  afterEach(() => {
    // Cleanup resources
  });

  describe('Happy Path Scenarios', () => {
    it('should handle normal workflow', async () => {
      // Test implementation
    });
  });

  describe('Error Scenarios', () => {
    it('should handle expected errors gracefully', async () => {
      // Test implementation
    });
  });

  describe('Edge Cases', () => {
    it('should handle boundary conditions', async () => {
      // Test implementation  
    });
  });
});
```

These integration tests ensure the template generation feature works correctly across all layers of the application, from user interaction to AI processing to database storage.