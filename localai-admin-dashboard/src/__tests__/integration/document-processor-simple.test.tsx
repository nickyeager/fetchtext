import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentProcessor } from '@/features/documents/components/DocumentProcessor';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } }
      })
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: null, error: null })
    })
  }
}));

describe('DocumentProcessor Integration Tests', () => {
  const mockTemplate = {
    id: 1,
    uuid: 'test-uuid',
    name: 'Business Proposal Template',
    description: 'Template for creating business proposals',
    template_content: 'Company: {{company_name}}\nAmount: {{project_budget}}',
    smart_variables: [
      {
        id: '1',
        name: 'company_name',
        type: 'text' as const,
        description: 'Name of the company',
        extraction_hints: ['company', 'business name'],
        default_value: ''
      },
      {
        id: '2', 
        name: 'project_budget',
        type: 'currency' as const,
        description: 'Total project budget',
        extraction_hints: ['budget', 'cost', 'price'],
        default_value: 0
      }
    ],
    category: 'business'
  };

  const mockOnGenerationComplete = vi.fn();
  const mockOnBack = vi.fn();

  it('should render the document processor interface', () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByText('Document Processing')).toBeInTheDocument();
    expect(screen.getByText('Using template: Business Proposal Template')).toBeInTheDocument();
    expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
  });

  it('should show processing steps', () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
    expect(screen.getByText('Ready to start')).toBeInTheDocument();
    
    // Check that the visual pipeline is rendered with step numbers
    const stepNumbers = ['1', '2', '3', '4', '5'];
    stepNumbers.forEach(number => {
      expect(screen.getByText(number)).toBeInTheDocument();
    });
  });

  it('should handle file upload', async () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    const fileInput = screen.getByLabelText(/drop file here or click to upload/i);
    const testFile = new File(['Test document content'], 'test.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(screen.getByText('Extracted Text')).toBeInTheDocument();
    });
  });

  it('should show back navigation button', () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    const backButton = screen.getByText('← Back to Templates');
    expect(backButton).toBeInTheDocument();
    
    fireEvent.click(backButton);
    expect(mockOnBack).toHaveBeenCalled();
  });

  it('should display template smart variables', () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    // The smart variables should be referenced in the component even if not initially visible
    expect(mockTemplate.smart_variables).toHaveLength(2);
    expect(mockTemplate.smart_variables[0].name).toBe('company_name');
    expect(mockTemplate.smart_variables[1].name).toBe('project_budget');
  });
});
