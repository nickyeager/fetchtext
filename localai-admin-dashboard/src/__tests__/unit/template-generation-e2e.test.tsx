/**
 * End-to-End Template Generation Integration Tests
 * 
 * Tests the complete user workflow using real components:
 * 1. Document upload through gallery
 * 2. Navigation to document detail view
 * 3. Template generation trigger and process
 * 4. Template review and saving
 * 5. Template application and field extraction
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router, RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { routeTree } from '@/routeTree.gen';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        })),
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 1 }, error: null }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: {}, error: null }))
          }))
        }))
      }))
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ 
        data: { user: { id: 'test-user' } }, 
        error: null 
      }))
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: { path: 'test-path' }, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://test-url' } }))
      }))
    }
  }
}));

vi.mock('@/lib/document-processor-enhanced');
vi.mock('@/services/unified-document-service');

// Test data
const mockDocuments = [
  {
    id: 'doc-1',
    name: 'new-document-type.pdf',
    file_type: 'application/pdf',
    processing_status: 'uploaded',
    created_at: '2024-01-15T10:30:00Z',
    metadata: {
      file_size: 25600,
      upload_method: 'drag_drop'
    }
  }
];

const mockEvaluationWithNoTemplates = {
  type_evaluation: {
    primary_type: 'medical_form',
    confidence: 0.88,
    detected_categories: ['healthcare', 'form']
  },
  content_analysis: {
    field_analysis: {
      detected_fields: ['patient_name', 'date_of_birth', 'medical_record_number', 'diagnosis'],
      extraction_patterns: {
        patient_name: ['John Smith'],
        date_of_birth: ['1990-05-15'],
        medical_record_number: ['MR-789456'],
        diagnosis: ['Routine checkup']
      }
    }
  },
  template_suggestions: [], // No existing templates - should trigger generation
  processing_recommendations: {
    workflow: 'generate_template',
    suggested_action: 'Generate a new AI-powered template for medical form documents'
  }
};

const mockGeneratedMedicalTemplate = {
  template_id: 'gen-medical-123',
  template: {
    id: 123,
    name: 'Medical Form Template',
    description: 'AI-generated template for medical form documents',
    category: 'medical_form',
    template_content: '# Medical Form\n**Patient:** {patient_name}\n**DOB:** {date_of_birth}\n**Record #:** {medical_record_number}',
    smart_variables: [
      {
        id: 'patient_name',
        name: 'patient_name',
        type: 'text',
        description: 'Patient full name',
        required: true,
        extraction_hints: ['patient', 'name', 'patient name']
      },
      {
        id: 'date_of_birth',
        name: 'date_of_birth',
        type: 'date',
        description: 'Patient date of birth',
        required: true,
        extraction_hints: ['dob', 'date of birth', 'birth date']
      },
      {
        id: 'medical_record_number',
        name: 'medical_record_number',
        type: 'text',
        description: 'Medical record number',
        required: true,
        extraction_hints: ['medical record', 'MR', 'record number']
      }
    ],
    tags: ['ai-generated', 'medical', 'healthcare', 'form'],
    is_public: false
  },
  generation_metadata: {
    ai_confidence: 0.88,
    fields_detected: 3,
    generation_method: 'automatic',
    original_filename: 'new-document-type.pdf'
  },
  validation_results: {
    template_valid: true,
    validation_warnings: []
  },
  test_extraction: {
    extraction_successful: true,
    extracted_fields_count: 3,
    average_confidence: 0.85
  }
};

describe('Template Generation E2E Integration', () => {
  let queryClient: QueryClient;
  let router: Router<any>;
  let mockDocumentProcessor: any;
  let mockUnifiedDocumentService: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    const history = createMemoryHistory({ initialEntries: ['/documents'] });
    router = new Router({ routeTree, history });

    // Setup mocks
    mockDocumentProcessor = {
      generateTemplate: vi.fn().mockResolvedValue(mockGeneratedMedicalTemplate),
      processWithExistingTemplate: vi.fn(),
      isBackendAvailable: vi.fn().mockResolvedValue(true)
    };

    mockUnifiedDocumentService = {
      getAllDocuments: vi.fn().mockResolvedValue(mockDocuments),
      getDocumentWithEvaluation: vi.fn().mockResolvedValue({
        document: mockDocuments[0],
        evaluation: mockEvaluationWithNoTemplates
      }),
      uploadDocument: vi.fn(),
      evaluateDocument: vi.fn().mockResolvedValue(mockEvaluationWithNoTemplates)
    };

    vi.mocked(require('@/lib/document-processor-enhanced').DocumentProcessorEnhanced)
      .mockImplementation(() => mockDocumentProcessor);
    
    vi.mocked(require('@/services/unified-document-service').default)
      .mockReturnValue(mockUnifiedDocumentService);
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  const renderApp = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );
  };

  describe('Complete User Workflow', () => {
    it('should complete full workflow from document gallery to template generation', async () => {
      renderApp();

      // Step 1: Navigate to documents page
      await waitFor(() => {
        expect(screen.getByText('Documents')).toBeInTheDocument();
      });

      // Step 2: Find and click on the new document type
      await waitFor(() => {
        expect(screen.getByText('new-document-type.pdf')).toBeInTheDocument();
      });

      const documentLink = screen.getByText('new-document-type.pdf');
      fireEvent.click(documentLink);

      // Step 3: Wait for navigation to document detail view
      await waitFor(() => {
        expect(screen.getByText('Document Details')).toBeInTheDocument();
      });

      // Step 4: Verify no templates suggestion triggers generation workflow
      await waitFor(() => {
        expect(screen.getByText(/Generate a new AI-powered template/)).toBeInTheDocument();
      });

      // Step 5: Click generate template button
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      expect(generateButton).toBeInTheDocument();
      fireEvent.click(generateButton);

      // Step 6: Wait for template generation to complete
      await waitFor(() => {
        expect(mockDocumentProcessor.generateTemplate).toHaveBeenCalledWith(
          expect.any(File),
          'Medical Form Template',
          'medical_form'
        );
      });

      // Step 7: Verify generated template dialog appears
      await waitFor(() => {
        expect(screen.getByTestId('generated-template-dialog')).toBeInTheDocument();
        expect(screen.getByText('AI-Generated Template')).toBeInTheDocument();
      });

      // Step 8: Verify template content
      expect(screen.getByDisplayValue('Medical Form Template')).toBeInTheDocument();
      expect(screen.getByText('3 fields detected')).toBeInTheDocument();
      expect(screen.getByText('88% confidence')).toBeInTheDocument();
    });

    it('should allow user to customize generated template fields', async () => {
      renderApp();

      // Navigate to document and trigger generation
      await waitFor(() => {
        expect(screen.getByText('new-document-type.pdf')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('new-document-type.pdf'));

      await waitFor(() => {
        const generateButton = screen.getByRole('button', { name: /generate template/i });
        fireEvent.click(generateButton);
      });

      // Wait for dialog
      await waitFor(() => {
        expect(screen.getByTestId('generated-template-dialog')).toBeInTheDocument();
      });

      // Customize template name
      const nameInput = screen.getByDisplayValue('Medical Form Template');
      fireEvent.change(nameInput, { target: { value: 'Custom Medical Template' } });
      expect(screen.getByDisplayValue('Custom Medical Template')).toBeInTheDocument();

      // Customize field description
      const fieldDescriptions = screen.getAllByRole('textbox');
      const patientNameDescription = fieldDescriptions.find(input => 
        (input as HTMLInputElement).value === 'Patient full name'
      );
      expect(patientNameDescription).toBeInTheDocument();
      
      fireEvent.change(patientNameDescription!, { 
        target: { value: 'Full name of the patient' } 
      });
      expect(screen.getByDisplayValue('Full name of the patient')).toBeInTheDocument();

      // Add new field
      const addFieldButton = screen.getByRole('button', { name: /add field/i });
      fireEvent.click(addFieldButton);

      // Verify new field was added (would show 4 fields instead of 3)
      await waitFor(() => {
        const fieldElements = screen.getAllByTestId('template-field');
        expect(fieldElements.length).toBeGreaterThan(3);
      });
    });

    it('should save template and navigate to editor', async () => {
      const mockNavigate = vi.fn();
      
      // Mock template service
      const mockTemplateService = {
        createTemplate: vi.fn().mockResolvedValue({ 
          id: 456,
          ...mockGeneratedMedicalTemplate.template 
        })
      };
      
      vi.mock('@/services/template-service', () => ({
        templateService: mockTemplateService
      }));

      renderApp();

      // Navigate and generate
      await waitFor(() => {
        fireEvent.click(screen.getByText('new-document-type.pdf'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /generate template/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('generated-template-dialog')).toBeInTheDocument();
      });

      // Click save button
      const saveButton = screen.getByRole('button', { name: /save & edit template/i });
      fireEvent.click(saveButton);

      // Verify template service was called
      await waitFor(() => {
        expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Medical Form Template',
            category: 'medical_form',
            smart_variables: expect.arrayContaining([
              expect.objectContaining({ name: 'patient_name' })
            ])
          })
        );
      });
    });

    it('should handle template generation errors gracefully', async () => {
      // Mock generation to fail
      mockDocumentProcessor.generateTemplate.mockRejectedValueOnce(
        new Error('AI service temporarily unavailable')
      );

      renderApp();

      await waitFor(() => {
        fireEvent.click(screen.getByText('new-document-type.pdf'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /generate template/i }));
      });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/AI service temporarily unavailable/)).toBeInTheDocument();
      });

      // Should not show the template dialog
      expect(screen.queryByTestId('generated-template-dialog')).not.toBeInTheDocument();
    });
  });

  describe('Template Generation Decision Logic', () => {
    it('should not trigger generation when existing templates are available', async () => {
      const evaluationWithTemplates = {
        ...mockEvaluationWithNoTemplates,
        template_suggestions: [
          {
            template_id: 789,
            template_name: 'Existing Medical Form Template',
            confidence: 0.92
          }
        ],
        processing_recommendations: {
          workflow: 'existing_template',
          suggested_action: 'Use the "Existing Medical Form Template" template for best results'
        }
      };

      mockUnifiedDocumentService.getDocumentWithEvaluation.mockResolvedValueOnce({
        document: mockDocuments[0],
        evaluation: evaluationWithTemplates
      });

      renderApp();

      await waitFor(() => {
        fireEvent.click(screen.getByText('new-document-type.pdf'));
      });

      // Should show existing template recommendation instead
      await waitFor(() => {
        expect(screen.getByText(/Use the "Existing Medical Form Template"/)).toBeInTheDocument();
      });

      // Should not automatically trigger generation
      expect(screen.queryByText(/Generate a new AI-powered template/)).not.toBeInTheDocument();
    });

    it('should trigger generation for truly new document types', async () => {
      const newDocumentType = {
        ...mockDocuments[0],
        name: 'unique-scientific-report.pdf'
      };

      const uniqueEvaluation = {
        type_evaluation: {
          primary_type: 'scientific_research',
          confidence: 0.95,
          detected_categories: ['research', 'scientific']
        },
        template_suggestions: [],
        processing_recommendations: {
          workflow: 'generate_template',
          suggested_action: 'Generate a new AI-powered template for scientific research documents'
        }
      };

      mockUnifiedDocumentService.getDocumentWithEvaluation.mockResolvedValueOnce({
        document: newDocumentType,
        evaluation: uniqueEvaluation
      });

      renderApp();

      await waitFor(() => {
        fireEvent.click(screen.getByText('new-document-type.pdf'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Generate a new AI-powered template for scientific research/)).toBeInTheDocument();
      });

      // Generation should be the primary recommended action
      const generateButton = screen.getByRole('button', { name: /generate template/i });
      expect(generateButton).toBeInTheDocument();
      expect(generateButton).not.toBeDisabled();
    });
  });

  describe('Template Quality and Validation', () => {
    it('should display template quality metrics to user', async () => {
      renderApp();

      await waitFor(() => {
        fireEvent.click(screen.getByText('new-document-type.pdf'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /generate template/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('generated-template-dialog')).toBeInTheDocument();
      });

      // Check quality indicators
      expect(screen.getByText('3 fields detected')).toBeInTheDocument();
      expect(screen.getByText('88% confidence')).toBeInTheDocument();
      expect(screen.getByText('Extraction: Successful')).toBeInTheDocument();
      expect(screen.getByText('Extracted 3 out of 3 fields')).toBeInTheDocument();
    });

    it('should show validation warnings if present', async () => {
      const templateWithWarnings = {
        ...mockGeneratedMedicalTemplate,
        validation_results: {
          template_valid: true,
          validation_warnings: [
            'Field "patient_name" may need additional validation',
            'Consider adding more extraction hints for better accuracy'
          ]
        }
      };

      mockDocumentProcessor.generateTemplate.mockResolvedValueOnce(templateWithWarnings);

      renderApp();

      await waitFor(() => {
        fireEvent.click(screen.getByText('new-document-type.pdf'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /generate template/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('Field "patient_name" may need additional validation')).toBeInTheDocument();
        expect(screen.getByText('Consider adding more extraction hints')).toBeInTheDocument();
      });
    });

    it('should allow template usage without saving', async () => {
      renderApp();

      await waitFor(() => {
        fireEvent.click(screen.getByText('new-document-type.pdf'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /generate template/i }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('generated-template-dialog')).toBeInTheDocument();
      });

      // Click "Use Without Saving"
      const useButton = screen.getByRole('button', { name: /use without saving/i });
      fireEvent.click(useButton);

      // Should close dialog and process document
      await waitFor(() => {
        expect(screen.queryByTestId('generated-template-dialog')).not.toBeInTheDocument();
      });

      // Should show document processing completed
      await waitFor(() => {
        expect(screen.getByText(/processing completed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Loading States', () => {
    it('should show loading states during template generation', async () => {
      // Mock slow generation
      mockDocumentProcessor.generateTemplate.mockImplementationOnce(
        () => new Promise(resolve => 
          setTimeout(() => resolve(mockGeneratedMedicalTemplate), 2000)
        )
      );

      renderApp();

      await waitFor(() => {
        fireEvent.click(screen.getByText('new-document-type.pdf'));
      });

      const generateButton = screen.getByRole('button', { name: /generate template/i });
      fireEvent.click(generateButton);

      // Should show loading indicator
      await waitFor(() => {
        expect(screen.getByText(/generating template/i)).toBeInTheDocument();
        expect(generateButton).toBeDisabled();
      });

      // Eventually should show results
      await waitFor(() => {
        expect(screen.getByTestId('generated-template-dialog')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should handle concurrent template generations', async () => {
      // Test that multiple rapid clicks don't cause issues
      renderApp();

      await waitFor(() => {
        fireEvent.click(screen.getByText('new-document-type.pdf'));
      });

      const generateButton = screen.getByRole('button', { name: /generate template/i });
      
      // Rapid clicks
      fireEvent.click(generateButton);
      fireEvent.click(generateButton);
      fireEvent.click(generateButton);

      // Should only call generate once
      await waitFor(() => {
        expect(mockDocumentProcessor.generateTemplate).toHaveBeenCalledTimes(1);
      });
    });
  });
});