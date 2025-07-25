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
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null })
    }))
  }
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Document Processing Integration', () => {
  const mockTemplate = {
    id: 1,
    uuid: 'test-template-uuid',
    name: 'Business Email Template',
    description: 'Template for business emails',
    template_content: `Dear {{recipient_name}},

I hope this email finds you well. I am writing to discuss {{subject_matter}} with a budget of {{budget_amount}}.

The proposed timeline is {{timeline}} and we expect to deliver {{deliverables}}.

Please let me know if you have any questions.

Best regards,
{{sender_name}}`,
    smart_variables: [
      {
        id: 'recipient_name',
        name: 'recipient_name',
        type: 'text' as const,
        description: 'Name of the email recipient',
        extraction_hints: ['dear', 'to:', 'recipient']
      },
      {
        id: 'subject_matter',
        name: 'subject_matter',
        type: 'text' as const,
        description: 'Main topic of discussion',
        extraction_hints: ['subject', 'regarding', 'about']
      },
      {
        id: 'budget_amount',
        name: 'budget_amount',
        type: 'currency' as const,
        description: 'Budget amount',
        extraction_hints: ['budget', '$', 'cost', 'amount']
      },
      {
        id: 'timeline',
        name: 'timeline',
        type: 'text' as const,
        description: 'Project timeline',
        extraction_hints: ['timeline', 'deadline', 'duration']
      },
      {
        id: 'deliverables',
        name: 'deliverables',
        type: 'text' as const,
        description: 'Project deliverables',
        extraction_hints: ['deliverables', 'outcomes', 'results']
      },
      {
        id: 'sender_name',
        name: 'sender_name',
        type: 'text' as const,
        description: 'Name of sender',
        extraction_hints: ['from', 'regards', 'sincerely']
      }
    ],
    category: 'business'
  };

  const mockProps = {
    selectedTemplate: mockTemplate,
    onGenerationComplete: vi.fn(),
    onBack: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful N8N webhook response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: {
          recipient_name: 'John Smith',
          subject_matter: 'project proposal',
          budget_amount: '$10,000',
          timeline: '3 months',
          deliverables: 'website and mobile app',
          sender_name: 'Alice Johnson'
        }
      })
    });
  });

  it('should render initial file upload interface', () => {
    render(<DocumentProcessor {...mockProps} />);

    expect(screen.getByText('Document Processing')).toBeInTheDocument();
    expect(screen.getByText('Using template: Business Email Template')).toBeInTheDocument();
    expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
    expect(screen.getByText('Drop file here or click to upload')).toBeInTheDocument();
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();
  });

  it('should process file upload and extract text', async () => {
    render(<DocumentProcessor {...mockProps} />);

    // Create a mock file
    const mockFile = new File(['Dear John Smith, I want to discuss the project proposal with a budget of $10,000.'], 'test.txt', {
      type: 'text/plain'
    });

    // Get file input and simulate file upload
    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Wait for file processing
    await waitFor(() => {
      expect(screen.getByText('Extracted Text')).toBeInTheDocument();
    });

    // Verify extracted text is displayed
    expect(screen.getByText(/Dear John Smith, I want to discuss/)).toBeInTheDocument();
  });

  it('should handle AI extraction workflow', async () => {
    render(<DocumentProcessor {...mockProps} />);

    // Simulate file upload
    const mockFile = new File(['Dear John Smith, I want to discuss the project proposal with a budget of $10,000.'], 'test.txt', {
      type: 'text/plain'
    });

    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Wait for AI extraction to complete
    await waitFor(() => {
      expect(screen.getByText('AI Extracted Data')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify extracted data fields are displayed
    expect(screen.getByDisplayValue('John Smith')).toBeInTheDocument();
    expect(screen.getByDisplayValue('project proposal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('$10,000')).toBeInTheDocument();
  });

  it('should allow manual adjustment of extracted data', async () => {
    render(<DocumentProcessor {...mockProps} />);

    // Simulate file upload and processing
    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Wait for extraction
    await waitFor(() => {
      expect(screen.getByText('Review & Adjust')).toBeInTheDocument();
    });

    // Find and modify a field
    const recipientInput = screen.getByDisplayValue('John Smith');
    fireEvent.change(recipientInput, { target: { value: 'Jane Doe' } });

    expect(recipientInput).toHaveValue('Jane Doe');
  });

  it('should generate document with extracted data', async () => {
    render(<DocumentProcessor {...mockProps} />);

    // Go through the full flow
    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Wait for extraction and proceed to generation
    await waitFor(() => {
      expect(screen.getByText('Continue to Generation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Continue to Generation'));

    // Wait for generation interface
    await waitFor(() => {
      expect(screen.getByText('Generate Document')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Generate Document'));

    // Wait for document generation
    await waitFor(() => {
      expect(screen.getByText('Generated Document')).toBeInTheDocument();
    });

    // Verify generated content includes replaced variables
    expect(screen.getByText(/Dear John Smith/)).toBeInTheDocument();
    expect(screen.getByText(/discuss project proposal/)).toBeInTheDocument();
    expect(screen.getByText(/budget of \$10,000/)).toBeInTheDocument();
  });

  it('should handle N8N webhook failure gracefully', async () => {
    // Mock failed webhook call
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<DocumentProcessor {...mockProps} />);

    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Should still show extracted data (fallback to mock)
    await waitFor(() => {
      expect(screen.getByText('AI Extracted Data')).toBeInTheDocument();
    });

    // Should show sample data as fallback
    expect(screen.getByDisplayValue(/Sample recipient_name/)).toBeInTheDocument();
  });

  it('should validate file types correctly', async () => {
    render(<DocumentProcessor {...mockProps} />);

    // Test with supported file type
    const textFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    
    fireEvent.change(fileInput, { target: { files: [textFile] } });

    await waitFor(() => {
      expect(screen.getByText('Extracted Text')).toBeInTheDocument();
    });
  });

  it('should call onGenerationComplete when document is generated', async () => {
    render(<DocumentProcessor {...mockProps} />);

    // Go through full flow
    const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => fireEvent.click(screen.getByText('Continue to Generation')));
    await waitFor(() => fireEvent.click(screen.getByText('Generate Document')));

    // Wait for generation to complete
    await waitFor(() => {
      expect(mockProps.onGenerationComplete).toHaveBeenCalled();
    });
  });

  it('should handle different file types appropriately', async () => {
    render(<DocumentProcessor {...mockProps} />);

    // Test PDF file (non-text)
    const pdfFile = new File(['fake pdf content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(screen.getByText('Extracted Text')).toBeInTheDocument();
    });

    // Should show placeholder text for PDF
    expect(screen.getByText(/Extracted text from test.pdf/)).toBeInTheDocument();
  });

  it('should allow re-extraction of data', async () => {
    render(<DocumentProcessor {...mockProps} />);

    // Process file
    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByText('Re-extract')).toBeInTheDocument();
    });

    // Click re-extract button
    fireEvent.click(screen.getByText('Re-extract'));

    // Should call the extraction workflow again
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5678/webhook/document-processing',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });
  });
});
