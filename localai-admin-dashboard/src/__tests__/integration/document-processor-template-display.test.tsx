import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('DocumentProcessor Template Display Tests', () => {
  const mockTemplate = {
    id: 1,
    uuid: 'test-uuid',
    name: 'Business Proposal Template',
    description: 'Template for creating professional business proposals with AI extraction',
    template_content: `# Business Proposal

**Client:** {{company_name}}
**Project:** {{project_title}}
**Budget:** {{project_budget}}
**Timeline:** {{project_timeline}}
**Contact:** {{contact_person}}

## Project Overview
This proposal outlines the scope of work for {{project_title}} with an estimated budget of {{project_budget}}.`,
    smart_variables: [
      {
        id: '1',
        name: 'company_name',
        type: 'text' as const,
        description: 'Name of the client company',
        extraction_hints: ['company', 'business name', 'organization', 'corp', 'inc'],
        default_value: ''
      },
      {
        id: '2',
        name: 'project_title',
        type: 'text' as const,
        description: 'Title or name of the project',
        extraction_hints: ['project', 'title', 'name', 'subject'],
        default_value: ''
      },
      {
        id: '3',
        name: 'project_budget',
        type: 'currency' as const,
        description: 'Total budget for the project',
        extraction_hints: ['budget', 'cost', 'price', 'amount', 'fee', '$'],
        default_value: 0
      }
    ],
    category: 'business'
  };

  const mockOnGenerationComplete = vi.fn();
  const mockOnBack = vi.fn();

  it('should display template information immediately on load', () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    // Check template header
    expect(screen.getByText('Template: Business Proposal Template')).toBeInTheDocument();
    expect(screen.getByText('Template for creating professional business proposals with AI extraction')).toBeInTheDocument();

    // Check field count
    expect(screen.getByText('Data to Extract (3 fields):')).toBeInTheDocument();

    // Check specific template variables are displayed
    expect(screen.getByText('company_name')).toBeInTheDocument();
    expect(screen.getByText('project_title')).toBeInTheDocument();
    expect(screen.getByText('project_budget')).toBeInTheDocument();

    // Check variable descriptions
    expect(screen.getByText('Name of the client company')).toBeInTheDocument();
    expect(screen.getByText('Title or name of the project')).toBeInTheDocument();
    expect(screen.getByText('Total budget for the project')).toBeInTheDocument();

    // Check variable types (multiple text fields expected)
    expect(screen.getAllByText('text')).toHaveLength(2);
    expect(screen.getByText('currency')).toBeInTheDocument();

    // Check extraction hints
    expect(screen.getByText(/Hints: company, business name, organization/)).toBeInTheDocument();
    expect(screen.getByText(/Hints: project, title, name, subject/)).toBeInTheDocument();
    expect(screen.getByText(/Hints: budget, cost, price, amount/)).toBeInTheDocument();

    // Check template preview
    expect(screen.getByText('Template Preview:')).toBeInTheDocument();
    expect(screen.getByText(/# Business Proposal/)).toBeInTheDocument();
  });

  it('should show template-specific content without file upload', () => {
    render(
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    // Template info should be visible immediately
    expect(screen.getByText('Template: Business Proposal Template')).toBeInTheDocument();
    
    // Upload section should also be visible
    expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
    
    // But template-specific fields should be prominently displayed
    expect(screen.getByText('company_name')).toBeInTheDocument();
    expect(screen.getByText('project_title')).toBeInTheDocument();
    expect(screen.getByText('project_budget')).toBeInTheDocument();
  });
}); 