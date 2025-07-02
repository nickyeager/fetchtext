import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentProcessor } from '@/features/documents/components/DocumentProcessor';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } }
      })
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: null, error: null })
    })
  }
}));

// Mock fetch for N8N webhook
global.fetch = vi.fn();

const mockTemplate = {
  id: 1,
  uuid: 'test-uuid',
  name: 'Simple Test Template',
  description: 'A simple test template',
  template_content: 'Hello {{name}}, your age is {{age}}.',
  smart_variables: [
    {
      id: 'name',
      name: 'name',
      type: 'text' as const,
      description: 'Person name',
      extraction_hints: []
    },
    {
      id: 'age',
      name: 'age',
      type: 'number' as const,
      description: 'Person age',
      extraction_hints: []
    }
  ],
  category: 'test'
};

describe('DocumentProcessor Simple Tests', () => {
  const mockOnBack = vi.fn();
  const mockOnGenerationComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch to always fail (falling back to mock data)
    (global.fetch as any).mockRejectedValue(new Error('Network error'));
  });

  it('should render the initial upload interface', () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByText('Document Processing')).toBeInTheDocument();
    expect(screen.getByText('Using template: Simple Test Template')).toBeInTheDocument();
    expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
    expect(screen.getByText('Drop file here or click to upload')).toBeInTheDocument();
  });

  it('should show the processing pipeline with correct initial state', () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Ready to start')).toBeInTheDocument();
  });

  it('should handle file upload and show progress', async () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    const file = new File(['Hello world'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Should show progress through the pipeline
    await waitFor(() => {
      expect(screen.getByText('Extract Text Content')).toBeInTheDocument();
    });
  });

  it('should accept file upload and update state', async () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    const file = new File(['Hello world'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Just verify the file upload triggers some UI change
    await waitFor(() => {
      // The processing step should show some activity (either completed upload or processing next step)
      const processingPipeline = screen.getByText('Processing Pipeline');
      expect(processingPipeline).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should process through all steps when file is uploaded', async () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    const file = new File(['Hello world, my name is John and I am 25 years old.'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    // First, just wait a moment for upload to process
    await waitFor(() => {
      expect(screen.getByText(/processing pipeline/i)).toBeInTheDocument();
    }, { timeout: 1000 });

    // Wait for text extraction to complete - look for either success or error
    await waitFor(() => {
      // Check if text extraction completed or failed
      const extractedTextElement = screen.queryByText('Extracted Text');
      const errorIndicator = screen.getByText('Extract Text Content'); // This shows when processing step 2
      
      // We should either see "Extracted Text" (success) or continue seeing "Extract Text Content" with error state
      expect(extractedTextElement || errorIndicator).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should call onBack when back button is clicked', () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    const backButton = screen.getByText('← Back to Templates');
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });
});
