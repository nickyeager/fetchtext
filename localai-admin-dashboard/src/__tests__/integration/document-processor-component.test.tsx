/**
 * Direct Component Test for DocumentProcessor
 * 
 * This test directly tests the DocumentProcessor component to verify
 * its rendering without router complexity.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DocumentProcessor } from '@/features/documents/components/DocumentProcessor';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
  },
}));

const mockTemplate = {
  id: 1,
  uuid: 'template-uuid-1',
  name: 'Business Proposal Template',
  description: 'A comprehensive template for business proposals',
  template_content: `# Business Proposal

**To:** {{client_name}}
**From:** {{company_name}}
**Date:** {{proposal_date}}
**Amount:** {{proposal_amount}}

## Executive Summary

We are pleased to present this proposal for {{project_description}}.`,
  smart_variables: [
    { 
      id: 'client_name', 
      name: 'client_name', 
      type: 'text' as const, 
      description: 'Name of the client or company', 
      extraction_hints: ['client', 'company name', 'to:', 'customer'] 
    },
    { 
      id: 'company_name', 
      name: 'company_name', 
      type: 'text' as const, 
      description: 'Your company name', 
      extraction_hints: ['from:', 'company', 'organization'] 
    },
  ],
  category: 'business'
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('DocumentProcessor Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render DocumentProcessor with expected elements', () => {
    const onGenerationComplete = vi.fn();
    const onBack = vi.fn();

    render(
      <TestWrapper>
        <DocumentProcessor
          selectedTemplate={mockTemplate}
          onGenerationComplete={onGenerationComplete}
          onBack={onBack}
        />
      </TestWrapper>
    );

    // Check if the main heading is rendered
    expect(screen.getByText('Document Processing')).toBeInTheDocument();
    
    // Check if template information is shown
    expect(screen.getByText('Using template: Business Proposal Template')).toBeInTheDocument();
    
    // Check if processing pipeline is shown
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();
    
    // Check if upload section is shown
    expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
    
    // Check if back button is present
    expect(screen.getByText('← Back to Templates')).toBeInTheDocument();
  });

  it('should render file upload interface', () => {
    const onGenerationComplete = vi.fn();
    const onBack = vi.fn();

    render(
      <TestWrapper>
        <DocumentProcessor
          selectedTemplate={mockTemplate}
          onGenerationComplete={onGenerationComplete}
          onBack={onBack}
        />
      </TestWrapper>
    );

    // Check for file upload elements
    expect(screen.getByText('Drop file here or click to upload')).toBeInTheDocument();
    
    const fileInput = document.getElementById('file-upload');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('type', 'file');
  });

  it('should display template information', () => {
    const onGenerationComplete = vi.fn();
    const onBack = vi.fn();

    render(
      <TestWrapper>
        <DocumentProcessor
          selectedTemplate={mockTemplate}
          onGenerationComplete={onGenerationComplete}
          onBack={onBack}
        />
      </TestWrapper>
    );

    // The template should be displayed (text may be split across elements)
    expect(screen.getByText(/Using template:/)).toBeInTheDocument();
    expect(screen.getByText(/Business Proposal Template/)).toBeInTheDocument();
    
    // File input should accept the correct file types
    const fileInput = document.getElementById('file-upload');
    expect(fileInput).toHaveAttribute('accept', '.txt,.pdf,.doc,.docx,.md');
  });
});
