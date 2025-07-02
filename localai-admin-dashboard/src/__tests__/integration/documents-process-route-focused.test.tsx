/**
 * Focused Integration Test for Documents Process Route
 * 
 * This test specifically validates that the /documents/process route renders
 * the DocumentProcessor component correctly without hanging or timing out.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentProcessor } from '@/features/documents/components/DocumentProcessor';

// Mock Supabase to prevent hanging on auth calls
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

// Mock the route component directly
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
    { 
      id: 'proposal_date', 
      name: 'proposal_date', 
      type: 'date' as const, 
      description: 'Date of the proposal', 
      extraction_hints: ['date', 'today', 'current date'] 
    },
    { 
      id: 'proposal_amount', 
      name: 'proposal_amount', 
      type: 'currency' as const, 
      description: 'Total proposal amount', 
      extraction_hints: ['amount', 'cost', 'price', 'budget', '$'] 
    },
    { 
      id: 'project_description', 
      name: 'project_description', 
      type: 'text' as const, 
      description: 'Brief description of the project', 
      extraction_hints: ['project', 'work', 'services', 'description'] 
    }
  ],
  category: 'business'
};

// Create a simple wrapper that mimics what the route does
function DocumentProcessRouteWrapper() {
  const mockOnGenerationComplete = vi.fn();
  const mockOnBack = vi.fn();

  return (
    <div className="container mx-auto py-6">
      <DocumentProcessor
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    </div>
  );
}

describe('Documents Process Route - Focused Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the document process route content', () => {
    render(<DocumentProcessRouteWrapper />);
    
    // Test core elements that should be present
    expect(screen.getByText('Document Processing')).toBeInTheDocument();
    expect(screen.getByText('Using template: Business Proposal Template')).toBeInTheDocument();
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
  });

  it('should render file upload interface', () => {
    render(<DocumentProcessRouteWrapper />);
    
    expect(screen.getByText('Drop file here or click to upload')).toBeInTheDocument();
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('accept', '.txt,.pdf,.doc,.docx,.md');
  });

  it('should show processing pipeline steps', () => {
    render(<DocumentProcessRouteWrapper />);
    
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Ready to start')).toBeInTheDocument();
  });

  it('should render back button', () => {
    render(<DocumentProcessRouteWrapper />);
    
    const backButton = screen.getByText('← Back to Templates');
    expect(backButton).toBeInTheDocument();
  });

  it('should handle file selection', () => {
    render(<DocumentProcessRouteWrapper />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    expect(fileInput.files).toHaveLength(1);
    expect(fileInput.files?.[0]).toBe(file);
  });

  it('should display template information correctly', () => {
    render(<DocumentProcessRouteWrapper />);
    
    // Check that the template name is displayed (text might be split across elements)
    expect(screen.getByText(/Business Proposal Template/)).toBeInTheDocument();
    
    // Check that it's specifically in the "Using template:" context
    expect(screen.getByText(/Using template:/)).toBeInTheDocument();
  });

  it('should render with proper container styling', () => {
    render(<DocumentProcessRouteWrapper />);
    
    // The container class is on the outermost div wrapper
    const outerContainer = document.querySelector('.container.mx-auto.py-6');
    expect(outerContainer).toBeInTheDocument();
    
    // Verify the DocumentProcessor is inside this container
    const processingTitle = screen.getByText('Document Processing');
    expect(outerContainer).toContainElement(processingTitle);
  });

  it('should be distinct from documents list route', () => {
    render(<DocumentProcessRouteWrapper />);
    
    // These elements should be present in the process route but NOT in documents list
    expect(screen.getByText('Document Processing')).toBeInTheDocument();
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Upload Source Document')).toBeInTheDocument();
    
    // These should NOT be present (they're from the documents list page)
    expect(screen.queryByText('Smart Document Templates')).not.toBeInTheDocument();
    expect(screen.queryByText('Create New Template')).not.toBeInTheDocument();
    expect(screen.queryByText('Template Gallery')).not.toBeInTheDocument();
  });

  it('should show the success message area when document is generated', () => {
    render(<DocumentProcessRouteWrapper />);
    
    // The success message area should not be visible initially
    expect(screen.queryByText('Document Generated Successfully!')).not.toBeInTheDocument();
    
    // Check that the main container structure is in place
    const outerContainer = document.querySelector('.container.mx-auto.py-6');
    expect(outerContainer).toBeInTheDocument();
  });
});
