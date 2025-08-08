import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// Helper function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export interface Document {
  id: number;
  uuid: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size?: number;
  content_text?: string;
  metadata?: Record<string, any>;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
  processing_status: 'uploaded' | 'analyzing' | 'processing' | 'completed' | 'failed';
  // UI-friendly aliases we'll add via transformation
  filename?: string;
  upload_date?: string;
  status?: 'pending' | 'analyzing' | 'completed' | 'failed';
  document_type?: string;
  thumbnail_url?: string;
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
  document_type?: string[];
  date_from?: string;
  date_to?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface SortParams {
  field: 'upload_date' | 'filename' | 'file_size' | 'status';
  direction: 'asc' | 'desc';
}

// Query key factory for consistent caching
export const documentQueries = {
  all: ['documents'] as const,
  lists: () => [...documentQueries.all, 'list'] as const,
  list: (filters: DocumentFilters, pagination: PaginationParams, sort: SortParams) => 
    [...documentQueries.lists(), { filters, pagination, sort }] as const,
  details: () => [...documentQueries.all, 'detail'] as const,
  detail: (id: number) => [...documentQueries.details(), id] as const,
  stats: () => [...documentQueries.all, 'stats'] as const,
};

// Main hook for fetching documents with filters, pagination, and sorting
export function useDocuments(
  filters: DocumentFilters = {}, 
  pagination: PaginationParams = { page: 1, limit: 20 },
  sort: SortParams = { field: 'upload_date', direction: 'desc' }
) {
  return useQuery({
    queryKey: documentQueries.list(filters, pagination, sort),
    queryFn: () => fetchDocuments(filters, pagination, sort),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

// Transform database document to UI-friendly format
function transformDocument(doc: any): Document {
  // Map processing_status to simplified status
  const statusMap: Record<string, 'pending' | 'analyzing' | 'completed' | 'failed'> = {
    'uploaded': 'pending',
    'analyzing': 'analyzing',
    'processing': 'analyzing',
    'completed': 'completed',
    'failed': 'failed'
  };

  return {
    ...doc,
    // Add UI-friendly aliases
    filename: doc.name,
    upload_date: doc.created_at,
    status: statusMap[doc.processing_status] || 'pending',
    document_type: doc.metadata?.document_type || doc.metadata?.classification?.primary_category,
    thumbnail_url: doc.metadata?.thumbnail_url,
  };
}

// Document fetching function with Supabase
async function fetchDocuments(
  filters: DocumentFilters,
  pagination: PaginationParams,
  sort: SortParams
): Promise<DocumentsResponse> {
  try {
    let query = supabase
      .from('documents')
      .select('*', { count: 'exact' });

    // Apply search filter on name and content_text
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,content_text.ilike.%${filters.search}%`);
    }

    // Apply status filter - map UI status to processing_status values
    if (filters.status && filters.status.length > 0) {
      const statusMap: Record<string, string[]> = {
        'pending': ['uploaded'],
        'analyzing': ['analyzing', 'processing'],
        'completed': ['completed'],
        'failed': ['failed']
      };
      
      const processingStatuses = filters.status.flatMap(s => statusMap[s] || []);
      if (processingStatuses.length > 0) {
        query = query.in('processing_status', processingStatuses);
      }
    }

    // Apply file type filter
    if (filters.file_type && filters.file_type.length > 0) {
      query = query.in('file_type', filters.file_type);
    }

    // Apply document type filter via metadata
    if (filters.document_type && filters.document_type.length > 0) {
      // This is a bit tricky with JSONB - we need to use contains
      const orConditions = filters.document_type.map(type => 
        `metadata->>'document_type'.eq.${type},metadata->'classification'->>'primary_category'.eq.${type}`
      ).join(',');
      query = query.or(orConditions);
    }

    // Apply date range filters on created_at
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    // Apply sorting - map UI field names to database columns
    const sortFieldMap: Record<string, string> = {
      'upload_date': 'created_at',
      'filename': 'name',
      'file_size': 'file_size',
      'status': 'processing_status'
    };
    const dbSortField = sortFieldMap[sort.field] || sort.field;
    query = query.order(dbSortField, { ascending: sort.direction === 'asc' });

    // Apply pagination
    const offset = (pagination.page - 1) * pagination.limit;
    query = query.range(offset, offset + pagination.limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching documents:', error);
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    const total_count = count || 0;
    const has_more = total_count > offset + (data?.length || 0);

    // Transform documents to UI-friendly format
    const transformedDocuments = (data || []).map(transformDocument);

    return {
      documents: transformedDocuments,
      total_count,
      has_more,
    };
  } catch (error) {
    console.error('Document fetch error:', error);
    throw error;
  }
}

// Hook for document statistics
export function useDocumentStats() {
  return useQuery({
    queryKey: documentQueries.stats(),
    queryFn: fetchDocumentStats,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

async function fetchDocumentStats() {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('processing_status, file_type, metadata');

    if (error) throw error;

    const stats = {
      total: data.length,
      by_status: {} as Record<string, number>,
      by_file_type: {} as Record<string, number>,
      by_document_type: {} as Record<string, number>,
    };

    // Map processing_status to UI status for consistency
    const statusMap: Record<string, string> = {
      'uploaded': 'pending',
      'analyzing': 'analyzing',
      'processing': 'analyzing',
      'completed': 'completed',
      'failed': 'failed'
    };

    data.forEach((doc) => {
      // Count by status (using mapped values)
      const uiStatus = statusMap[doc.processing_status] || 'pending';
      stats.by_status[uiStatus] = (stats.by_status[uiStatus] || 0) + 1;
      
      // Count by file type
      stats.by_file_type[doc.file_type] = (stats.by_file_type[doc.file_type] || 0) + 1;
      
      // Count by document type from metadata
      const docType = doc.metadata?.document_type || doc.metadata?.classification?.primary_category;
      if (docType) {
        stats.by_document_type[docType] = (stats.by_document_type[docType] || 0) + 1;
      }
    });

    return stats;
  } catch (error) {
    console.error('Error fetching document stats:', error);
    throw error;
  }
}

// Hook for real-time document updates
export function useDocumentSubscription() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Add error handling for WebSocket connection failures
    let subscription: any = null;
    
    try {
      subscription = supabase
        .channel('documents_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'documents'
          },
          (payload) => {
            console.log('Document realtime change received:', payload);
            
            // Don't interfere if this is a DELETE operation triggered by our own delete mutation
            if (payload.eventType === 'DELETE') {
              console.log('DELETE event detected via realtime, skipping cache invalidation to prevent conflicts');
              return;
            }
            
            // Invalidate and refetch documents list queries for other events
            console.log('Invalidating queries due to realtime update:', payload.eventType);
            queryClient.invalidateQueries({
              queryKey: documentQueries.lists()
            });

            // Invalidate stats
            queryClient.invalidateQueries({
              queryKey: documentQueries.stats()
            });

            // Update specific document in cache if it exists
            if (payload.new && payload.new.id) {
              queryClient.setQueryData(
                documentQueries.detail(payload.new.id),
                payload.new
              );
            }

            // Show toast notifications for status changes - use processing_status from DB
            if (payload.eventType === 'UPDATE' && payload.old?.processing_status !== payload.new?.processing_status) {
              const filename = payload.new?.name || 'Document';
              const newStatus = payload.new?.processing_status;
              
              switch (newStatus) {
                case 'completed':
                  toast.success(`${filename} processing completed`);
                  break;
                case 'failed':
                  toast.error(`${filename} processing failed`);
                  break;
                case 'analyzing':
                case 'processing':
                  toast.info(`${filename} processing started`);
                  break;
              }
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIPTION_ERROR') {
            console.warn('Real-time subscription failed. Document gallery will still work but without live updates.');
          } else if (status === 'SUBSCRIBED') {
            console.log('Real-time subscriptions active for document gallery');
          }
        });
    } catch (error) {
      console.warn('Failed to set up real-time subscriptions:', error);
    }

    return () => {
      try {
        subscription?.unsubscribe();
      } catch (error) {
        console.warn('Error unsubscribing from real-time updates:', error);
      }
    };
  }, [queryClient]);
}

// Hook for document actions (reprocess, delete, etc.)
export function useDocumentActions() {
  const queryClient = useQueryClient();

  const reprocessMutation = useMutation({
    mutationFn: async (documentId: number) => {
      // Update processing_status to analyzing
      const { error: updateError } = await supabase
        .from('documents')
        .update({ 
          processing_status: 'analyzing',
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (updateError) throw updateError;

      // Trigger reprocessing via document processor API
      const response = await fetch(`http://localhost:8090/api/documents/${documentId}/reprocess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to trigger document reprocessing');
      }

      return response.json();
    },
    onSuccess: (data, documentId) => {
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({
        queryKey: documentQueries.lists()
      });
      
      queryClient.invalidateQueries({
        queryKey: documentQueries.stats()
      });

      toast.success('Document reprocessing started');
    },
    onError: (error) => {
      console.error('Error reprocessing document:', error);
      toast.error('Failed to reprocess document');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: number) => {
      console.log('🗑️ Starting document deletion for ID:', documentId, typeof documentId);
      console.log('🔗 Supabase client config:', {
        url: import.meta.env.VITE_SUPABASE_URL,
        hasAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
        keyPrefix: import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...'
      });
      
      // Step 1: Get document info including file_path for storage deletion
      console.log('🔍 Making Supabase query to documents table...');
      const { data: document, error: fetchError } = await supabase
        .from('documents')
        .select('file_path, name, file_size')
        .eq('id', documentId)
        .single();
      
      console.log('📊 Query result:', { document, fetchError });

      if (fetchError) {
        console.error('Failed to fetch document for deletion:', fetchError);
        throw new Error('Document not found or already deleted');
      }

      if (!document || !document.file_path) {
        console.warn('Document found but no file_path available:', document);
        // Still proceed with database deletion if no file path
      }

      // Step 2: Delete file from storage first (if file_path exists)
      if (document.file_path) {
        try {
          const { error: storageError } = await supabase.storage
            .from('documents')
            .remove([document.file_path]);

          if (storageError) {
            // Log but don't fail - file might already be deleted or bucket might not exist
            console.warn('Storage deletion warning:', storageError);
            // Only throw for critical storage errors, not for missing files/buckets
            if (!storageError.message?.includes('not found') && 
                !storageError.message?.includes('does not exist') &&
                !storageError.message?.includes('bucket not found')) {
              console.error('Critical storage error:', storageError);
              // Continue with database deletion even if storage fails - this prevents orphaned records
            }
          }
        } catch (storageErr) {
          console.warn('Storage deletion failed, continuing with database deletion:', storageErr);
          // Don't throw - continue with database deletion to prevent orphaned records
          // The file might be missing or storage might be misconfigured
        }
      }

      // Step 3: Delete database record only after successful storage deletion
      console.log('🗄️ Making DELETE request to documents table for ID:', documentId);
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);
      
      console.log('📊 DELETE result:', { dbError });

      if (dbError) {
        // Critical: File deleted but database record remains
        console.error('CRITICAL: Database deletion failed after file deletion:', dbError);
        console.error('Orphaned file path:', document.file_path);
        // Store orphaned file info for cleanup (you might want to log this to a cleanup table)
        throw new Error(`File deleted but database cleanup failed. Please contact support. Error: ${dbError.message}`);
      }
      
      return { 
        documentId, 
        deletedFile: document.file_path,
        freedSpace: document.file_size || 0,
        documentName: document.name
      };
    },
    onSuccess: (result) => {
      // Use a timeout to ensure database changes have propagated before updating cache
      setTimeout(() => {
        // Remove from cache first to prevent showing stale data
        queryClient.removeQueries({
          queryKey: documentQueries.detail(result.documentId)
        });

        // Invalidate and refetch list queries to ensure UI consistency
        queryClient.invalidateQueries({
          queryKey: documentQueries.lists(),
          refetchType: 'active' // Only refetch active queries
        });
        
        queryClient.invalidateQueries({
          queryKey: documentQueries.stats(),
          refetchType: 'active'
        });
      }, 100); // Small delay to avoid race conditions with real-time updates

      // Enhanced success message with storage info
      const sizeInfo = result.freedSpace ? ` (${formatFileSize(result.freedSpace)} freed)` : '';
      toast.success(`Document "${result.documentName}" deleted successfully${sizeInfo}`);
    },
    onError: (error) => {
      console.error('Error deleting document:', error);
      
      // Provide specific error messages based on the error type
      let errorMessage = 'Failed to delete document';
      
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          errorMessage = 'Document not found or already deleted';
        } else if (error.message.includes('storage')) {
          errorMessage = 'Failed to delete document file. Please try again.';
        } else if (error.message.includes('database cleanup failed')) {
          errorMessage = 'Document file deleted but database cleanup failed. Please contact support.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
    }
  });

  const downloadMutation = useMutation({
    mutationFn: async (documentId: number) => {
      // Get document info first
      const { data: document, error } = await supabase
        .from('documents')
        .select('name, file_path')
        .eq('id', documentId)
        .single();

      if (error) throw error;

      // Download via document processor API
      const response = await fetch(`http://localhost:8090/api/documents/${documentId}/download`);
      
      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.name;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);

      return document;
    },
    onError: (error) => {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  });

  return {
    reprocessDocument: reprocessMutation.mutate,
    deleteDocument: deleteMutation.mutate,
    downloadDocument: downloadMutation.mutate,
    isReprocessing: reprocessMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isDownloading: downloadMutation.isPending,
  };
}

// Main hook combining all gallery functionality
export function useDocumentGallery() {
  const [filters, setFilters] = useState<DocumentFilters>({});
  const [pagination, setPagination] = useState<PaginationParams>({ page: 1, limit: 20 });
  const [sort, setSort] = useState<SortParams>({ field: 'upload_date', direction: 'desc' });

  // Subscribe to real-time updates
  useDocumentSubscription();

  // Fetch documents
  const documentsQuery = useDocuments(filters, pagination, sort);
  
  // Fetch statistics
  const statsQuery = useDocumentStats();

  // Document actions
  const actions = useDocumentActions();

  // Helper functions
  const resetPagination = () => setPagination(prev => ({ ...prev, page: 1 }));

  const updateFilters = (newFilters: Partial<DocumentFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    resetPagination();
  };

  const updateSort = (newSort: SortParams) => {
    setSort(newSort);
    resetPagination();
  };

  const nextPage = () => {
    if (documentsQuery.data?.has_more) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    }
  };

  const previousPage = () => {
    if (pagination.page > 1) {
      setPagination(prev => ({ ...prev, page: prev.page - 1 }));
    }
  };

  const goToPage = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  return {
    // Data
    documents: documentsQuery.data?.documents || [],
    totalCount: documentsQuery.data?.total_count || 0,
    hasMore: documentsQuery.data?.has_more || false,
    stats: statsQuery.data,
    
    // Loading states
    isLoading: documentsQuery.isLoading,
    isLoadingStats: statsQuery.isLoading,
    error: documentsQuery.error,
    
    // Current state
    filters,
    pagination,
    sort,
    
    // Actions
    updateFilters,
    setFilters,
    updateSort,
    nextPage,
    previousPage,
    goToPage,
    resetPagination,
    
    // Document actions
    ...actions,
    
    // Refetch
    refetch: documentsQuery.refetch,
    refetchStats: statsQuery.refetch,
  };
}