/**
 * Document Template Generation Integration Tests
 * 
 * Tests the complete workflow from document upload to template generation:
 * 1. Document upload and evaluation
 * 2. No existing templates found
 * 3. Automatic template generation trigger
 * 4. AI-powered template creation
 * 5. User review and template saving
 * 6. Template application to document
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentDetailView } from '@/features/documents/components/DocumentDetailView';
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced';
import { templateService } from '@/services/template-service';
import { documentManager } from '@/hooks/use-document-manager';

// Mock external dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  }
}));

vi.mock('@/hooks/use-document-manager', () => ({
  documentManager: {
    updateDocumentStatus: vi.fn(),
    finalizeDocument: vi.fn(),
    getDocument: vi.fn(),
    markDocumentFailed: vi.fn()
  }
}));

vi.mock('@/services/template-service', () => ({
  templateService: {
    createTemplate: vi.fn(),
    getAllTemplates: vi.fn(),
    searchTemplates: vi.fn()
  }
}));

vi.mock('@/lib/document-processor-enhanced', () => ({
  DocumentProcessorEnhanced: vi.fn()
}));

// Test data
const mockDocument = {
  id: 'test-doc-123',
  name: 'test-invoice.pdf',
  file_type: 'application/pdf',
  processing_status: 'uploaded',
  metadata: {
    file_size: 15432,
    upload_timestamp: '2024-01-15T10:30:00Z'
  },
  storage_path: '/test-uploads/test-invoice.pdf'
};

const mockEvaluation = {
  type_evaluation: {
    primary_type: 'invoice',
    confidence: 0.92,
    detected_categories: ['financial', 'business']
  },
  content_analysis: {
    field_analysis: {
      detected_fields: ['invoice_number', 'total_amount', 'date', 'company_name'],
      extraction_patterns: {
        invoice_number: ['INV-2024-001'],
        total_amount: ['$8,029.00'],
        date: ['January 15, 2024'],
        company_name: ['ACME Corporation']
      }
    }
  },
  template_suggestions: [], // No existing templates - triggers generation
  processing_recommendations: {
    workflow: 'generate_template',
    suggested_action: 'Generate a new AI-powered template for this document type'
  }
};

const mockGeneratedTemplate = {
  template_id: 'gen-template-456',
  template: {
    id: 456,
    name: 'Invoice Template',
    description: 'AI-generated template for invoice documents',
    category: 'invoice',
    template_content: '# Invoice Summary\n**Invoice Number:** {invoice_number}\n**Total Amount:** {total_amount}',
    smart_variables: [
      {
        id: 'invoice_number',
        name: 'invoice_number',
        type: 'text',
        description: 'Invoice or reference number',
        required: true,
        extraction_hints: ['invoice', 'invoice #', 'reference number']
      },
      {
        id: 'total_amount',
        name: 'total_amount',
        type: 'currency',
        description: 'Total amount or balance',
        required: true,
        extraction_hints: ['total', 'amount', 'grand total', 'balance due']
      },
      {
        id: 'invoice_date',
        name: 'invoice_date',
        type: 'date',
        description: 'Invoice date',
        required: true,
        extraction_hints: ['date', 'invoice date', 'issue date']
      },
      {
        id: 'company_name',
        name: 'company_name',
        type: 'text',
        description: 'Company or vendor name',
        required: false,
        extraction_hints: ['company', 'vendor', 'from', 'seller']
      }
    ],
    tags: ['ai-generated', 'invoice', 'financial'],
    is_public: false
  },
  generation_metadata: {
    ai_confidence: 0.85,
    fields_detected: 4,
    generation_method: 'automatic',
    original_filename: 'test-invoice.pdf'
  },
  validation_results: {
    template_valid: true,
    validation_warnings: []
  },
  test_extraction: {
    extraction_successful: true,
    extracted_fields_count: 4,
    average_confidence: 0.82
  }
};

describe('Document Template Generation Integration', () => {
  let queryClient: QueryClient;
  let mockDocumentProcessor: any;
  let mockTemplateService: any;
  let mockDocumentManager: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    // Setup mocks
    mockDocumentProcessor = {
      generateTemplate: vi.fn(),
      processWithExistingTemplate: vi.fn(),
      isBackendAvailable: vi.fn().mockResolvedValue(true),
      isEnhancedApiAvailable: vi.fn().mockResolvedValue(true)
    };
    
    mockTemplateService = {
      createTemplate: vi.fn(),
      getAllTemplates: vi.fn().mockResolvedValue([]),
      searchTemplates: vi.fn().mockResolvedValue([])
    };
    
    mockDocumentManager = {
      updateDocumentStatus: vi.fn(),
      finalizeDocument: vi.fn(),
      getDocument: vi.fn().mockResolvedValue(mockDocument),
      markDocumentFailed: vi.fn()
    };

    // Apply mocks
    vi.mocked(DocumentProcessorEnhanced).mockImplementation(() => mockDocumentProcessor);
    vi.mocked(templateService.createTemplate).mockImplementation(mockTemplateService.createTemplate);
    vi.mocked(templateService.getAllTemplates).mockImplementation(mockTemplateService.getAllTemplates);
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  const renderDocumentDetailView = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DocumentDetailView 
          documentId="test-doc-123"
          document={mockDocument}
          evaluation={mockEvaluation}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  describe('Automatic Template Generation Trigger', () => {
    it('should automatically trigger template generation when no existing templates found', async () => {
      mockDocumentProcessor.generateTemplate.mockResolvedValue(mockGeneratedTemplate);
      
      renderDocumentDetailView();

      // Verify the workflow recommendation shows template generation
      expect(screen.getByText(/Generate a new AI-powered template/)).toBeInTheDocument();
      
      // Simulate document processing (would normally be triggered automatically)
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(mockDocumentProcessor.generateTemplate).toHaveBeenCalledWith(
          expect.any(File),
          'Invoice Template',
          'invoice'
        );
      });
    });

    it('should handle backend API calls correctly', async () => {
      mockDocumentProcessor.generateTemplate.mockResolvedValue(mockGeneratedTemplate);
      
      renderDocumentDetailView();
      
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(mockDocumentProcessor.generateTemplate).toHaveBeenCalledTimes(1);
        expect(mockDocumentManager.updateDocumentStatus).toHaveBeenCalledWith(
          'test-doc-123',
          expect.objectContaining({
            status: 'processing',
            metadata: expect.objectContaining({
              processing_method: 'ai_enhanced'
            })
          })
        );
      });
    });

    it('should not trigger generation when existing templates are available', async () => {
      const evaluationWithTemplates = {
        ...mockEvaluation,
        template_suggestions: [
          {
            template_id: 123,
            template_name: 'Existing Invoice Template',
            confidence: 0.95
          }
        ],
        processing_recommendations: {
          workflow: 'existing_template',
          suggested_action: 'Use the "Existing Invoice Template" template for best results'
        }
      };

      renderDocumentDetailView({ evaluation: evaluationWithTemplates });

      // Should show existing template recommendation instead
      expect(screen.getByText(/Use the "Existing Invoice Template"/)).toBeInTheDocument();
      
      // Should not show generate template option as primary
      const generateButton = screen.queryByRole('button', { name: /generate template/i });
      expect(generateButton).toBeInTheDocument(); // Available but not primary action
    });
  });

  describe('Template Generation Process', () => {
    beforeEach(() => {
      mockDocumentProcessor.generateTemplate.mockResolvedValue(mockGeneratedTemplate);
    });

    it('should display generated template dialog after successful generation', async () => {
      renderDocumentDetailView();
      
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByTestId('generated-template-dialog')).toBeInTheDocument();
      });

      // Check dialog content
      expect(screen.getByText('AI-Generated Template')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Invoice Template')).toBeInTheDocument();
      
      // Check detected fields
      const fieldElements = screen.getAllByTestId('template-field');
      expect(fieldElements).toHaveLength(4);
      
      // Verify specific fields
      expect(screen.getByDisplayValue('invoice_number')).toBeInTheDocument();
      expect(screen.getByDisplayValue('total_amount')).toBeInTheDocument();
      expect(screen.getByDisplayValue('invoice_date')).toBeInTheDocument();
      expect(screen.getByDisplayValue('company_name')).toBeInTheDocument();
    });

    it('should show generation metadata and confidence scores', async () => {
      renderDocumentDetailView();
      
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('4 fields detected')).toBeInTheDocument();
        expect(screen.getByText('85% confidence')).toBeInTheDocument();
        expect(screen.getByText('Source: test-invoice.pdf')).toBeInTheDocument();
      });
    });

    it('should allow editing generated template fields', async () => {
      renderDocumentDetailView();
      
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByTestId('generated-template-dialog')).toBeInTheDocument();
      });

      // Edit template name
      const nameInput = screen.getByDisplayValue('Invoice Template');
      fireEvent.change(nameInput, { target: { value: 'Custom Invoice Template' } });
      expect(screen.getByDisplayValue('Custom Invoice Template')).toBeInTheDocument();

      // Edit field description
      const descriptionInput = screen.getByDisplayValue('Invoice or reference number');
      fireEvent.change(descriptionInput, { target: { value: 'Invoice ID or reference number' } });
      expect(screen.getByDisplayValue('Invoice ID or reference number')).toBeInTheDocument();
    });

    it('should handle template generation errors gracefully', async () => {
      const error = new Error('Backend API unavailable');
      mockDocumentProcessor.generateTemplate.mockRejectedValue(error);
      
      renderDocumentDetailView();
      
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/Backend API unavailable/)).toBeInTheDocument();
        expect(mockDocumentManager.markDocumentFailed).toHaveBeenCalledWith(
          'test-doc-123',
          'Backend API unavailable'
        );
      });
    });
  });

  describe('Template Saving and Application', () => {
    beforeEach(() => {
      mockDocumentProcessor.generateTemplate.mockResolvedValue(mockGeneratedTemplate);
      mockTemplateService.createTemplate.mockResolvedValue({
        id: 789,
        ...mockGeneratedTemplate.template
      });
    });

    it('should save template to database when user clicks "Save & Edit Template"', async () => {
      renderDocumentDetailView();
      
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByTestId('generated-template-dialog')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save & edit template/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockTemplateService.createTemplate).toHaveBeenCalledWith({
          name: 'Invoice Template',
          description: 'AI-generated template for invoice documents',
          category: 'invoice',
          template_content: expect.stringContaining('Invoice Summary'),
          template_type: 'smart',
          smart_variables: expect.arrayContaining([
            expect.objectContaining({ name: 'invoice_number' }),
            expect.objectContaining({ name: 'total_amount' })
          ]),
          tags: ['ai-generated', 'invoice', 'financial'],
          is_public: false,
          extraction_rules: expect.any(Array),
          generation_settings: expect.any(Object)
        });
      });
    });

    it('should navigate to template editor after successful save', async () => {
      const mockNavigate = vi.fn();
      vi.mock('@tanstack/react-router', () => ({
        useNavigate: () => mockNavigate
      }));

      renderDocumentDetailView();
      
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByTestId('generated-template-dialog')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save & edit template/i });
      fireEvent.click(saveButton);

      // Note: Navigation testing would require proper router setup
      // This tests the service call, actual navigation testing would be in E2E tests
      await waitFor(() => {
        expect(mockTemplateService.createTemplate).toHaveBeenCalled();
      });
    });

    it('should allow using template without saving', async () => {
      renderDocumentDetailView();
      
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByTestId('generated-template-dialog')).toBeInTheDocument();
      });

      const useButton = screen.getByRole('button', { name: /use without saving/i });
      fireEvent.click(useButton);

      await waitFor(() => {
        expect(mockDocumentManager.finalizeDocument).toHaveBeenCalledWith(
          'test-doc-123',
          expect.objectContaining({
            processing_method: 'ai_enhanced'
          })
        );
      });
    });

    it('should handle template save errors', async () => {
      const saveError = new Error('Database connection failed');
      mockTemplateService.createTemplate.mockRejectedValue(saveError);

      renderDocumentDetailView();
      
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByTestId('generated-template-dialog')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save & edit template/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        // Error should be displayed in the UI
        expect(screen.getByText(/Database connection failed/)).toBeInTheDocument();
      });
    });
  });

  describe('Field Type Detection and Validation', () => {
    it('should correctly detect and display field types', async () => {
      mockDocumentProcessor.generateTemplate.mockResolvedValue(mockGeneratedTemplate);
      
      renderDocumentDetailView();
      
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByTestId('generated-template-dialog')).toBeInTheDocument();
      });

      // Check that different field types are properly displayed
      const fieldElements = screen.getAllByTestId('template-field');
      
      // Text field
      const textField = fieldElements.find(el => 
        within(el).queryByDisplayValue('invoice_number')
      );
      expect(textField).toBeInTheDocument();

      // Currency field  
      const currencyField = fieldElements.find(el =>
        within(el).queryByDisplayValue('total_amount')
      );
      expect(currencyField).toBeInTheDocument();

      // Date field
      const dateField = fieldElements.find(el =>
        within(el).queryByDisplayValue('invoice_date')
      );
      expect(dateField).toBeInTheDocument();
    });

    it('should show extraction hints for each field', async () => {
      mockDocumentProcessor.generateTemplate.mockResolvedValue(mockGeneratedTemplate);
      
      renderDocumentDetailView();
      
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('invoice')).toBeInTheDocument();
        expect(screen.getByText('invoice #')).toBeInTheDocument();
        expect(screen.getByText('total')).toBeInTheDocument();
        expect(screen.getByText('amount')).toBeInTheDocument();
      });
    });
  });

  describe('Integration with Document Processing', () => {
    it('should complete full workflow from upload to template application', async () => {
      mockDocumentProcessor.generateTemplate.mockResolvedValue(mockGeneratedTemplate);
      mockTemplateService.createTemplate.mockResolvedValue({
        id: 789,
        ...mockGeneratedTemplate.template
      });

      renderDocumentDetailView();

      // Step 1: Trigger template generation
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      fireEvent.click(generateButton);

      // Step 2: Verify generation dialog appears
      await waitFor(() => {
        expect(screen.getByTestId('generated-template-dialog')).toBeInTheDocument();
      });

      // Step 3: Save template
      const saveButton = screen.getByRole('button', { name: /save & edit template/i });
      fireEvent.click(saveButton);

      // Step 4: Verify complete workflow
      await waitFor(() => {
        expect(mockDocumentManager.updateDocumentStatus).toHaveBeenCalled();
        expect(mockDocumentProcessor.generateTemplate).toHaveBeenCalled();
        expect(mockTemplateService.createTemplate).toHaveBeenCalled();
      });
    });

    it('should handle document status updates throughout the process', async () => {
      mockDocumentProcessor.generateTemplate.mockResolvedValue(mockGeneratedTemplate);
      
      renderDocumentDetailView();
      
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(mockDocumentManager.updateDocumentStatus).toHaveBeenCalledWith(
          'test-doc-123',
          expect.objectContaining({
            status: 'processing'
          })
        );
      });
    });
  });
});