# Template Generation E2E Test Fix

## Why the Test Was Hanging

The original template generation test was hanging at the document upload step for several reasons:

### 1. **Wrong Page Navigation**
- **Issue**: Test navigated to `/documents` instead of `/documents/gallery`
- **Problem**: The `/documents` route likely shows a document list view without upload functionality
- **Fix**: Navigate to `/documents/gallery` where the upload UI is actually present

### 2. **Non-existent Test IDs**
- **Issue**: Test waited for `[data-testid="document-uploaded"]` which doesn't exist in the codebase
- **Problem**: The test would wait forever (until timeout) for this selector
- **Fix**: Wait for actual UI elements like "Uploading document..." text and URL navigation

### 3. **Missing Upload Zone Activation**
- **Issue**: The file input might be hidden until the "Upload Document" button is clicked
- **Problem**: Setting files on a hidden input might not trigger the upload flow
- **Fix**: Click "Upload Document" button first to show the upload zone if needed

### 4. **Incorrect Success Detection**
- **Issue**: Test expected to stay on same page after upload
- **Problem**: DragDropUpload component navigates to document detail page after successful upload
- **Fix**: Wait for URL change to `/documents/*` pattern

## Key Changes in Fixed Test

### 1. Navigate to Correct Page
```typescript
await page.goto('http://localhost:5173/documents/gallery');
```

### 2. Show Upload Zone
```typescript
const uploadButton = page.locator('button:has-text("Upload Document")');
if (await uploadButton.isVisible()) {
  await uploadButton.click();
}
```

### 3. Wait for Real UI Feedback
```typescript
// Wait for upload to start
await expect(page.locator('text=Uploading document...')).toBeVisible({ timeout: 5000 });

// Wait for navigation after upload
await page.waitForURL('**/documents/*', { timeout: 30000 });
```

### 4. Better Status Detection
```typescript
// Wait for document processing to complete
await page.waitForFunction(() => {
  const statusElements = Array.from(document.querySelectorAll('*'));
  return statusElements.some(el => 
    el.textContent?.includes('completed') || 
    el.textContent?.includes('Completed')
  );
}, { timeout: 60000 });
```

## Upload Flow in the Application

1. User navigates to `/documents/gallery`
2. User clicks "Upload Document" button (toggles upload zone)
3. User selects file via file input
4. DragDropUpload component:
   - Shows "Uploading document..." message
   - Creates document record in database
   - Updates status to "analyzing"
   - Calls `onUploadComplete` callback
5. DocumentGallery navigates to `/documents/{id}` on successful upload
6. Document detail page shows processing status
7. Backend processes document and updates status to "completed"

## Running the Fixed Test

```bash
# Run the fixed test
npx playwright test tests/e2e/template-generation-fixed.spec.ts --headed

# With debug mode
npx playwright test tests/e2e/template-generation-fixed.spec.ts --headed --debug
```

## Additional Improvements

1. **Better Error Messages**: Added console logs at each step
2. **Flexible Selectors**: Uses multiple possible selectors for elements
3. **Status Polling**: Uses `waitForFunction` for dynamic content
4. **Timeout Handling**: Appropriate timeouts for AI operations
5. **URL Validation**: Verifies navigation to correct pages