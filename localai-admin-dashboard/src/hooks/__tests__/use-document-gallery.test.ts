import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDocumentGallery, useDocuments, useDocumentStats } from '../use-document-gallery';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
  }
}));

// Mock sonner for toast notifications
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }
}));

const mockDocuments = [
  {
    id: 'doc-1',
    filename: 'test1.pdf',
    file_size: 1024,
    upload_date: '2024-01-01T00:00:00Z',
    status: 'completed',
    document_type: 'invoice',
    file_type: 'pdf',
    user_id: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'doc-2',
    filename: 'test2.docx',
    file_size: 2048,
    upload_date: '2024-01-02T00:00:00Z',
    status: 'analyzing',
    document_type: 'contract',
    file_type: 'docx',
    user_id: 'user-1',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  }
];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches documents with default parameters', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: mockDocuments,
        error: null,
        count: 2
      })
    });

    (supabase.from as any).mockReturnValue({ select: mockSelect });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocuments(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.documents).toEqual(mockDocuments);
    expect(result.current.data?.total_count).toBe(2);
  });

  it('applies search filters correctly', async () => {
    const mockOr = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnValue({
      or: mockOr,
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: mockDocuments,
        error: null,
        count: 2
      })
    });

    (supabase.from as any).mockReturnValue({ select: mockSelect });

    const wrapper = createWrapper();
    const filters = { search: 'test' };
    
    renderHook(() => useDocuments(filters), { wrapper });

    await waitFor(() => {
      expect(mockOr).toHaveBeenCalledWith('filename.ilike.%test%,document_type.ilike.%test%');
    });
  });

  it('applies status filters correctly', async () => {
    const mockIn = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnValue({
      or: vi.fn().mockReturnThis(),
      in: mockIn,
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: mockDocuments,
        error: null,
        count: 2
      })
    });

    (supabase.from as any).mockReturnValue({ select: mockSelect });

    const wrapper = createWrapper();
    const filters = { status: ['completed', 'analyzing'] };
    
    renderHook(() => useDocuments(filters), { wrapper });

    await waitFor(() => {
      expect(mockIn).toHaveBeenCalledWith('status', ['completed', 'analyzing']);
    });
  });

  it('handles pagination correctly', async () => {
    const mockRange = vi.fn().mockResolvedValue({
      data: mockDocuments,
      error: null,
      count: 100
    });

    const mockSelect = vi.fn().mockReturnValue({
      or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: mockRange
    });

    (supabase.from as any).mockReturnValue({ select: mockSelect });

    const wrapper = createWrapper();
    const pagination = { page: 3, limit: 20 };
    
    renderHook(() => useDocuments({}, pagination), { wrapper });

    await waitFor(() => {
      // Page 3 with limit 20 should start at offset 40 (3-1) * 20
      expect(mockRange).toHaveBeenCalledWith(40, 59);
    });
  });

  it('calculates has_more correctly', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: mockDocuments,
        error: null,
        count: 50
      })
    });

    (supabase.from as any).mockReturnValue({ select: mockSelect });

    const wrapper = createWrapper();
    const pagination = { page: 1, limit: 20 };
    
    const { result } = renderHook(() => useDocuments({}, pagination), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // 50 total, page 1 with limit 20, should have more pages
    expect(result.current.data?.has_more).toBe(true);
  });
});

describe('useDocumentStats', () => {
  it('calculates document statistics correctly', async () => {
    const mockStatsData = [
      { status: 'completed', file_type: 'pdf', document_type: 'invoice' },
      { status: 'completed', file_type: 'pdf', document_type: 'contract' },
      { status: 'analyzing', file_type: 'docx', document_type: 'invoice' },
      { status: 'failed', file_type: 'txt', document_type: null },
    ];

    const mockSelect = vi.fn().mockResolvedValue({
      data: mockStatsData,
      error: null
    });

    (supabase.from as any).mockReturnValue({ select: mockSelect });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentStats(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const stats = result.current.data;
    expect(stats?.total).toBe(4);
    expect(stats?.by_status).toEqual({
      completed: 2,
      analyzing: 1,
      failed: 1
    });
    expect(stats?.by_file_type).toEqual({
      pdf: 2,
      docx: 1,
      txt: 1
    });
    expect(stats?.by_document_type).toEqual({
      invoice: 2,
      contract: 1
    });
  });
});

describe('useDocumentGallery', () => {
  it('initializes with default state', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentGallery(), { wrapper });

    expect(result.current.filters).toEqual({});
    expect(result.current.pagination).toEqual({ page: 1, limit: 20 });
    expect(result.current.sort).toEqual({ field: 'upload_date', direction: 'desc' });
  });

  it('updates filters and resets pagination', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentGallery(), { wrapper });

    // Set pagination to page 3
    result.current.goToPage(3);
    expect(result.current.pagination.page).toBe(3);

    // Update filters should reset pagination to page 1
    result.current.updateFilters({ search: 'test' });
    
    expect(result.current.filters.search).toBe('test');
    expect(result.current.pagination.page).toBe(1);
  });

  it('handles pagination navigation correctly', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentGallery(), { wrapper });

    expect(result.current.pagination.page).toBe(1);

    // Go to next page
    result.current.nextPage();
    expect(result.current.pagination.page).toBe(2);

    // Go to previous page
    result.current.previousPage();
    expect(result.current.pagination.page).toBe(1);

    // Try to go to previous page when already at page 1
    result.current.previousPage();
    expect(result.current.pagination.page).toBe(1);

    // Go to specific page
    result.current.goToPage(5);
    expect(result.current.pagination.page).toBe(5);
  });

  it('updates sort and resets pagination', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDocumentGallery(), { wrapper });

    // Set pagination to page 3
    result.current.goToPage(3);
    expect(result.current.pagination.page).toBe(3);

    // Update sort should reset pagination to page 1
    result.current.updateSort({ field: 'filename', direction: 'asc' });
    
    expect(result.current.sort).toEqual({ field: 'filename', direction: 'asc' });
    expect(result.current.pagination.page).toBe(1);
  });
});