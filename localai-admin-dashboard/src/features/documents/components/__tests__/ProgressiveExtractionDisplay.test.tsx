import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressiveExtractionDisplay } from '../ProgressiveExtractionDisplay';

const mockProgressiveResult = {
  content: 'Test document content',
  metadata: { title: 'Test Document' },
  structure: { headings: [], tables: [], images: [] },
  template: {
    id: 1,
    name: 'Test Template',
    smart_variables: [
      {
        id: '1',
        name: 'company_name',
        type: 'text',
        description: 'Name of the company',
        extraction_hints: ['company', 'organization']
      },
      {
        id: '2', 
        name: 'amount',
        type: 'currency',
        description: 'Total amount',
        extraction_hints: ['total', 'amount', '$']
      }
    ]
  },
  fieldProgress: {
    company_name: {
      fieldName: 'company_name',
      status: 'completed' as const,
      progress: 100,
      result: {
        value: 'Acme Corp',
        confidence: 0.95,
        sourceText: 'Acme Corp Inc.'
      }
    },
    amount: {
      fieldName: 'amount', 
      status: 'extracting' as const,
      progress: 50
    }
  },
  isComplete: false
};

describe('ProgressiveExtractionDisplay', () => {
  it('renders field extraction progress correctly', () => {
    render(<ProgressiveExtractionDisplay progressiveResult={mockProgressiveResult} />);
    
    // Check main title
    expect(screen.getByText('Field Extraction Progress')).toBeInTheDocument();
    
    // Check field names
    expect(screen.getByText('company_name')).toBeInTheDocument();
    expect(screen.getByText('amount')).toBeInTheDocument();
    
    // Check field types
    expect(screen.getByText('text')).toBeInTheDocument();
    expect(screen.getByText('currency')).toBeInTheDocument();
    
    // Check completed field result
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
    
    // Check extracting field status
    expect(screen.getByText('Extracting...')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows complete badge when extraction is finished', () => {
    const completeResult = {
      ...mockProgressiveResult,
      isComplete: true
    };
    
    render(<ProgressiveExtractionDisplay progressiveResult={completeResult} />);
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('displays error states correctly', () => {
    const errorResult = {
      ...mockProgressiveResult,
      fieldProgress: {
        ...mockProgressiveResult.fieldProgress,
        company_name: {
          fieldName: 'company_name',
          status: 'failed' as const,
          progress: 0,
          error: 'Could not extract company name'
        }
      }
    };
    
    render(<ProgressiveExtractionDisplay progressiveResult={errorResult} />);
    
    expect(screen.getByText('Extraction Failed')).toBeInTheDocument();
    expect(screen.getByText('Could not extract company name')).toBeInTheDocument();
  });

  it('displays field descriptions', () => {
    render(<ProgressiveExtractionDisplay progressiveResult={mockProgressiveResult} />);
    
    expect(screen.getByText('Name of the company')).toBeInTheDocument();
    expect(screen.getByText('Total amount')).toBeInTheDocument();
  });
});