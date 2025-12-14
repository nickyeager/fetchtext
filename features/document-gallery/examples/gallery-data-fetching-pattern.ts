// Data Fetching Pattern for Document Gallery
// Shows the recommended approach for fetching, caching, and real-time updates

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface Document {
  id: string;
  filename: string;
  file_size: number;
  upload_date: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  document_type?: string;
  file_type: string;
  user_id: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DocumentsResponse {
  documents: Document[];
  total_count: number;
  has_more: boolean;
}

export interface DocumentFilters {
  search?: string;
  status?: string[];
  file_type?: string[];
  date_from?: string;
  date_to?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

// Query key factory for consistent caching
export const documentQueries = {
  all: ['documents'] as const,
  lists: () => [...documentQueries.all, 'list'] as const,
  list: (filters: DocumentFilters, pagination: PaginationParams) => 
    [...documentQueries.lists(), { filters, pagination }] as const,
  details: () => [...documentQueries.all, 'detail'] as const,
  detail: (id: string) => [...documentQueries.details(), id] as const,
};

// Main hook for fetching documents with filters and pagination
export function useDocuments(
  filters: DocumentFilters = {}, 
  pagination: PaginationParams = { page: 1, limit: 20 }
) {
  return useQuery({
    queryKey: documentQueries.list(filters, pagination),
    queryFn: () => fetchDocuments(filters, pagination),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
}

// Document fetching function with Supabase
async function fetchDocuments(
  filters: DocumentFilters,
  pagination: PaginationParams
): Promise<DocumentsResponse> {
  let query = supabase
    .from('documents')
    .select('*', { count: 'exact' });

  // Apply filters
  if (filters.search) {
    query = query.ilike('filename', `%${filters.search}%`);
  }

  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters.file_type && filters.file_type.length > 0) {
    query = query.in('file_type', filters.file_type);
  }

  if (filters.date_from) {
    query = query.gte('upload_date', filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte('upload_date', filters.date_to);
  }

  // Apply pagination
  const offset = (pagination.page - 1) * pagination.limit;
  query = query
    .order('upload_date', { ascending: false })
    .range(offset, offset + pagination.limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching documents:', error);
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  const total_count = count || 0;
  const has_more = total_count > offset + (data?.length || 0);

  return {
    documents: data || [],
    total_count,
    has_more,
  };
}

// Hook for real-time document updates
export function useDocumentSubscription() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const subscription = supabase
      .channel('documents_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents'
        },
        (payload) => {
          console.log('Document change received:', payload);
          
          // Invalidate and refetch documents list queries
          queryClient.invalidateQueries({
            queryKey: documentQueries.lists()
          });

          // Update specific document in cache if it exists
          if (payload.new && payload.new.id) {
            queryClient.setQueryData(
              documentQueries.detail(payload.new.id),
              payload.new
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);
}

// Hook for document actions (reprocess, delete, etc.)
export function useDocumentActions() {
  const queryClient = useQueryClient();

  const reprocessDocument = async (documentId: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ 
          status: 'analyzing',
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (error) throw error;

      // Trigger reprocessing via document processor API
      const response = await fetch(`/api/documents/${documentId}/reprocess`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to trigger reprocessing');
      }

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({
        queryKey: documentQueries.lists()
      });

    } catch (error) {
      console.error('Error reprocessing document:', error);
      throw error;
    }
  };

  const deleteDocument = async (documentId: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      // Remove from cache
      queryClient.removeQueries({
        queryKey: documentQueries.detail(documentId)
      });

      // Invalidate list queries
      queryClient.invalidateQueries({
        queryKey: documentQueries.lists()
      });

    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  };

  return {
    reprocessDocument,
    deleteDocument,
  };
}

// Example usage pattern in component
export function useDocumentGallery() {
  const [filters, setFilters] = useState<DocumentFilters>({});
  const [pagination, setPagination] = useState<PaginationParams>({ page: 1, limit: 20 });

  // Subscribe to real-time updates
  useDocumentSubscription();

  // Fetch documents
  const documentsQuery = useDocuments(filters, pagination);

  // Document actions
  const { reprocessDocument, deleteDocument } = useDocumentActions();

  return {
    documents: documentsQuery.data?.documents || [],
    totalCount: documentsQuery.data?.total_count || 0,
    hasMore: documentsQuery.data?.has_more || false,
    isLoading: documentsQuery.isLoading,
    error: documentsQuery.error,
    filters,
    setFilters,
    pagination,
    setPagination,
    reprocessDocument,
    deleteDocument,
    refetch: documentsQuery.refetch,
  };
}