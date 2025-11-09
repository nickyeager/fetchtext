# Template Generation Testing Plan

**Date:** 2024-09-04  
**Related Plan:** [20240904-template-generation-fix-plan.md](./20240904-template-generation-fix-plan.md)  
**Priority:** High  

## Overview

This testing plan ensures the template generation fix is thoroughly validated across all layers - backend services, frontend components, database integration, and end-to-end user workflows.

## Testing Strategy

### Test Pyramid Approach
- **Unit Tests (70%)**: Individual component and service testing
- **Integration Tests (20%)**: API and database integration
- **End-to-End Tests (10%)**: Complete user workflows

### Test Categories
1. **Backend Unit Tests** - Python/pytest
2. **Backend Integration Tests** - API endpoints with real database
3. **Frontend Unit Tests** - Vitest/React Testing Library
4. **Frontend Integration Tests** - Component integration with mocked APIs
5. **End-to-End Tests** - Playwright full user workflows
6. **Database Tests** - Schema and data integrity
7. **API Tests** - HTTP endpoint validation

## Backend Testing Plan

### 1. Unit Tests (`document-processor/tests/`)

#### A. Template Generation Service Tests
**File:** `test_template_generation_service.py`

```python
class TestTemplateGenerationService:
    """Test template generation service functionality"""
    
    @pytest.fixture
    def service(self):
        return TemplateGenerationService()
    
    @pytest.fixture
    def sample_invoice_content(self):
        return """
        INVOICE #INV-2024-001
        
        From: ACME Corp
        123 Business Street
        Business City, BC 12345
        
        To: Customer Inc
        456 Customer Ave
        Customer City, CC 54321
        
        Date: 2024-01-15
        Total: $1,234.56
        """
    
    async def test_generate_template_from_document_success(self, service, sample_invoice_content):
        """Test successful template generation from invoice content"""
        result = await service.generate_template_from_document(
            content=sample_invoice_content,
            document_type="invoice",
            min_confidence=0.6
        )
        
        assert result is not None
        assert result.name.endswith("Template")
        assert result.category == "finance"
        assert len(result.smart_variables) > 0
        assert result.confidence >= 0.6
        
        # Verify key invoice fields are detected
        field_names = [var.name for var in result.smart_variables]
        assert "invoice_number" in field_names
        assert "total_amount" in field_names
        assert "date" in field_names
    
    async def test_generate_template_low_confidence(self, service):
        """Test template generation with low confidence content"""
        result = await service.generate_template_from_document(
            content="This is just random text with no structure",
            document_type="unknown",
            min_confidence=0.8
        )
        
        assert result is None  # Should reject low confidence
    
    async def test_fallback_analysis_when_ai_unavailable(self, service, sample_invoice_content):
        """Test fallback analysis when Azure OpenAI is unavailable"""
        # Mock Azure OpenAI to be unavailable
        with patch.object(service.azure_service, 'complete', side_effect=Exception("AI unavailable")):
            result = await service.generate_template_from_document(
                content=sample_invoice_content,
                document_type="invoice"
            )
            
            assert result is not None
            assert result.confidence == 0.7  # Fallback confidence
            assert len(result.smart_variables) > 0
    
    def test_field_type_determination(self, service):
        """Test field type detection logic"""
        assert service._determine_field_type("email_address") == "email"
        assert service._determine_field_type("phone_number") == "phone"
        assert service._determine_field_type("total_amount") == "currency"
        assert service._determine_field_type("invoice_date") == "date"
        assert service._determine_field_type("customer_name") == "text"
    
    def test_sample_value_extraction(self, service, sample_invoice_content):
        """Test sample value extraction from content"""
        # Test currency extraction
        currency_sample = service._extract_simple_sample(
            sample_invoice_content, ["total", "amount"], "currency"
        )
        assert currency_sample == "$1,234.56"
        
        # Test date extraction
        date_sample = service._extract_simple_sample(
            sample_invoice_content, ["date"], "date"
        )
        assert date_sample == "2024-01-15"
```

#### B. AI Template Generator Tests
**File:** `test_ai_template_generator.py`

```python
class TestAITemplateGenerator:
    """Test AI template generator functionality"""
    
    @pytest.fixture
    def generator(self):
        return AITemplateGenerator()
    
    async def test_analyze_document_structure(self, generator, temp_pdf_file):
        """Test document structure analysis"""
        result = await generator.analyze_document_structure(temp_pdf_file)
        
        assert "detected_fields" in result
        assert "confidence" in result
        assert "document_type" in result
        assert result["confidence"] > 0
        assert len(result["detected_fields"]) > 0
    
    async def test_generate_template_from_analysis(self, generator):
        """Test template generation from analysis results"""
        analysis = {
            "detected_fields": [
                {
                    "name": "invoice_number",
                    "type": "text",
                    "confidence": 0.9,
                    "sample_value": "INV-001"
                },
                {
                    "name": "total_amount",
                    "type": "currency", 
                    "confidence": 0.95,
                    "sample_value": "$100.00"
                }
            ],
            "confidence": 0.9,
            "document_type": "invoice"
        }
        
        template = await generator.generate_template_from_analysis(
            analysis, "Test Invoice Template"
        )
        
        assert template["name"] == "Test Invoice Template"
        assert template["category"] == "finance"
        assert len(template["smart_variables"]) == 2
        assert template["template_content"] is not None
```

### 2. API Integration Tests

#### A. Template Generation Endpoint Tests
**File:** `test_template_generation_api.py`

```python
class TestTemplateGenerationAPI:
    """Test template generation API endpoints"""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    @pytest.fixture
    def sample_pdf(self):
        # Create a simple test PDF
        return create_test_pdf_content()
    
    def test_generate_template_endpoint_success(self, client, sample_pdf):
        """Test successful template generation via API"""
        response = client.post(
            "/generate-template",
            files={"file": ("test.pdf", sample_pdf, "application/pdf")},
            params={
                "template_name": "Test Template",
                "category": "invoice",
                "auto_save": True
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "template_id" in data
        assert "template" in data
        assert "generation_metadata" in data
        assert data["template"]["name"] == "Test Template"
        assert data["template"]["category"] == "invoice"
        assert len(data["template"]["smart_variables"]) > 0
    
    def test_generate_template_no_file(self, client):
        """Test template generation without file"""
        response = client.post(
            "/generate-template",
            params={"template_name": "Test Template"}
        )
        
        assert response.status_code == 400
        assert "No file provided" in response.json()["detail"]
    
    def test_generate_template_invalid_mode(self, client, sample_pdf):
        """Test template generation with invalid mode"""
        response = client.post(
            "/generate-template", 
            files={"file": ("test.pdf", sample_pdf, "application/pdf")},
            params={
                "template_name": "Test Template",
                "generation_mode": "invalid"
            }
        )
        
        assert response.status_code == 400
        assert "Generation mode must be" in response.json()["detail"]
    
    @patch('app.services.ai_template_generator.analyze_document_structure')
    async def test_generate_template_analysis_failure(self, mock_analyze, client, sample_pdf):
        """Test template generation when document analysis fails"""
        mock_analyze.side_effect = Exception("Analysis failed")
        
        response = client.post(
            "/generate-template",
            files={"file": ("test.pdf", sample_pdf, "application/pdf")},
            params={"template_name": "Test Template"}
        )
        
        assert response.status_code == 500
        assert "Template generation failed" in response.json()["detail"]
```

### 3. Database Integration Tests

#### A. Template Saving Tests
**File:** `test_template_database_integration.py`

```python
class TestTemplateDatabaseIntegration:
    """Test template database operations"""
    
    @pytest.fixture
    async def db_session(self):
        # Setup test database session
        pass
    
    async def test_save_template_to_database(self, db_session):
        """Test saving generated template to database"""
        template_data = {
            "name": "Test Invoice Template",
            "description": "Auto-generated test template",
            "category": "finance",
            "template_content": "Invoice: {{invoice_number}}\\nAmount: {{total_amount}}",
            "smart_variables": [
                {
                    "name": "invoice_number",
                    "display_name": "Invoice Number",
                    "type": "text",
                    "description": "Invoice identifier",
                    "required": True,
                    "extraction_hints": ["invoice", "number"]
                }
            ],
            "is_public": False
        }
        
        saved_template = await _save_template_to_database(
            template_data, "Test Invoice Template", "finance"
        )
        
        assert saved_template["id"] is not None
        assert saved_template["name"] == "Test Invoice Template"
        assert saved_template["category"] == "finance"
        
        # Verify in database
        db_template = await get_template_by_id(saved_template["id"])
        assert db_template is not None
        assert len(db_template["smart_variables"]) == 1
    
    async def test_save_template_duplicate_name(self, db_session):
        """Test handling duplicate template names"""
        template_data = {
            "name": "Duplicate Template",
            "category": "general"
        }
        
        # Save first template
        await _save_template_to_database(template_data, "Duplicate Template", "general")
        
        # Try to save duplicate
        with pytest.raises(ValueError, match="Template name already exists"):
            await _save_template_to_database(template_data, "Duplicate Template", "general")
    
    async def test_save_template_invalid_category(self, db_session):
        """Test saving template with invalid category"""
        template_data = {
            "name": "Test Template",
            "category": "invalid_category"
        }
        
        with pytest.raises(ValueError, match="Invalid category"):
            await _save_template_to_database(template_data, "Test Template", "invalid_category")
```

## Frontend Testing Plan

### 1. Unit Tests (`src/__tests__/`)

#### A. DocumentProcessorEnhanced Tests
**File:** `lib/__tests__/document-processor-enhanced-template-generation.test.ts`

```typescript
describe('DocumentProcessorEnhanced - Template Generation', () => {
  let processor: DocumentProcessorEnhanced;
  
  beforeEach(() => {
    processor = new DocumentProcessorEnhanced();
  });

  it('should call backend API for template generation', async () => {
    const mockResponse = {
      template_id: 'test-id',
      template: {
        name: 'Test Template',
        category: 'invoice',
        smart_variables: []
      }
    };
    
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response);
    
    const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    
    const result = await processor.generateTemplate(testFile, 'Test Template', 'invoice');
    
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:8090/generate-template',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData)
      })
    );
    
    expect(result).toEqual(mockResponse);
  });

  it('should handle API errors gracefully', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error'
    } as Response);
    
    const testFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    
    await expect(
      processor.generateTemplate(testFile, 'Test Template', 'invoice')
    ).rejects.toThrow('Template generation failed: Internal Server Error');
  });

  it('should fallback to mock when backend unavailable', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    
    const testFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    
    const result = await processor.generateTemplate(testFile, 'Test Template', 'invoice');
    
    expect(result).toBeDefined();
    expect(result.template.name).toBe('Test Template');
    expect(result.generation_metadata.generation_method).toBe('fallback');
  });

  it('should handle different file types correctly', async () => {
    const pdfFile = new File(['pdf'], 'test.pdf', { type: 'application/pdf' });
    const txtFile = new File(['text'], 'test.txt', { type: 'text/plain' });
    
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ template_id: 'test' })
    } as Response);
    
    await processor.generateTemplate(pdfFile, 'PDF Template', 'invoice');
    expect(fetchSpy).toHaveBeenCalled();
    
    fetchSpy.mockClear();
    
    // Text files might use fallback initially
    await processor.generateTemplate(txtFile, 'Text Template', 'invoice');
    // Should still try API first, then fallback if needed
  });
});
```

#### B. GeneratedTemplateDialog Tests
**File:** `components/templates/__tests__/GeneratedTemplateDialog.test.tsx`

```typescript
describe('GeneratedTemplateDialog', () => {
  const mockGeneratedTemplate = {
    template_id: 'test-id',
    template: {
      name: 'Test Template',
      category: 'invoice',
      description: 'Test description',
      smart_variables: [
        {
          name: 'invoice_number',
          display_name: 'Invoice Number',
          type: 'text',
          description: 'Invoice identifier',
          required: true,
          extraction_hints: ['invoice', 'number']
        }
      ]
    },
    generation_metadata: {
      ai_confidence: 0.85,
      fields_detected: 1
    }
  };

  it('should display generated template details', () => {
    render(
      <GeneratedTemplateDialog
        open={true}
        onOpenChange={() => {}}
        generatedTemplate={mockGeneratedTemplate}
        onSaveTemplate={vi.fn()}
        onUseTemplate={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('Test Template')).toBeInTheDocument();
    expect(screen.getByDisplayValue('invoice')).toBeInTheDocument();
    expect(screen.getByText('Invoice Number')).toBeInTheDocument();
    expect(screen.getByText('85% confidence')).toBeInTheDocument();
  });

  it('should save template when save button clicked', async () => {
    const mockSaveTemplate = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();

    render(
      <GeneratedTemplateDialog
        open={true}
        onOpenChange={() => {}}
        generatedTemplate={mockGeneratedTemplate}
        onSaveTemplate={mockSaveTemplate}
        onUseTemplate={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /save template/i }));

    expect(mockSaveTemplate).toHaveBeenCalledWith(mockGeneratedTemplate);
  });

  it('should use template without saving when use button clicked', async () => {
    const mockUseTemplate = vi.fn();
    const user = userEvent.setup();

    render(
      <GeneratedTemplateDialog
        open={true}
        onOpenChange={() => {}}
        generatedTemplate={mockGeneratedTemplate}
        onSaveTemplate={vi.fn()}
        onUseTemplate={mockUseTemplate}
      />
    );

    await user.click(screen.getByRole('button', { name: /use without saving/i }));

    expect(mockUseTemplate).toHaveBeenCalledWith(mockGeneratedTemplate);
  });

  it('should allow editing template details', async () => {
    const user = userEvent.setup();

    render(
      <GeneratedTemplateDialog
        open={true}
        onOpenChange={() => {}}
        generatedTemplate={mockGeneratedTemplate}
        onSaveTemplate={vi.fn()}
        onUseTemplate={vi.fn()}
      />
    );

    const nameInput = screen.getByDisplayValue('Test Template');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Template Name');

    expect(nameInput).toHaveValue('Updated Template Name');
  });

  it('should show loading state when saving', () => {
    render(
      <GeneratedTemplateDialog
        open={true}
        onOpenChange={() => {}}
        generatedTemplate={mockGeneratedTemplate}
        onSaveTemplate={vi.fn()}
        onUseTemplate={vi.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });
});
```

### 2. Integration Tests (`src/__tests__/integration/`)

#### A. Template Generation Flow Tests
**File:** `integration/template-generation-flow.test.tsx`

```typescript
describe('Template Generation Flow Integration', () => {
  beforeEach(() => {
    // Setup router context and query client
  });

  it('should complete full template generation flow', async () => {
    const user = userEvent.setup();
    
    // Mock API responses
    const mockGenerateTemplate = vi.fn().mockResolvedValue({
      template_id: 'test-id',
      template: {
        name: 'Generated Template',
        category: 'invoice',
        smart_variables: []
      }
    });
    
    const mockSaveTemplate = vi.fn().mockResolvedValue({ id: 1 });
    
    // Mock document processor
    vi.mocked(DocumentProcessorEnhanced.prototype.generateTemplate)
      .mockImplementation(mockGenerateTemplate);
    
    // Mock template service
    vi.mocked(templateService.createSmartTemplate)
      .mockImplementation(mockSaveTemplate);

    // Render document detail view with analyzing document
    render(<DocumentDetailView documentId="test-doc" />);

    // Wait for template generation button
    const generateButton = await screen.findByRole('button', { 
      name: /generate new template/i 
    });
    
    await user.click(generateButton);

    // Expect template generation to be triggered
    expect(mockGenerateTemplate).toHaveBeenCalled();

    // Wait for generated template dialog
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Interact with dialog
    const saveButton = screen.getByRole('button', { name: /save template/i });
    await user.click(saveButton);

    expect(mockSaveTemplate).toHaveBeenCalled();
  });

  it('should handle template generation errors', async () => {
    const user = userEvent.setup();
    
    // Mock API to fail
    vi.mocked(DocumentProcessorEnhanced.prototype.generateTemplate)
      .mockRejectedValue(new Error('Generation failed'));

    render(<DocumentDetailView documentId="test-doc" />);

    const generateButton = await screen.findByRole('button', { 
      name: /generate new template/i 
    });
    
    await user.click(generateButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/generation failed/i)).toBeInTheDocument();
    });
  });
});
```

## End-to-End Testing Plan

### 1. Complete User Workflows (`tests/e2e/`)

#### A. Template Generation E2E Tests
**File:** `e2e/template-generation-e2e.spec.ts`

```typescript
test.describe('Template Generation End-to-End', () => {
  test.beforeEach(async ({ page }) => {
    await signInUser(page);
  });

  test('should generate template from uploaded document', async ({ page }) => {
    console.log('🧪 Starting template generation E2E test...');
    
    // Step 1: Upload a document
    await page.goto('http://localhost:5173/documents/gallery');
    await page.waitForLoadState('networkidle');
    
    const testContent = `
    INVOICE #INV-2024-001
    
    Date: January 15, 2024
    
    Bill To:
    John Smith
    123 Main Street
    Anytown, AT 12345
    
    Description: Consulting Services
    Amount: $500.00
    
    Total: $500.00
    `;
    
    const testFilePath = await createTestFile(testContent, 'test-invoice.txt');
    
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // Wait for navigation to document detail page
    await page.waitForURL('**/documents/*', { timeout: 30000 });
    
    console.log('✅ Document uploaded successfully');
    
    // Step 2: Wait for document analysis
    await page.waitForFunction(() => {
      return document.body.textContent?.includes('AI Analysis Complete') ||
             document.body.textContent?.includes('Generate New Template');
    }, { timeout: 60000 });
    
    console.log('✅ Document analysis completed');
    
    // Step 3: Click Generate Template
    const generateButton = page.locator('button:has-text("Generate New Template")');
    await expect(generateButton).toBeVisible();
    await generateButton.click();
    
    console.log('🔄 Template generation triggered...');
    
    // Step 4: Wait for template generation dialog
    const templateDialog = page.locator('[role="dialog"]');
    await expect(templateDialog).toBeVisible({ timeout: 120000 });
    
    console.log('✅ Template generation dialog opened');
    
    // Step 5: Verify template details
    await expect(page.locator('input[value*="Template"]')).toBeVisible();
    await expect(page.locator('text=invoice_number')).toBeVisible();
    await expect(page.locator('text=total_amount')).toBeVisible();
    
    console.log('✅ Template fields detected correctly');
    
    // Step 6: Save template
    const saveButton = page.locator('button:has-text("Save Template")');
    await saveButton.click();
    
    // Step 7: Wait for save confirmation
    await expect(page.locator('text=Template saved successfully')).toBeVisible({ 
      timeout: 10000 
    });
    
    console.log('✅ Template saved successfully');
    
    // Step 8: Verify template is applied to document
    await expect(page.locator('text=Document processed successfully')).toBeVisible({
      timeout: 15000
    });
    
    // Step 9: Verify extracted fields are shown
    await expect(page.locator('text=Extracted Fields')).toBeVisible();
    await expect(page.locator('text=INV-2024-001')).toBeVisible();
    await expect(page.locator('text=$500.00')).toBeVisible();
    
    console.log('🎉 Template generation E2E test completed successfully!');
  });

  test('should handle template generation failure gracefully', async ({ page }) => {
    // Mock backend to return error
    await page.route('**/generate-template', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Template generation failed' })
      });
    });

    await page.goto('http://localhost:5173/documents/gallery');
    
    // Upload document and trigger template generation
    const testFilePath = await createTestFile('Simple document', 'simple.txt');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    await page.waitForURL('**/documents/*');
    
    const generateButton = page.locator('button:has-text("Generate New Template")');
    await generateButton.click();
    
    // Should show error message
    await expect(page.locator('text=Template generation failed')).toBeVisible();
    
    // Should offer fallback options
    await expect(page.locator('button:has-text("Browse All Templates")')).toBeVisible();
  });

  test('should allow template customization before saving', async ({ page }) => {
    // Similar setup as first test...
    
    // After template generation dialog opens
    const templateDialog = page.locator('[role="dialog"]');
    await expect(templateDialog).toBeVisible();
    
    // Edit template name
    const nameInput = page.locator('input[value*="Template"]');
    await nameInput.fill('Custom Invoice Template');
    
    // Edit field display name
    const fieldNameInput = page.locator('input[value="Invoice Number"]');
    await fieldNameInput.fill('Invoice ID');
    
    // Add new field
    const addFieldButton = page.locator('button:has-text("Add Field")');
    await addFieldButton.click();
    
    // Fill new field details
    await page.locator('input[placeholder="Field name"]').fill('customer_email');
    await page.locator('input[placeholder="Display name"]').fill('Customer Email');
    
    // Save customized template
    const saveButton = page.locator('button:has-text("Save Template")');
    await saveButton.click();
    
    // Verify customizations were applied
    await expect(page.locator('text=Custom Invoice Template')).toBeVisible();
    await expect(page.locator('text=Invoice ID')).toBeVisible();
    await expect(page.locator('text=Customer Email')).toBeVisible();
  });
});
```

### 2. API Testing (`tests/e2e/`)

#### A. Template Generation API Tests
**File:** `e2e/template-generation-api.spec.ts`

```typescript
test.describe('Template Generation API Tests', () => {
  test('should generate template via API endpoint', async ({ request }) => {
    // Create test file
    const testContent = Buffer.from(`
      INVOICE #12345
      Date: 2024-01-01  
      Total: $100.00
    `);
    
    const response = await request.post('http://localhost:8090/generate-template', {
      multipart: {
        file: {
          name: 'test-invoice.txt',
          mimeType: 'text/plain',
          buffer: testContent
        },
        template_name: 'API Test Template',
        category: 'invoice',
        auto_save: 'true'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result.template_id).toBeDefined();
    expect(result.template.name).toBe('API Test Template');
    expect(result.template.category).toBe('invoice');
    expect(result.template.smart_variables.length).toBeGreaterThan(0);
    expect(result.generation_metadata.auto_save).toBe(true);
  });

  test('should validate template generation parameters', async ({ request }) => {
    const testContent = Buffer.from('test content');
    
    // Test missing required parameters
    const response = await request.post('http://localhost:8090/generate-template', {
      multipart: {
        file: {
          name: 'test.txt',
          mimeType: 'text/plain', 
          buffer: testContent
        }
        // Missing template_name
      }
    });
    
    expect(response.status()).toBe(422); // Validation error
  });
});
```

## Database Testing Plan

### 1. Schema Validation Tests

#### A. Template Table Tests
**File:** `test_database_schema.py`

```python
class TestTemplateDatabaseSchema:
    """Test database schema and constraints"""
    
    async def test_smart_templates_table_structure(self, db_connection):
        """Verify smart_templates table has correct structure"""
        result = await db_connection.fetch("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'smart_templates'
            ORDER BY ordinal_position
        """)
        
        expected_columns = {
            'id': 'integer',
            'name': 'text',
            'description': 'text',
            'category': 'text',
            'template_content': 'text',
            'smart_variables': 'jsonb',
            'created_by': 'uuid',
            'created_at': 'timestamp with time zone',
            'updated_at': 'timestamp with time zone',
            'is_public': 'boolean'
        }
        
        actual_columns = {row['column_name']: row['data_type'] for row in result}
        
        for col_name, col_type in expected_columns.items():
            assert col_name in actual_columns
            assert actual_columns[col_name] == col_type
    
    async def test_template_constraints(self, db_connection):
        """Test database constraints are properly enforced"""
        # Test unique name constraint
        with pytest.raises(UniqueViolationError):
            await db_connection.execute("""
                INSERT INTO smart_templates (name, category, template_content)
                VALUES ('Duplicate Name', 'test', 'content');
                INSERT INTO smart_templates (name, category, template_content)
                VALUES ('Duplicate Name', 'test', 'content2');
            """)
    
    async def test_rls_policies(self, db_connection, test_user_id):
        """Test Row Level Security policies"""
        # Test user can only see their own templates + public ones
        await db_connection.execute(f"SET ROLE authenticated; SET request.jwt.claims TO '{test_user_id}'")
        
        result = await db_connection.fetch("""
            SELECT id FROM smart_templates
            WHERE created_by != $1 AND is_public = false
        """, test_user_id)
        
        assert len(result) == 0  # Should not see private templates from other users
```

## Performance Testing Plan

### 1. Load Testing

#### A. Template Generation Performance
**File:** `test_template_generation_performance.py`

```python
class TestTemplateGenerationPerformance:
    """Test performance of template generation under load"""
    
    @pytest.mark.performance
    async def test_concurrent_template_generation(self):
        """Test multiple concurrent template generations"""
        import asyncio
        import time
        
        async def generate_template(session, doc_content):
            async with session.post(
                'http://localhost:8090/generate-template',
                data={
                    'file': doc_content,
                    'template_name': f'Test Template {time.time()}',
                    'category': 'test'
                }
            ) as response:
                return await response.json()
        
        # Test 10 concurrent requests
        tasks = []
        async with aiohttp.ClientSession() as session:
            for i in range(10):
                doc_content = f"Test document {i} with invoice data"
                tasks.append(generate_template(session, doc_content))
            
            start_time = time.time()
            results = await asyncio.gather(*tasks, return_exceptions=True)
            total_time = time.time() - start_time
        
        # Verify all succeeded
        successful_results = [r for r in results if not isinstance(r, Exception)]
        assert len(successful_results) == 10
        
        # Performance assertions
        assert total_time < 60  # Should complete within 60 seconds
        average_time = total_time / 10
        assert average_time < 10  # Average less than 10 seconds per generation
    
    @pytest.mark.performance 
    def test_large_document_template_generation(self):
        """Test template generation with large documents"""
        # Create large document (50KB)
        large_content = "Large document content " * 2500
        
        start_time = time.time()
        # Call template generation
        generation_time = time.time() - start_time
        
        # Should handle large documents within reasonable time
        assert generation_time < 30  # 30 seconds max
```

## Test Data Management

### 1. Test Fixtures

#### A. Sample Documents
**Directory:** `tests/fixtures/documents/`

```
tests/fixtures/documents/
├── invoices/
│   ├── simple-invoice.txt
│   ├── complex-invoice.pdf
│   └── invoice-with-table.html
├── receipts/
│   ├── restaurant-receipt.txt
│   └── retail-receipt.pdf
├── contracts/
│   ├── employment-contract.docx
│   └── service-agreement.pdf
└── forms/
    ├── application-form.pdf
    └── survey-form.txt
```

#### B. Expected Template Results
**Directory:** `tests/fixtures/expected-templates/`

```typescript
// tests/fixtures/expected-templates/invoice-template.ts
export const expectedInvoiceTemplate = {
  name: "Standard Invoice Template",
  category: "finance",
  smart_variables: [
    {
      name: "invoice_number",
      display_name: "Invoice Number", 
      type: "text",
      required: true
    },
    {
      name: "total_amount",
      display_name: "Total Amount",
      type: "currency", 
      required: true
    },
    {
      name: "invoice_date",
      display_name: "Invoice Date",
      type: "date",
      required: true
    }
  ]
};
```

## Test Execution Plan

### 1. Test Scripts

#### A. Backend Test Script
**File:** `document-processor/run_template_generation_tests.sh`

```bash
#!/bin/bash

echo "🧪 Running Template Generation Backend Tests..."

# Unit tests
echo "Running unit tests..."
python -m pytest tests/test_template_generation_service.py -v

# Integration tests  
echo "Running integration tests..."
python -m pytest tests/test_template_generation_api.py -v

# Database tests
echo "Running database tests..."
python -m pytest tests/test_template_database_integration.py -v

# Performance tests (if enabled)
if [ "$RUN_PERFORMANCE_TESTS" = "true" ]; then
  echo "Running performance tests..."
  python -m pytest tests/test_template_generation_performance.py -v -m performance
fi

echo "✅ Backend tests completed"
```

#### B. Frontend Test Script
**File:** `localai-admin-dashboard/scripts/run-template-generation-tests.sh`

```bash
#!/bin/bash

echo "🧪 Running Template Generation Frontend Tests..."

# Unit tests
echo "Running unit tests..."
pnpm test src/lib/__tests__/document-processor-enhanced-template-generation.test.ts
pnpm test src/components/templates/__tests__/GeneratedTemplateDialog.test.tsx

# Integration tests
echo "Running integration tests..." 
pnpm test src/__tests__/integration/template-generation-flow.test.tsx

# E2E tests
echo "Running E2E tests..."
pnpm test:e2e tests/e2e/template-generation-e2e.spec.ts

echo "✅ Frontend tests completed"
```

### 2. CI/CD Integration

#### A. GitHub Actions Workflow
**File:** `.github/workflows/template-generation-tests.yml`

```yaml
name: Template Generation Tests

on:
  push:
    paths:
      - 'document-processor/**'
      - 'localai-admin-dashboard/src/**'
      - 'plans/20240904-template-generation-*'
  pull_request:
    paths:
      - 'document-processor/**'
      - 'localai-admin-dashboard/src/**'

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        working-directory: document-processor
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-asyncio
      
      - name: Run backend tests
        working-directory: document-processor
        run: ./run_template_generation_tests.sh

  frontend-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
          cache-dependency-path: localai-admin-dashboard/pnpm-lock.yaml
      
      - name: Install dependencies
        working-directory: localai-admin-dashboard
        run: pnpm install
      
      - name: Run frontend tests
        working-directory: localai-admin-dashboard
        run: ./scripts/run-template-generation-tests.sh

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [backend-tests, frontend-tests]
    
    steps:
      - uses: actions/checkout@v4
      - name: Setup services
        run: python start_services.py --profile cpu &
      
      - name: Wait for services
        run: |
          sleep 60
          curl -f http://localhost:5173 || exit 1
          curl -f http://localhost:8090/health || exit 1
      
      - name: Run E2E tests
        working-directory: localai-admin-dashboard
        run: pnpm test:e2e tests/e2e/template-generation-e2e.spec.ts
```

## Success Metrics

### Test Coverage Targets
- **Backend Unit Tests**: 90%+ coverage
- **Backend Integration Tests**: 80%+ coverage  
- **Frontend Unit Tests**: 85%+ coverage
- **Frontend Integration Tests**: 75%+ coverage
- **E2E Tests**: 100% critical path coverage

### Performance Benchmarks
- Template generation: < 30 seconds for typical documents
- Database operations: < 2 seconds for template saving
- API response time: < 5 seconds for template generation endpoint
- UI responsiveness: < 100ms for user interactions

### Quality Gates
- All tests must pass before deployment
- No critical security vulnerabilities
- Performance benchmarks must be met
- Code coverage thresholds must be exceeded

This comprehensive testing plan ensures the template generation fix is thoroughly validated across all components and user workflows.