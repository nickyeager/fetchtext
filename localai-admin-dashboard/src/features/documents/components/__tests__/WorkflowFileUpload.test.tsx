import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkflowFileUpload } from '../WorkflowFileUpload';

describe('WorkflowFileUpload', () => {
  const mockOnFileUpload = vi.fn();
  
  const defaultProps = {
    file: null,
    isProcessing: false,
    onFileUpload: mockOnFileUpload
  };

  beforeEach(() => {
    mockOnFileUpload.mockClear();
  });

  it('renders upload input correctly', () => {
    render(<WorkflowFileUpload {...defaultProps} />);
    
    expect(screen.getByText('Upload Document')).toBeInTheDocument();
    expect(screen.getByLabelText('Upload document')).toBeInTheDocument();
  });

  it('displays selected file information', () => {
    const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    
    render(<WorkflowFileUpload {...defaultProps} file={mockFile} />);
    
    expect(screen.getByText(/Selected: test\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/\(0\.0 KB\)/)).toBeInTheDocument();
  });

  it('shows processing state correctly', () => {
    render(<WorkflowFileUpload {...defaultProps} isProcessing={true} />);
    
    expect(screen.getByText('Processing document...')).toBeInTheDocument();
    expect(screen.getByLabelText('Upload document')).toBeDisabled();
  });

  it('calls onFileUpload when file is selected', () => {
    render(<WorkflowFileUpload {...defaultProps} />);
    
    const fileInput = screen.getByLabelText('Upload document');
    const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    
    expect(mockOnFileUpload).toHaveBeenCalledTimes(1);
  });

  it('accepts correct file types', () => {
    render(<WorkflowFileUpload {...defaultProps} />);
    
    const fileInput = screen.getByLabelText('Upload document');
    expect(fileInput).toHaveAttribute('accept', '.pdf,.docx,.txt,.md,.pptx,.xlsx,.html,.csv');
  });
});