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

// Mock FileReader to work more reliably in tests
const mockFileReader = {
  result: '',
  error: null,
  readAsText: vi.fn(function(this: any) {
    // Simulate async file reading
    setTimeout(() => {
      this.result = 'Hello world, my name is John and I am 25 years old.';
      this.onload && this.onload();
    }, 0);
  }),
  onload: null,
  onerror: null,
  onabort: null,
};

global.FileReader = vi.fn(() => mockFileReader) as any;

// Mock fetch for N8N webhook to return mock data
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: vi.fn().mockResolvedValue({
    data: {
      name: 'John Doe',
      age: 25
    }
  })
});

const mockTemplate = {
  id: 1,
  uuid: 'test-uuid',
  name: 'Working Test Template',
  description: 'A working test template',
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

describe('DocumentProcessor Working Tests', () => {
  const mockOnBack = vi.fn();
  const mockOnGenerationComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete the full document processing workflow', async () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    // Initial state - should show upload interface
    expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
    expect(screen.getByText('Ready to start')).toBeInTheDocument();

    // Upload a file
    const file = new File(['Hello world, my name is John and I am 25 years old.'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for text extraction to complete
    await waitFor(() => {
      expect(screen.getByText('Extracted Text')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Verify extracted text is displayed
    expect(screen.getByText(/Hello world, my name is John and I am 25 years old/)).toBeInTheDocument();

    // Wait for AI extraction to complete
    await waitFor(() => {
      expect(screen.getByText('AI Extracted Data')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify extracted data fields are shown
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();

    // Continue to generation step
    const continueButton = screen.getByText('Continue to Generation');
    fireEvent.click(continueButton);

    // Wait for generation interface to appear
    await waitFor(() => {
      expect(screen.getByText('Generate Document')).toBeInTheDocument();
    }, { timeout: 1000 });

    // Generate the document
    const generateButton = screen.getByText('Generate Document');
    fireEvent.click(generateButton);

    // Wait for document generation to complete
    await waitFor(() => {
      expect(screen.getByText('Download')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Verify the generated document contains the replaced template
    expect(screen.getByText(/Hello John Doe, your age is 25/)).toBeInTheDocument();

    // Verify the callback was called
    expect(mockOnGenerationComplete).toHaveBeenCalledWith(
      expect.stringContaining('Hello John Doe, your age is 25')
    );
  });

  it('should handle back navigation', () => {
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

  it('should show processing states correctly', async () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    // Upload file
    const file = new File(['Hello world'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Should progress through different processing states
    await waitFor(() => {
      // Should no longer be at "Ready to start"
      expect(screen.queryByText('Ready to start')).not.toBeInTheDocument();
    }, { timeout: 1000 });

    // Should eventually show either extract or analyze step being processed
    await waitFor(() => {
      // Look for any step being completed (green checkmarks)
      const checkIcons = document.querySelectorAll('.lucide-circle-check-big');
      expect(checkIcons.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });
});
