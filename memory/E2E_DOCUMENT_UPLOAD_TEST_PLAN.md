# E2E Document Upload Testing Plan

## Overview
Create comprehensive end-to-end tests that simulate real user document uploads and verify the UI updates correctly without getting stuck in "AI Analysis in Progress".

## Test Structure

### 1. Test Documents Folder
Create `/test-documents/` folder containing:

```
test-documents/
├── invoices/
│   ├── simple-invoice.pdf      # Basic invoice with clear fields
│   ├── complex-invoice.pdf     # Multi-page with tables
│   └── invoice-scanned.jpg     # Scanned invoice image
├── contracts/
│   ├── employment-contract.pdf
│   └── service-agreement.docx
├── receipts/
│   ├── restaurant-receipt.jpg
│   └── hotel-receipt.pdf
├── reports/
│   ├── annual-report.pdf
│   └── financial-report.xlsx
└── edge-cases/
    ├── empty-document.pdf      # Blank page
    ├── corrupted.pdf          # Malformed PDF
    ├── huge-document.pdf      # 100+ pages
    └── mixed-content.pdf      # Images + text + tables
```

### 2. E2E Test Suite Structure

```typescript
// src/__tests__/e2e/document-upload-suite/
├── setup/
│   ├── test-environment.ts    # Browser/API setup
│   ├── test-documents.ts      # Document loader utilities
│   └── auth-setup.ts          # Login/auth helpers
├── tests/
│   ├── 01-basic-upload.test.ts
│   ├── 02-status-progression.test.ts
│   ├── 03-template-matching.test.ts
│   ├── 04-error-handling.test.ts
│   └── 05-bulk-upload.test.ts
└── utils/
    ├── upload-helpers.ts
    ├── status-monitors.ts
    └── assertion-helpers.ts
```

## Test Scenarios

### Test 1: Basic Document Upload Flow
```typescript
it('should upload invoice and progress through all statuses', async () => {
  // 1. Navigate to documents page
  // 2. Upload simple-invoice.pdf
  // 3. Verify immediate "uploading" status
  // 4. Verify transitions to "analyzing" within 2s
  // 5. Verify "AI Analysis in Progress" appears
  // 6. Verify transitions to "processing" within 10s (Azure OpenAI)
  // 7. Verify template suggestions appear
  // 8. Verify transitions to "completed"
  // 9. Verify "AI Analysis in Progress" disappears
  // 10. Verify extracted data is displayed
});
```

### Test 2: Status Progression Monitoring
```typescript
it('should track real-time status updates without page refresh', async () => {
  // Upload document
  // Monitor status changes in real-time
  // Log each status transition with timestamp
  // Verify no status gets "stuck"
  // Verify final status is "completed"
});
```

### Test 3: Multiple Document Types
```typescript
const documentTypes = [
  'invoice', 'contract', 'receipt', 'report'
];

documentTypes.forEach(type => {
  it(`should process ${type} documents correctly`, async () => {
    // Upload each document type
    // Verify appropriate template suggestions
    // Verify successful completion
  });
});
```

### Test 4: Error Scenarios
```typescript
it('should handle corrupted documents gracefully', async () => {
  // Upload corrupted.pdf
  // Verify error state is shown
  // Verify UI doesn't get stuck
  // Verify user can retry
});
```

### Test 5: Performance Testing
```typescript
it('should complete processing within expected timeframes', async () => {
  const timings = {
    upload: 2000,      // 2s max
    analyzing: 10000,  // 10s max with Azure
    processing: 15000, // 15s max
    total: 30000      // 30s total max
  };
  
  // Upload and track timing for each phase
  // Assert each phase completes within limits
});
```

## Implementation Steps

### Phase 1: Setup (Day 1)
1. Create test-documents folder structure
2. Generate or collect sample documents
3. Setup Playwright/Cypress configuration
4. Create authentication helpers
5. Setup test data cleanup utilities

### Phase 2: Core Tests (Day 2-3)
1. Implement basic upload test
2. Add status monitoring utilities
3. Create assertion helpers for UI states
4. Implement template matching tests
5. Add error scenario tests

### Phase 3: Advanced Tests (Day 4)
1. Bulk upload scenarios
2. Concurrent upload tests
3. Network failure simulations
4. Performance benchmarking
5. Cross-browser testing

## Key Assertions to Verify

### UI State Assertions
```typescript
// Helper functions to verify UI states
async function assertNotStuckInAnalyzing(page) {
  // Wait up to 30s for status to change from analyzing
  await expect(page.locator('text=AI Analysis in Progress'))
    .not.toBeVisible({ timeout: 30000 });
}

async function assertStatusProgression(page, expectedStatuses) {
  for (const status of expectedStatuses) {
    await expect(page.locator(`[data-status="${status}"]`))
      .toBeVisible();
  }
}

async function assertExtractedDataVisible(page) {
  await expect(page.locator('[data-testid="extracted-fields"]'))
    .toBeVisible();
}
```

## Success Criteria

1. **No Stuck States**: Documents never remain in "analyzing" status indefinitely
2. **Real-time Updates**: UI updates without page refresh
3. **Predictable Flow**: Status progression is consistent and predictable
4. **Error Recovery**: Failed uploads can be retried
5. **Performance**: Azure OpenAI processing completes in <15s
6. **Data Accuracy**: Extracted fields match expected values

## Test Execution

### Local Development
```bash
# Run all e2e tests
pnpm test:e2e

# Run specific suite
pnpm test:e2e document-upload

# Run with UI (headed mode)
pnpm test:e2e --headed

# Generate test report
pnpm test:e2e --reporter=html
```

### CI/CD Pipeline
```yaml
- name: E2E Document Upload Tests
  run: |
    # Start services
    docker compose up -d
    
    # Wait for services
    ./scripts/wait-for-services.sh
    
    # Run tests
    pnpm test:e2e --reporter=junit
    
    # Upload results
    actions/upload-artifact@v3
```

## Monitoring & Debugging

### Debug Helpers
1. Screenshot on failure
2. Video recording for complex flows
3. Network request logging
4. Console log capture
5. Status transition timeline

### Performance Metrics
- Upload time per MB
- Time to first status change
- Total processing time by document type
- Success rate by document type
- Retry attempt frequency

## Next Steps

1. **Immediate**: Create test-documents folder with sample files
2. **Today**: Write first basic upload test
3. **This Week**: Complete core test suite
4. **Next Week**: Add advanced scenarios and performance tests
5. **Ongoing**: Add new document types as they're supported