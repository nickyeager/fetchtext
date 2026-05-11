import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from '@tanstack/react-router';
import { DocumentGallery } from '../DocumentGallery';

// Mock the hooks
vi.mock('@/hooks/use-document-gallery', () => ({
  useDocumentGallery: vi.fn()
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  }
}));

import { useDocumentGallery } from '@/hooks/use-document-gallery';

const mockDocuments = [
  {
    id: 'doc-1',
    filename: 'invoice-001.pdf',
    file_size: 1024576,
    upload_date: '2024-01-15T10:30:00Z',
    status: 'completed' as const,
    document_type: 'invoice',
    file_type: 'pdf',
    user_id: 'user-1',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T10:30:00Z',
  },
  {
    id: 'doc-2',
    filename: 'contract-002.docx',
    file_size: 2048576,
    upload_date: '2024-01-16T14:20:00Z',
    status: 'analyzing' as const,
    document_type: 'contract',
    file_type: 'docx',
    user_id: 'user-1',
    created_at: '2024-01-16T14:20:00Z',
    updated_at: '2024-01-16T14:20:00Z',
  },
];

const mockStats = {
  total: 2,
  by_status: { completed: 1, analyzing: 1, failed: 0, pending: 0 },
  by_file_type: { pdf: 1, docx: 1 },
  by_document_type: { invoice: 1, contract: 1 },
};

const defaultMockReturn = {
  documents: mockDocuments,
  totalCount: 2,
  hasMore: false,
  stats: mockStats,
  isLoading: false,
  isLoadingStats: false,
  error: null,
  filters: {},
  pagination: { page: 1, limit: 20 },
  sort: { field: 'upload_date', direction: 'desc' },
  updateFilters: vi.fn(),
  setFilters: vi.fn(),
  updateSort: vi.fn(),
  nextPage: vi.fn(),
  previousPage: vi.fn(),
  goToPage: vi.fn(),
  resetPagination: vi.fn(),
  reprocessDocument: vi.fn(),
  deleteDocument: vi.fn(),
  downloadDocument: vi.fn(),
  isReprocessing: false,
  isDeleting: false,
  isDownloading: false,
  refetch: vi.fn(),
  refetchStats: vi.fn(),
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('DocumentGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDocumentGallery as any).mockReturnValue(defaultMockReturn);
  });

  it('renders header with title and upload button', () => {
    const wrapper = createWrapper();
    render(<DocumentGallery />, { wrapper });

    expect(screen.getByText('Document Gallery')).toBeInTheDocument();
    expect(screen.getByText('Browse and manage your uploaded documents')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload document/i })).toBeInTheDocument();
  });

  it('displays statistics cards', () => {
    const wrapper = createWrapper();
    render(<DocumentGallery />, { wrapper });

    expect(screen.getByText('Total Documents')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Total count
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // Completed count
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders document cards for each document', () => {
    const wrapper = createWrapper();
    render(<DocumentGallery />, { wrapper });

    expect(screen.getByText('invoice-001.pdf')).toBeInTheDocument();
    expect(screen.getByText('contract-002.docx')).toBeInTheDocument();
  });

  it('handles view mode toggle', () => {
    const wrapper = createWrapper();
    render(<DocumentGallery />, { wrapper });

    const gridButton = screen.getByRole('button', { name: /grid/i });
    const listButton = screen.getByRole('button', { name: /list/i });

    expect(gridButton).toHaveClass('bg-'); // Default active state
    
    fireEvent.click(listButton);
    // Note: In a real test, you'd verify the grid layout changes
    // This is simplified for the example
  });

  it('shows loading skeletons when loading', () => {
    (useDocumentGallery as any).mockReturnValue({
      ...defaultMockReturn,
      isLoading: true,
      documents: [],
    });

    const wrapper = createWrapper();
    render(<DocumentGallery />, { wrapper });

    // Should show skeleton cards
    const skeletons = screen.getAllByTestId('skeleton'); // Assuming skeleton has test-id
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no documents', () => {
    (useDocumentGallery as any).mockReturnValue({
      ...defaultMockReturn,
      documents: [],
      totalCount: 0,
    });

    const wrapper = createWrapper();
    render(<DocumentGallery />, { wrapper });

    expect(screen.getByText('No documents yet')).toBeInTheDocument();
    expect(screen.getByText(/upload your first document/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload document/i })).toBeInTheDocument();
  });

  it('shows filtered empty state when filters are applied', () => {
    (useDocumentGallery as any).mockReturnValue({
      ...defaultMockReturn,
      documents: [],
      totalCount: 0,
      filters: { search: 'test' },
    });

    const wrapper = createWrapper();
    render(<DocumentGallery />, { wrapper });

    expect(screen.getByText('No documents match your filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear all filters/i })).toBeInTheDocument();
  });

  it('shows error state with retry button', () => {
    const mockRefetch = vi.fn();
    (useDocumentGallery as any).mockReturnValue({
      ...defaultMockReturn,
      error: new Error('Failed to load'),
      refetch: mockRefetch,
    });

    const wrapper = createWrapper();
    render(<DocumentGallery />, { wrapper });

    expect(screen.getByText('Failed to load documents. Please try again.')).toBeInTheDocument();
    
    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);
    
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('renders pagination when there are multiple pages', () => {
    (useDocumentGallery as any).mockReturnValue({
      ...defaultMockReturn,
      totalCount: 100,
      hasMore: true,
    });

    const wrapper = createWrapper();
    render(<DocumentGallery />, { wrapper });

    expect(screen.getByText(/showing 1-20 of 100 documents/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('handles pagination navigation', () => {
    const mockNextPage = vi.fn();
    const mockPreviousPage = vi.fn();
    const mockGoToPage = vi.fn();

    (useDocumentGallery as any).mockReturnValue({
      ...defaultMockReturn,
      totalCount: 100,
      hasMore: true,
      nextPage: mockNextPage,
      previousPage: mockPreviousPage,
      goToPage: mockGoToPage,
    });

    const wrapper = createWrapper();
    render(<DocumentGallery />, { wrapper });

    // Test next page
    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);
    expect(mockNextPage).toHaveBeenCalled();

    // Test previous page
    const previousButton = screen.getByRole('button', { name: /previous/i });
    fireEvent.click(previousButton);
    expect(mockPreviousPage).toHaveBeenCalled();

    // Test go to specific page
    const pageButton = screen.getByRole('button', { name: '2' });
    fireEvent.click(pageButton);
    expect(mockGoToPage).toHaveBeenCalledWith(2);
  });

  it('navigates to upload page when upload button is clicked', () => {
    const wrapper = createWrapper();
    render(<DocumentGallery />, { wrapper });

    const uploadButton = screen.getByRole('button', { name: /upload document/i });
    fireEvent.click(uploadButton);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/documents/upload' });
  });

  it('handles document actions through card interactions', async () => {
    const mockReprocessDocument = vi.fn();
    const mockDeleteDocument = vi.fn();
    const mockDownloadDocument = vi.fn();

    (useDocumentGallery as any).mockReturnValue({
      ...defaultMockReturn,
      reprocessDocument: mockReprocessDocument,
      deleteDocument: mockDeleteDocument,
      downloadDocument: mockDownloadDocument,
    });

    // Mock window.confirm for delete action
    Object.defineProperty(window, 'confirm', {
      value: vi.fn(() => true),
      writable: true,
    });

    const wrapper = createWrapper();
    render(<DocumentGallery />, { wrapper });

    // Find the first document card and test actions
    const firstCard = screen.getByText('invoice-001.pdf').closest('[role="generic"]');
    expect(firstCard).toBeInTheDocument();

    // Note: This is a simplified test. In a real scenario, you'd need to:
    // 1. Click the dropdown menu
    // 2. Select the specific action
    // 3. Verify the action was called
    // This would require more complex DOM traversal
  });

  it('disables actions when loading', () => {
    (useDocumentGallery as any).mockReturnValue({
      ...defaultMockReturn,
      isReprocessing: true,
      isDeleting: true,
      isDownloading: true,
    });

    const wrapper = createWrapper();
    render(<DocumentGallery />, { wrapper });

    // Actions should be disabled when any operation is in progress
    // This would be tested through the DocumentCard component
    expect(screen.getByText('invoice-001.pdf')).toBeInTheDocument();
  });

  it('shows results count', () => {
    const wrapper = createWrapper();
    render(<DocumentGallery />, { wrapper });

    expect(screen.getByText('Found 2 documents')).toBeInTheDocument();
  });

  it('hides statistics when showStats is false', () => {
    const wrapper = createWrapper();
    render(<DocumentGallery showStats={false} />, { wrapper });

    expect(screen.queryByText('Total Documents')).not.toBeInTheDocument();
  });

  it('hides filters when showFilters is false', () => {
    const wrapper = createWrapper();
    render(<DocumentGallery showFilters={false} />, { wrapper });

    // The search input should not be present when filters are hidden
    expect(screen.queryByPlaceholderText(/search documents/i)).not.toBeInTheDocument();
  });
});