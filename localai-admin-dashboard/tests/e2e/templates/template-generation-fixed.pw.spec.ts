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
`
};

// Helper function to create test files
async function createTestFile(content: string, filename: string): Promise<string> {
  const tempDir = process.platform === 'win32' ? process.env.TEMP || 'C:\\temp' : '/tmp';
  const filePath = join(tempDir, filename);
  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

// Helper function to sign in
async function signInUser(page: Page) {
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  
  // Check if already signed in
  const isSignedIn = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);
  if (isSignedIn) {
    console.log('Already signed in');
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
    await page.waitForURL('**/documents/**', { timeout: 10000 });
  }
}

test.describe('Template Generation End-to-End (Fixed)', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for AI operations
    test.setTimeout(180000); // 3 minutes
    
    await signInUser(page);
  });

  test('Complete template generation workflow - Equipment Rental', async ({ page }) => {
    console.log('🧪 Starting Equipment Rental template generation test...');
    
    // Step 1: Navigate to document gallery
    console.log('📍 Navigating to document gallery...');
    await page.goto('http://localhost:5173/documents/gallery');
    await page.waitForLoadState('networkidle');
    
    // Look for the gallery page
    await expect(page.locator('text=Document Gallery')).toBeVisible({ timeout: 10000 });
    
    // Step 2: Create test file
    const testFilePath = await createTestFile(TEST_DOCUMENTS.equipment_rental, 'equipment-rental-form.txt');
    console.log('📄 Created test file:', testFilePath);
    
    // Step 3: Show upload zone if needed
    const uploadButton = page.locator('button:has-text("Upload Document")');
    if (await uploadButton.isVisible()) {
      console.log('🔄 Showing upload zone...');
      await uploadButton.click();
      await page.waitForTimeout(500);
    }
    
    // Step 4: Upload document via drag-drop zone
    console.log('📤 Uploading document...');
    const fileInput = page.locator('input[type="file"][accept*=".txt"]');
    await fileInput.setInputFiles(testFilePath);
    
    // Wait for upload to start (loading state)
    await expect(page.locator('text=Uploading document...')).toBeVisible({ timeout: 5000 });
    console.log('⏳ Upload started...');
    
    // Wait for navigation to document detail page (happens after successful upload)
    console.log('⏳ Waiting for document processing...');
    await page.waitForURL('**/documents/*', { 
      timeout: 30000,
      waitUntil: 'networkidle' 
    });
    
    // Verify we're on the document detail page
    const documentUrl = page.url();
    expect(documentUrl).toMatch(/documents\/\d+/);
    console.log('✅ Document uploaded and navigated to:', documentUrl);
    
    // Step 5: Wait for document evaluation to complete
    console.log('⏳ Waiting for document evaluation...');
    
    // Wait for the document to be processed (status should change from analyzing to completed)
    await page.waitForFunction(() => {
      const statusElements = Array.from(document.querySelectorAll('*'));
      return statusElements.some(el => 
        el.textContent?.includes('completed') || 
        el.textContent?.includes('Completed')
      );
    }, { timeout: 60000 });
    
    console.log('✅ Document evaluation completed');
    
    // Step 6: Look for template generation options
    const generateTemplateButton = page.locator('button:has-text("Generate New Template"), button:has-text("Generate Template")');
    await expect(generateTemplateButton).toBeVisible({ timeout: 10000 });
    console.log('✅ Generate Template button is visible');
    
    // Step 7: Click Generate Template
    console.log('🔄 Clicking Generate Template...');
    await generateTemplateButton.click();
    
    // Wait for template generation dialog
    console.log('⏳ Waiting for AI template generation (up to 2 minutes)...');
    await expect(page.locator('text=Generating template..., text=Template Generation')).toBeVisible({ timeout: 10000 });
    
    // Wait for the dialog to show generated content
    await page.waitForFunction(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.some(input => (input as HTMLInputElement).value.includes('Equipment') || (input as HTMLInputElement).value.includes('Rental'));
    }, { timeout: 120000 });
    
    console.log('✅ Template generated successfully');
    
    // Step 8: Verify generated template content
    const templateNameInput = page.locator('input[placeholder*="template name"], input[name="name"], input#template-name').first();
    const templateName = await templateNameInput.inputValue();
    console.log('📝 Generated template name:', templateName);
    expect(templateName).toBeTruthy();
    
    // Check for detected fields
    const fieldElements = page.locator('text=/customer|company|equipment|rental/i');
    const fieldCount = await fieldElements.count();
    console.log('🔍 Fields detected:', fieldCount);
    expect(fieldCount).toBeGreaterThan(0);
    
    // Step 9: Test "Use Without Saving" if available
    const useWithoutSavingButton = page.locator('button:has-text("Use Without Saving")');
    if (await useWithoutSavingButton.isVisible()) {
      console.log('⚡ Testing Use Without Saving...');
      await useWithoutSavingButton.click();
      await page.waitForTimeout(2000);
      console.log('✅ Template applied to document');
    } else {
      // Alternative: Save the template
      const saveButton = page.locator('button:has-text("Save Template"), button:has-text("Save")');
      if (await saveButton.isVisible()) {
        console.log('💾 Saving template...');
        await saveButton.click();
        await page.waitForTimeout(2000);
        console.log('✅ Template saved');
      }
    }
    
    console.log('🎉 Template generation test completed successfully!');
  });
});