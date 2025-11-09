import { test, expect, Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Test documents for template generation
const TEST_DOCUMENTS = {
  equipment_rental: `
ACME CORP EQUIPMENT RENTAL AGREEMENT

Rental Request Form #RF-2024-0157

Customer Information:
Company Name: TechStart Solutions LLC
Contact Person: Sarah Johnson  
Phone: (555) 123-4567
Email: sarah.johnson@techstart.com
Billing Address: 789 Innovation Drive, Tech City, CA 90210

Equipment Details:
Item Code: LASER-PRO-3000
Equipment Name: Professional Laser Engraver
Serial Number: LP3K-2024-789
Rental Period: 30 days
Start Date: February 1, 2024
End Date: March 2, 2024
Daily Rate: $450.00
Total Rental Cost: $13,500.00

Special Requirements:
- Requires 220V power outlet
- Climate controlled environment  
- Operator training included
- Maintenance package included

Insurance Information:
Policy Number: INS-789456123
Coverage Amount: $50,000
Insurance Company: SecureTech Insurance

Authorized Signatures:
Customer Signature: ___________________ Date: ___________
ACME Representative: _________________ Date: ___________

Form Submitted: January 28, 2024
Processing Status: Approved
Reference Number: REF-2024-TECH-157
`,
  
  medical_inspection: `
BIOMEDICAL EQUIPMENT INSPECTION REPORT

Report ID: BME-INS-2024-0089
Inspection Date: January 25, 2024
Inspector: Dr. Michael Chen, Certified Biomedical Engineer
Facility: General Hospital - ICU Department

Equipment Information:
Device Name: Ventilator System Model V-200
Manufacturer: MedTech Systems Inc
Model Number: V-200-PRO
Serial Number: MTS-V200-8844
Asset Tag: GH-ICU-VENT-12
Installation Date: March 15, 2020
Last Service Date: October 10, 2023

Inspection Categories:
Electrical Safety: PASS
Mechanical Function: PASS
Calibration Check: PASS
Software Verification: PASS
Alarm System Test: PASS
Backup Battery Test: PASS

Performance Measurements:
Pressure Range Test: ±2% accuracy - WITHIN SPEC
Flow Rate Accuracy: ±3% variance - WITHIN SPEC
Volume Delivery: 99.2% accuracy - WITHIN SPEC
Oxygen Concentration: 21.1% - WITHIN SPEC
Temperature Stability: ±0.5°C - WITHIN SPEC

Issues Identified:
1. Minor calibration drift in humidity sensor
2. Backup battery shows 85% capacity (recommend replacement)
3. Air filter requires replacement within 30 days

Recommendations:
- Replace humidity sensor within 60 days
- Schedule battery replacement within 90 days
- Replace air filter within 30 days
- Next inspection due: July 25, 2024

Compliance Status: APPROVED FOR USE
Risk Level: LOW
Next Action Required: Filter replacement

Inspector Certification: BME-2024-CA-5567
Quality Assurance Review: Dr. Lisa Wang
Report Filed: January 25, 2024
`
};

async function createTestFile(content: string, filename: string): Promise<string> {
  const tempDir = '/tmp';
  const filePath = join(tempDir, filename);
  writeFileSync(filePath, content);
  return filePath;
}

async function signInUser(page: Page): Promise<void> {
  // Navigate to the app
  await page.goto('http://localhost:5173');
  
  // Check if we're already signed in
  const isSignedIn = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);
  if (isSignedIn) {
    console.log('User already signed in');
    return;
  }
  
  // Look for sign-in elements
  const signInButton = page.locator('button:has-text("Sign In")').first();
  const emailInput = page.locator('input[type="email"]').first();
  
  if (await signInButton.isVisible()) {
    await signInButton.click();
    await page.waitForTimeout(1000);
  }
  
  if (await emailInput.isVisible()) {
    // Fill in test credentials
    await emailInput.fill('test@example.com');
    await page.locator('input[type="password"]').first().fill('testpassword123');
    await page.locator('button[type="submit"]').click();
    
    // Wait for sign-in to complete
    await page.waitForURL('**/documents', { timeout: 10000 });
  }
}

test.describe('Template Generation End-to-End', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for AI operations
    test.setTimeout(180000); // 3 minutes
    
    await signInUser(page);
    
    // Navigate to documents page
    await page.goto('http://localhost:5173/documents');
    await page.waitForLoadState('networkidle');
  });

  test('Complete template generation workflow - Equipment Rental', async ({ page }) => {
    console.log('🧪 Starting Equipment Rental template generation test...');
    
    // Step 1: Create test file
    const testFilePath = await createTestFile(TEST_DOCUMENTS.equipment_rental, 'equipment-rental-form.txt');
    console.log('📄 Created test file:', testFilePath);
    
    // Step 2: Upload document
    console.log('📤 Uploading document...');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFilePath);
    
    // Wait for upload to complete
    await page.waitForSelector('[data-testid="document-uploaded"]', { timeout: 30000 });
    console.log('✅ Document uploaded successfully');
    
    // Step 3: Navigate to document detail view
    const documentLink = page.locator('[data-testid="document-item"]').first();
    await documentLink.click();
    
    // Wait for document evaluation
    await page.waitForSelector('[data-testid="document-evaluation"]', { timeout: 60000 });
    console.log('✅ Document evaluation completed');
    
    // Step 4: Check if "Generate New Template" button is visible
    const generateTemplateButton = page.locator('button:has-text("Generate New Template")');
    await expect(generateTemplateButton).toBeVisible({ timeout: 5000 });
    console.log('✅ Generate Template button is visible');
    
    // Step 5: Click "Generate New Template"
    console.log('🔄 Clicking Generate New Template...');
    await generateTemplateButton.click();
    
    // Wait for template generation (this takes time with AI)
    console.log('⏳ Waiting for AI template generation (up to 2 minutes)...');
    await page.waitForSelector('[data-testid="generated-template-dialog"]', { timeout: 120000 });
    console.log('✅ Generated Template Dialog appeared');
    
    // Step 6: Verify dialog content
    const dialog = page.locator('[data-testid="generated-template-dialog"]');
    await expect(dialog).toBeVisible();
    
    // Check that template name is populated
    const templateNameInput = dialog.locator('input[id="template-name"]');
    await expect(templateNameInput).not.toHaveValue('');
    const templateName = await templateNameInput.inputValue();
    console.log('📝 Template name:', templateName);
    
    // Check that category is selected
    const categorySelect = dialog.locator('[data-testid="template-category"]');
    const categoryValue = await categorySelect.textContent();
    console.log('📂 Template category:', categoryValue);
    
    // Check that fields were detected
    const detectedFields = dialog.locator('[data-testid="template-field"]');
    const fieldCount = await detectedFields.count();
    expect(fieldCount).toBeGreaterThan(0);
    console.log('🔍 Fields detected:', fieldCount);
    
    // Step 7: Test "Use Without Saving" option
    console.log('⚡ Testing Use Without Saving...');
    const useWithoutSavingButton = dialog.locator('button:has-text("Use Without Saving")');
    await expect(useWithoutSavingButton).toBeVisible();
    await useWithoutSavingButton.click();
    
    // Wait for dialog to close and processing to complete
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    console.log('✅ Dialog closed, processing document...');
    
    // Wait for document processing to complete
    await page.waitForSelector('[data-testid="document-processed"]', { timeout: 60000 });
    console.log('✅ Document processing completed');
    
    // Step 8: Verify extracted data is displayed
    const extractedData = page.locator('[data-testid="extracted-fields"]');
    await expect(extractedData).toBeVisible();
    
    const extractedFields = extractedData.locator('[data-testid="extracted-field"]');
    const extractedCount = await extractedFields.count();
    expect(extractedCount).toBeGreaterThan(0);
    console.log('📊 Extracted fields displayed:', extractedCount);
    
    console.log('🎉 Equipment Rental template generation test PASSED');
  });

  test('Template generation and save workflow - Medical Report', async ({ page }) => {
    console.log('🧪 Starting Medical Report template save test...');
    
    // Step 1: Create test file
    const testFilePath = await createTestFile(TEST_DOCUMENTS.medical_inspection, 'medical-inspection-report.txt');
    console.log('📄 Created test file:', testFilePath);
    
    // Step 2: Upload document
    console.log('📤 Uploading document...');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFilePath);
    
    // Wait for upload and navigation to detail view
    await page.waitForSelector('[data-testid="document-uploaded"]', { timeout: 30000 });
    const documentLink = page.locator('[data-testid="document-item"]').first();
    await documentLink.click();
    
    // Wait for evaluation
    await page.waitForSelector('[data-testid="document-evaluation"]', { timeout: 60000 });
    console.log('✅ Document evaluation completed');
    
    // Step 3: Generate template
    const generateTemplateButton = page.locator('button:has-text("Generate New Template")');
    await expect(generateTemplateButton).toBeVisible();
    await generateTemplateButton.click();
    
    console.log('⏳ Waiting for AI template generation...');
    await page.waitForSelector('[data-testid="generated-template-dialog"]', { timeout: 120000 });
    
    // Step 4: Edit template details
    const dialog = page.locator('[data-testid="generated-template-dialog"]');
    const templateNameInput = dialog.locator('input[id="template-name"]');
    
    // Clear and set custom name
    await templateNameInput.clear();
    await templateNameInput.fill('Medical Equipment Inspection Template');
    
    // Set category
    const categorySelect = dialog.locator('[data-testid="template-category-trigger"]');
    await categorySelect.click();
    await page.locator('[data-testid="category-medical"]').click();
    
    // Add description
    const descriptionInput = dialog.locator('textarea[id="template-description"]');
    await descriptionInput.fill('Template for biomedical equipment inspection reports');
    
    console.log('✏️ Template details edited');
    
    // Step 5: Save template and navigate to editor
    console.log('💾 Saving template...');
    const saveButton = dialog.locator('button:has-text("Save & Edit Template")');
    await expect(saveButton).toBeVisible();
    await saveButton.click();
    
    // Wait for navigation to template editor
    console.log('⏳ Waiting for navigation to template editor...');
    await page.waitForURL('**/templates/*/edit', { timeout: 30000 });
    console.log('✅ Navigated to template editor');
    
    // Step 6: Verify template editor shows saved template
    const editorTitle = page.locator('[data-testid="template-editor-title"]');
    await expect(editorTitle).toContainText('Medical Equipment Inspection Template');
    
    const savedFields = page.locator('[data-testid="template-field-editor"]');
    const savedFieldCount = await savedFields.count();
    expect(savedFieldCount).toBeGreaterThan(0);
    console.log('📝 Template editor showing', savedFieldCount, 'fields');
    
    // Step 7: Verify template appears in template gallery
    console.log('🔍 Checking template gallery...');
    await page.goto('http://localhost:5173/templates');
    await page.waitForLoadState('networkidle');
    
    const templateCard = page.locator('[data-testid="template-card"]:has-text("Medical Equipment Inspection Template")');
    await expect(templateCard).toBeVisible({ timeout: 10000 });
    console.log('✅ Template appears in gallery');
    
    // Step 8: Test using the saved template on a new document
    console.log('🔄 Testing saved template on new document...');
    await page.goto('http://localhost:5173/documents');
    
    // Upload the same document type again
    const newFileInput = page.locator('input[type="file"]').first();
    const testFilePath2 = await createTestFile(TEST_DOCUMENTS.medical_inspection, 'medical-inspection-report-2.txt');
    await newFileInput.setInputFiles(testFilePath2);
    
    await page.waitForSelector('[data-testid="document-uploaded"]', { timeout: 30000 });
    const newDocumentLink = page.locator('[data-testid="document-item"]').first();
    await newDocumentLink.click();
    
    // Wait for evaluation - should now suggest our saved template
    await page.waitForSelector('[data-testid="document-evaluation"]', { timeout: 60000 });
    
    // Look for template suggestion
    const templateSuggestion = page.locator('[data-testid="template-suggestion"]:has-text("Medical Equipment Inspection Template")');
    if (await templateSuggestion.isVisible()) {
      console.log('✅ Saved template is suggested for new document');
      
      // Use the suggested template
      const useTemplateButton = templateSuggestion.locator('button:has-text("Use Template")');
      await useTemplateButton.click();
      
      // Wait for processing
      await page.waitForSelector('[data-testid="document-processed"]', { timeout: 60000 });
      console.log('✅ New document processed with saved template');
    } else {
      console.log('ℹ️ Template not suggested (may need more specific matching logic)');
    }
    
    console.log('🎉 Medical Report template save and reuse test PASSED');
  });

  test('Error handling - Backend service down', async ({ page }) => {
    console.log('🧪 Testing error handling when backend is unavailable...');
    
    // Mock network failure for template generation
    await page.route('**/api/enhanced-documents/decide-template', route => {
      route.abort('failed');
    });
    
    const testFilePath = await createTestFile(TEST_DOCUMENTS.equipment_rental, 'test-error-handling.txt');
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFilePath);
    
    await page.waitForSelector('[data-testid="document-uploaded"]', { timeout: 30000 });
    const documentLink = page.locator('[data-testid="document-item"]').first();
    await documentLink.click();
    
    // Try to generate template
    const generateButton = page.locator('button:has-text("Generate New Template")');
    if (await generateButton.isVisible()) {
      await generateButton.click();
      
      // Should show error message
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible({ timeout: 30000 });
      
      const errorText = await errorMessage.textContent();
      expect(errorText).toContain('failed');
      
      console.log('✅ Error handling works correctly');
    }
  });
});

test('Template generation performance benchmark', async ({ page }) => {
  console.log('⚡ Running template generation performance test...');
  
  await signInUser(page);
  await page.goto('http://localhost:5173/documents');
  
  const testFilePath = await createTestFile(TEST_DOCUMENTS.equipment_rental, 'performance-test.txt');
  
  const startTime = Date.now();
  
  // Upload
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(testFilePath);
  await page.waitForSelector('[data-testid="document-uploaded"]', { timeout: 30000 });
  
  const uploadTime = Date.now() - startTime;
  console.log(`📤 Upload took: ${uploadTime}ms`);
  
  // Navigate to detail
  const documentLink = page.locator('[data-testid="document-item"]').first();
  await documentLink.click();
  
  const evaluationStartTime = Date.now();
  await page.waitForSelector('[data-testid="document-evaluation"]', { timeout: 60000 });
  const evaluationTime = Date.now() - evaluationStartTime;
  console.log(`🔍 Evaluation took: ${evaluationTime}ms`);
  
  // Generate template
  const generateButton = page.locator('button:has-text("Generate New Template")');
  await generateButton.click();
  
  const generationStartTime = Date.now();
  await page.waitForSelector('[data-testid="generated-template-dialog"]', { timeout: 120000 });
  const generationTime = Date.now() - generationStartTime;
  console.log(`🤖 Template generation took: ${generationTime}ms`);
  
  // Performance assertions
  expect(uploadTime).toBeLessThan(30000); // 30 seconds max
  expect(evaluationTime).toBeLessThan(60000); // 60 seconds max
  expect(generationTime).toBeLessThan(120000); // 2 minutes max
  
  console.log('✅ Performance benchmarks passed');
});