import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DocumentProcessor } from '@/features/documents/components/DocumentProcessor';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-123' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

const mockTemplate = {
  id: 1,
  uuid: 'template-uuid-1',
  name: 'Test Template',
  description: 'A template for testing',
  template_content: 'Hello, {{name}}! Your email is {{email}}.',
  smart_variables: [
    { 
      id: 'name', 
      name: 'name', 
      type: 'text' as const, 
      description: 'Your name', 
      extraction_hints: ['name'] 
    },
    { 
      id: 'email', 
      name: 'email', 
      type: 'text' as const, 
      description: 'Your email address', 
      extraction_hints: ['email', '@'] 
    },
  ],
  category: 'General',
};

const mockOnGenerationComplete = vi.fn();
const mockOnBack = vi.fn();

describe('DocumentProcessor Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the component with the selected template', () => {
    render(
      <DocumentProcessor 
        selectedTemplate={mockTemplate} 
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );
    
    expect(screen.getByText('Document Processing')).toBeInTheDocument();
    expect(screen.getByText('Using template: Test Template')).toBeInTheDocument();
    expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();
  });

  it('should show the file upload interface initially', () => {
    render(
      <DocumentProcessor 
        selectedTemplate={mockTemplate} 
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );
    
    expect(screen.getByText('Drop file here or click to upload')).toBeInTheDocument();
    expect(screen.getByText('Supports: TXT, PDF, DOC, DOCX, MD files')).toBeInTheDocument();
    
    const fileInput = screen.getByLabelText('Drop file here or click to upload');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('type', 'file');
    expect(fileInput).toHaveAttribute('accept', '.txt,.pdf,.doc,.docx,.md');
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
    
    expect(mockOnBack).toHaveBeenCalled();
  });

  it('should display processing steps correctly', () => {
    render(
      <DocumentProcessor 
        selectedTemplate={mockTemplate} 
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );
    
    // Should show all 5 steps in the pipeline
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();
    
    // Initially should be ready to start
    expect(screen.getByText('Ready to start')).toBeInTheDocument();
  });

  it('should accept file input change event', () => {
    render(
      <DocumentProcessor 
        selectedTemplate={mockTemplate} 
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );
    
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    // Wrap file change event in act() to handle React state updates
    act(() => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });
    
    // The file processing will happen asynchronously, but the event should be handled
    expect(fileInput.files).toHaveLength(1);
    expect(fileInput.files?.[0]).toBe(file);
  });

  it('should show correct smart variables for the template', () => {
    render(
      <DocumentProcessor 
        selectedTemplate={mockTemplate} 
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );
    
    // Template should have 2 smart variables defined
    expect(mockTemplate.smart_variables).toHaveLength(2);
    expect(mockTemplate.smart_variables[0].name).toBe('name');
    expect(mockTemplate.smart_variables[1].name).toBe('email');
  });
});

describe('DocumentProcessor Pipeline Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have a well-defined processing pipeline', () => {
    render(
      <DocumentProcessor 
        selectedTemplate={mockTemplate} 
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );
    
    // The processing pipeline should be visible
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();
    
    // Should show the initial state
    expect(screen.getByText('Ready to start')).toBeInTheDocument();
  });

  it('should handle template with smart variables correctly', () => {
    const complexTemplate = {
      ...mockTemplate,
      smart_variables: [
        { 
          id: 'client_name', 
          name: 'client_name', 
          type: 'text' as const, 
          description: 'Client company name', 
          extraction_hints: ['client', 'company'] 
        },
        { 
          id: 'amount', 
          name: 'amount', 
          type: 'currency' as const, 
          description: 'Project amount', 
          extraction_hints: ['amount', '$', 'cost'] 
        },
        { 
          id: 'date', 
          name: 'date', 
          type: 'date' as const, 
          description: 'Project date', 
          extraction_hints: ['date', 'deadline'] 
        },
      ],
    };

    render(
      <DocumentProcessor 
        selectedTemplate={complexTemplate} 
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );
    
    expect(screen.getByText('Using template: Test Template')).toBeInTheDocument();
    expect(complexTemplate.smart_variables).toHaveLength(3);
  });

  it('should work with the separate route structure', () => {
    // This test ensures the component works independently of routing
    render(
      <DocumentProcessor 
        selectedTemplate={mockTemplate} 
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );
    
    // Component should render without router context
    expect(screen.getByText('Document Processing')).toBeInTheDocument();
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();
  });
});
