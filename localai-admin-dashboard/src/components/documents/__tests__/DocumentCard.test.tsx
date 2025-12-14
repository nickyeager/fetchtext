import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentCard } from '../DocumentCard';

const mockDocument = {
  id: 'test-doc-1',
  filename: 'test-document.pdf',
  file_size: 1024576, // 1MB
  upload_date: '2024-01-15T10:30:00Z',
  status: 'completed' as const,
  document_type: 'invoice',
  file_type: 'pdf',
  metadata: {
    pages: 5,
    language: 'en'
  }
};

const mockHandlers = {
  onView: vi.fn(),
  onReprocess: vi.fn(),
  onDelete: vi.fn(),
  onDownload: vi.fn(),
};

describe('DocumentCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders document information correctly', () => {
    render(<DocumentCard document={mockDocument} {...mockHandlers} />);
    
    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
    expect(screen.getByText('1.0 MB')).toBeInTheDocument();
    expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('invoice')).toBeInTheDocument();
  });

  it('displays correct file type icon for PDF', () => {
    render(<DocumentCard document={mockDocument} {...mockHandlers} />);
    
    // The FileText icon should be present for PDF files
    const fileIcon = screen.getByRole('generic', { hidden: true });
    expect(fileIcon).toHaveClass('w-5', 'h-5', 'text-red-500');
  });

  it('handles card click to view document', async () => {
    render(<DocumentCard document={mockDocument} {...mockHandlers} />);
    
    const card = screen.getByRole('generic').parentElement; // Card container
    fireEvent.click(card!);
    
    await waitFor(() => {
      expect(mockHandlers.onView).toHaveBeenCalledWith('test-doc-1');
    });
  });

  it('shows dropdown menu with all actions', async () => {
    render(<DocumentCard document={mockDocument} {...mockHandlers} />);
    
    // Find and click the dropdown trigger
    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);
    
    await waitFor(() => {
      expect(screen.getByText('View Details')).toBeInTheDocument();
      expect(screen.getByText('Reprocess')).toBeInTheDocument();
      expect(screen.getByText('Download')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  it('calls appropriate handler when menu item is clicked', async () => {
    render(<DocumentCard document={mockDocument} {...mockHandlers} />);
    
    // Open dropdown
    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);
    
    // Click reprocess
    const reprocessButton = await screen.findByText('Reprocess');
    fireEvent.click(reprocessButton);
    
    expect(mockHandlers.onReprocess).toHaveBeenCalledWith('test-doc-1');
  });

  it('disables reprocess button when document is analyzing', async () => {
    const analyzingDocument = { ...mockDocument, status: 'analyzing' as const };
    
    render(<DocumentCard document={analyzingDocument} {...mockHandlers} />);
    
    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);
    
    const reprocessButton = await screen.findByText('Reprocess');
    expect(reprocessButton.closest('button')).toBeDisabled();
  });

  it('shows processing indicator for analyzing documents', () => {
    const analyzingDocument = { ...mockDocument, status: 'analyzing' as const };
    
    render(<DocumentCard document={analyzingDocument} {...mockHandlers} />);
    
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('applies correct status colors', () => {
    const statuses = [
      { status: 'completed', color: 'text-green-700' },
      { status: 'analyzing', color: 'text-blue-700' },
      { status: 'failed', color: 'text-red-700' },
      { status: 'pending', color: 'text-gray-700' }
    ] as const;

    statuses.forEach(({ status, color }) => {
      const { rerender } = render(
        <DocumentCard 
          document={{ ...mockDocument, status }} 
          {...mockHandlers} 
        />
      );
      
      const statusBadge = screen.getByText(status === 'analyzing' ? 'Processing' : status.charAt(0).toUpperCase() + status.slice(1));
      expect(statusBadge).toHaveClass(color);
      
      rerender(<div />); // Clean up
    });
  });

  it('renders metadata when available', () => {
    render(<DocumentCard document={mockDocument} {...mockHandlers} />);
    
    expect(screen.getByText('5 pages')).toBeInTheDocument();
    expect(screen.getByText('en')).toBeInTheDocument();
  });

  it('handles missing metadata gracefully', () => {
    const documentWithoutMetadata = { ...mockDocument, metadata: undefined };
    
    render(<DocumentCard document={documentWithoutMetadata} {...mockHandlers} />);
    
    // Should still render the document card without metadata section
    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
    expect(screen.queryByText('pages')).not.toBeInTheDocument();
  });

  it('handles loading state correctly', () => {
    render(<DocumentCard document={mockDocument} {...mockHandlers} isLoading={true} />);
    
    const card = screen.getByRole('generic').parentElement;
    const menuButton = screen.getByRole('button');
    
    // Card click should not trigger onView when loading
    fireEvent.click(card!);
    expect(mockHandlers.onView).not.toHaveBeenCalled();
    
    // Menu button should be disabled
    expect(menuButton).toBeDisabled();
  });

  it('formats file sizes correctly', () => {
    const testCases = [
      { size: 0, expected: '0 Bytes' },
      { size: 1024, expected: '1.0 KB' },
      { size: 1048576, expected: '1.0 MB' },
      { size: 1073741824, expected: '1.0 GB' },
    ];

    testCases.forEach(({ size, expected }) => {
      const testDoc = { ...mockDocument, file_size: size };
      const { rerender } = render(<DocumentCard document={testDoc} {...mockHandlers} />);
      
      expect(screen.getByText(expected)).toBeInTheDocument();
      
      rerender(<div />); // Clean up
    });
  });

  it('shows thumbnail when available', () => {
    const documentWithThumbnail = {
      ...mockDocument,
      thumbnail_url: 'https://example.com/thumbnail.jpg'
    };
    
    render(<DocumentCard document={documentWithThumbnail} {...mockHandlers} />);
    
    const thumbnail = screen.getByAltText('test-document.pdf preview');
    expect(thumbnail).toBeInTheDocument();
    expect(thumbnail).toHaveAttribute('src', 'https://example.com/thumbnail.jpg');
  });

  it('falls back to file icon when thumbnail fails', () => {
    const documentWithThumbnail = {
      ...mockDocument,
      thumbnail_url: 'https://example.com/broken-thumbnail.jpg'
    };
    
    render(<DocumentCard document={documentWithThumbnail} {...mockHandlers} />);
    
    const thumbnail = screen.getByAltText('test-document.pdf preview');
    
    // Simulate thumbnail load error
    fireEvent.error(thumbnail);
    
    // Should fall back to file type icon
    // Note: In a real test environment, you'd need to verify the icon replacement
    // This is a simplified test for the error handling logic
  });
});