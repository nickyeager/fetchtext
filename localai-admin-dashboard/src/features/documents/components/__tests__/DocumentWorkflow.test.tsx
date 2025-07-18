import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock dependencies
vi.mock('@/lib/document-processor-enhanced');
vi.mock('@/lib/workflow-client');
vi.mock('@/lib/template-service', () => ({
  TemplateService: {
    getTemplates: vi.fn(),
    getTemplate: vi.fn(),
  }
}));

interface ProcessedDocument {
  content: string;
  metadata: {
    title?: string;
    format: string;
    pages?: number;
  };
  structure: {
    headings: Array<{
      level: number;
      text: string;
      position: number;
    }>;
    tables: Array<{
      position: number;
      rows: number;
      columns: number;
    }>;
    images: Array<{
      position: number;
      alt?: string;
      dimensions?: {
        width: number;
        height: number;
      };
    }>;
  };
  templateSuggestions: Array<{
    templateId: string;
    templateName: string;
    confidence: number;
    matchReasons: string[];
  }>;
}

describe('DocumentWorkflow', () => {
  let mockFile: File;
  let mockProcessedDocument: ProcessedDocument;

  beforeEach(async () => {
    vi.resetModules();

    // Re-mock after reset to ensure it's applied for each test
    vi.doMock('@/lib/workflow-client', () => ({
      WorkflowClient: {
        executeWorkflow: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async
          return {
            workflowId: 'workflow-123',
            status: 'completed',
            result: { output: 'Generated content' }
          };
        }),
        getWorkflowTemplates: vi.fn().mockResolvedValue([]),
      }
    }));
    
    vi.clearAllMocks();
    
    mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    mockProcessedDocument = {
      content: 'Test document content',
      metadata: { title: 'Test Document', format: 'PDF', pages: 5 },
      structure: {
        headings: [
          { level: 1, text: 'Introduction', position: 0 },
          { level: 2, text: 'Overview', position: 100 },
        ],
        tables: [{ position: 150, rows: 3, columns: 2 }],
        images: [{ position: 250, alt: 'Chart 1', dimensions: { width: 800, height: 600 } }]
      },
      templateSuggestions: [
        {
          templateId: 'report-template',
          templateName: 'Report Template',
          confidence: 0.85,
          matchReasons: ['Contains structured headings', 'Has tables']
        }
      ]
    };
  });

  describe('End-to-End Workflow', () => {
    it('should upload, select a template, and execute a workflow successfully', async () => {
      // Dynamically import components after mocks are set
      const { DocumentWorkflow } = await import('../DocumentWorkflow');
      const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
      const { WorkflowClient } = await import('@/lib/workflow-client');

      const mockProcessor = vi.mocked(DocumentProcessorEnhanced);
      mockProcessor.prototype.processDocumentWithDocling = vi.fn()
        .mockResolvedValue(mockProcessedDocument);

      render(<DocumentWorkflow />);

      // Step 1: Upload a file
      const fileInput = screen.getByLabelText(/upload document/i);
      fireEvent.change(fileInput, { target: { files: [mockFile] } });
      await waitFor(() => {
        expect(screen.getByText('Template Suggestions')).toBeInTheDocument();
      });

      // Step 2: Select a template
      const selectButton = screen.getByLabelText('Select Report Template');
      fireEvent.click(selectButton);
      await waitFor(() => {
        expect(screen.getByText('Selected template: Report Template')).toBeInTheDocument();
      });

      // Step 3: Execute the workflow
      const executeButton = screen.getByRole('button', { name: /execute workflow/i });
      fireEvent.click(executeButton);

      // Step 4: Verify the workflow was called and the UI updated
      await waitFor(() => {
        expect(WorkflowClient.executeWorkflow).toHaveBeenCalled();
        expect(screen.getByText(/Workflow completed successfully!/)).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Document Upload and Processing', () => {
    it('should process an uploaded document and display its metadata', async () => {
      const { DocumentWorkflow } = await import('../DocumentWorkflow');
      const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
      const mockProcessor = vi.mocked(DocumentProcessorEnhanced);
      mockProcessor.prototype.processDocumentWithDocling = vi.fn()
        .mockResolvedValue(mockProcessedDocument);

      render(<DocumentWorkflow />);

      const fileInput = screen.getByLabelText(/upload document/i);
      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(screen.getByText('Test Document')).toBeInTheDocument();
        expect(screen.getByText('PDF')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
      });
      expect(mockProcessor.prototype.processDocumentWithDocling).toHaveBeenCalledWith(mockFile);
    });

    it('should show an error if document processing fails', async () => {
      const { DocumentWorkflow } = await import('../DocumentWorkflow');
      const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
      const mockProcessor = vi.mocked(DocumentProcessorEnhanced);
      mockProcessor.prototype.processDocumentWithDocling = vi.fn()
        .mockRejectedValue(new Error('Processing failed miserably'));

      render(<DocumentWorkflow />);

      const fileInput = screen.getByLabelText(/upload document/i);
      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(screen.getByText('Processing failed miserably')).toBeInTheDocument();
      });
    });
  });

  describe('Template Suggestions', () => {
    it('should display template suggestions with confidence scores', async () => {
      const { DocumentWorkflow } = await import('../DocumentWorkflow');
      const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
      const mockProcessor = vi.mocked(DocumentProcessorEnhanced);
      mockProcessor.prototype.processDocumentWithDocling = vi.fn()
        .mockResolvedValue(mockProcessedDocument);
      
      render(<DocumentWorkflow />);

      const fileInput = screen.getByLabelText(/upload document/i);
      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(screen.getByText('Report Template')).toBeInTheDocument();
        expect(screen.getByText('85%')).toBeInTheDocument();
        expect(screen.getByText('Contains structured headings, Has tables')).toBeInTheDocument();
      });
    });

    it('should allow a user to select a template', async () => {
      const { DocumentWorkflow } = await import('../DocumentWorkflow');
      const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
      const mockProcessor = vi.mocked(DocumentProcessorEnhanced);
      mockProcessor.prototype.processDocumentWithDocling = vi.fn()
        .mockResolvedValue(mockProcessedDocument);
      
      render(<DocumentWorkflow />);

      const fileInput = screen.getByLabelText(/upload document/i);
      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => expect(screen.getByText('Report Template')).toBeInTheDocument());

      const selectButton = screen.getByLabelText('Select Report Template');
      fireEvent.click(selectButton);

      await waitFor(() => {
        expect(screen.getByText('Selected')).toBeInTheDocument();
        expect(screen.getByText('Selected template: Report Template')).toBeInTheDocument();
      });
    });
  });

  describe('Document Structure Visualization', () => {
    it('should display the document structure hierarchy', async () => {
      const { DocumentWorkflow } = await import('../DocumentWorkflow');
      const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
      const mockProcessor = vi.mocked(DocumentProcessorEnhanced);
      mockProcessor.prototype.processDocumentWithDocling = vi.fn()
        .mockResolvedValue(mockProcessedDocument);

      render(<DocumentWorkflow />);

      const fileInput = screen.getByLabelText(/upload document/i);
      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(screen.getByText('Document Structure')).toBeInTheDocument();
        expect(screen.getByText('Introduction')).toBeInTheDocument();
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });
    });

    it('should allow toggling structure sections', async () => {
      const { DocumentWorkflow } = await import('../DocumentWorkflow');
      const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
      const mockProcessor = vi.mocked(DocumentProcessorEnhanced);
      mockProcessor.prototype.processDocumentWithDocling = vi.fn()
        .mockResolvedValue(mockProcessedDocument);
      
      render(<DocumentWorkflow />);

      const fileInput = screen.getByLabelText(/upload document/i);
      fireEvent.change(fileInput, { target: { files: [mockFile] } });
      
      await waitFor(() => expect(screen.getByText('Document Structure')).toBeInTheDocument());

      // Tables section is collapsed by default
      expect(screen.queryByText(/Table 1/)).not.toBeInTheDocument();

      // Click to expand the tables section
      const tablesButton = screen.getByRole('button', { name: /Tables/i });
      fireEvent.click(tablesButton);

      await waitFor(() => {
        expect(screen.getByText('Table 1: 3 rows, 2 columns')).toBeInTheDocument();
      });
    });
  });
  
  describe('Workflow Execution', () => {
    it('should show progress when executing a workflow', async () => {
      const { DocumentWorkflow } = await import('../DocumentWorkflow');
      const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
      
      const mockProcessor = vi.mocked(DocumentProcessorEnhanced);
      mockProcessor.prototype.processDocumentWithDocling = vi.fn()
        .mockResolvedValue(mockProcessedDocument);

      render(<DocumentWorkflow />);

      const fileInput = screen.getByLabelText(/upload document/i);
      fireEvent.change(fileInput, { target: { files: [mockFile] } });
      await waitFor(() => expect(screen.getByText('Report Template')).toBeInTheDocument());

      const selectButton = screen.getByLabelText('Select Report Template');
      fireEvent.click(selectButton);
      await waitFor(() => expect(screen.getByText('Selected')).toBeInTheDocument());

      const executeButton = screen.getByRole('button', { name: /execute workflow/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Executing workflow...')).toBeInTheDocument();
      });
    });

    it('should show an error if workflow execution fails', async () => {
      const { DocumentWorkflow } = await import('../DocumentWorkflow');
      const { DocumentProcessorEnhanced } = await import('@/lib/document-processor-enhanced');
      const { WorkflowClient } = await import('@/lib/workflow-client');
      
      vi.mocked(WorkflowClient.executeWorkflow).mockRejectedValue(new Error('Workflow failed spectacularly'));

      const mockProcessor = vi.mocked(DocumentProcessorEnhanced);
      mockProcessor.prototype.processDocumentWithDocling = vi.fn()
        .mockResolvedValue(mockProcessedDocument);

      render(<DocumentWorkflow />);

      const fileInput = screen.getByLabelText(/upload document/i);
      fireEvent.change(fileInput, { target: { files: [mockFile] } });
      await waitFor(() => expect(screen.getByText('Report Template')).toBeInTheDocument());

      const selectButton = screen.getByLabelText('Select Report Template');
      fireEvent.click(selectButton);
      await waitFor(() => expect(screen.getByText('Selected')).toBeInTheDocument());

      const executeButton = screen.getByRole('button', { name: /execute workflow/i });
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Workflow failed spectacularly')).toBeInTheDocument();
      });
    });
  });
});
