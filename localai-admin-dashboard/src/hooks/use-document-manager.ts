/**
 * Custom Hook for Document Management
 * Provides reactive document state management and lifecycle tracking
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  UnifiedDocumentService, 
  DocumentRecord, 
  DocumentStatus, 
  UploadSource,
  CreateDocumentOptions,
  UpdateDocumentStatusOptions 
} from '@/services/unified-document-service';

export interface UseDocumentManagerOptions {
  enableRealTimeUpdates?: boolean;
  pollInterval?: number;
}

export interface DocumentManagerState {
  documents: DocumentRecord[];
  isLoading: boolean;
  error: string | null;
  analytics: {
    total: number;
    byStatus: Record<DocumentStatus, number>;
    bySource: Record<UploadSource, number>;
    byMethod: Record<string, number>;
    avgProcessingTime: number;
  } | null;
}

export interface DocumentUploadProgress {
  documentId: string;
  file: File;
  status: DocumentStatus;
  progress: number;
  error?: string;
  result?: any;
}

export function useDocumentManager(options: UseDocumentManagerOptions = {}) {
  const { enableRealTimeUpdates = true, pollInterval = 30000 } = options;
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<any>(null);
  
  // Local state for upload progress tracking
  const [uploadProgress, setUploadProgress] = useState<Map<string, DocumentUploadProgress>>(new Map());
  
  // Query for all user documents
  const {
    data: documents = [],
    isLoading: isLoadingDocuments,
    error: documentsError,
    refetch: refetchDocuments
  } = useQuery({
    queryKey: ['documents'],
    queryFn: UnifiedDocumentService.getUserDocuments,
    refetchInterval: enableRealTimeUpdates ? pollInterval : false,
  });

  // Query for processing analytics
  const {
    data: analytics,
    isLoading: isLoadingAnalytics,
    error: analyticsError
  } = useQuery({
    queryKey: ['document-analytics'],
    queryFn: UnifiedDocumentService.getProcessingAnalytics,
    refetchInterval: enableRealTimeUpdates ? pollInterval : false,
  });

  // Mutation for creating documents
  const createDocumentMutation = useMutation({
    mutationFn: UnifiedDocumentService.createDocumentRecord,
    onSuccess: (newDocument) => {
      // Update the documents list immediately
      queryClient.setQueryData(['documents'], (oldData: DocumentRecord[] = []) => [
        newDocument,
        ...oldData
      ]);
      
      // Start tracking upload progress
      setUploadProgress(prev => new Map(prev.set(newDocument.id, {
        documentId: newDocument.id,
        file: new File([], newDocument.name), // Placeholder
        status: DocumentStatus.UPLOADED,
        progress: 25,
      })));
    },
    onError: (error) => {
      console.error('Failed to create document:', error);
    }
  });

  // Mutation for updating document status
  const updateDocumentMutation = useMutation({
    mutationFn: ({ documentId, options }: { documentId: string; options: UpdateDocumentStatusOptions }) =>
      UnifiedDocumentService.updateDocumentStatus(documentId, options),
    onSuccess: (updatedDocument) => {
      // Update the specific document in the list
      queryClient.setQueryData(['documents'], (oldData: DocumentRecord[] = []) =>
        oldData.map(doc => doc.id === updatedDocument.id ? updatedDocument : doc)
      );
      
      // Update upload progress
      const metadata = updatedDocument.metadata as any;
      if (metadata?.processing_status) {
        setUploadProgress(prev => {
          const current = prev.get(updatedDocument.id);
          if (current) {
            const progress = getProgressForStatus(metadata.processing_status);
            return new Map(prev.set(updatedDocument.id, {
              ...current,
              status: metadata.processing_status,
              progress,
            }));
          }
          return prev;
        });
      }
    },
    onError: (error) => {
      console.error('Failed to update document:', error);
    }
  });

  // Mutation for finalizing documents
  const finalizeDocumentMutation = useMutation({
    mutationFn: ({ documentId, results }: { documentId: string; results: any }) =>
      UnifiedDocumentService.finalizeDocument(documentId, results),
    onSuccess: (finalizedDocument) => {
      // Update the document in the list
      queryClient.setQueryData(['documents'], (oldData: DocumentRecord[] = []) =>
        oldData.map(doc => doc.id === finalizedDocument.id ? finalizedDocument : doc)
      );
      
      // Mark upload as complete
      setUploadProgress(prev => {
        const current = prev.get(finalizedDocument.id);
        if (current) {
          return new Map(prev.set(finalizedDocument.id, {
            ...current,
            status: DocumentStatus.COMPLETED,
            progress: 100,
            result: finalizedDocument,
          }));
        }
        return prev;
      });
      
      // Refresh analytics
      queryClient.invalidateQueries({ queryKey: ['document-analytics'] });
    }
  });

  // Mutation for marking documents as failed
  const markFailedMutation = useMutation({
    mutationFn: ({ documentId, errorMessage, errorDetails }: { documentId: string; errorMessage: string; errorDetails?: any }) =>
      UnifiedDocumentService.markDocumentFailed(documentId, errorMessage, errorDetails),
    onSuccess: (failedDocument) => {
      // Update the document in the list
      queryClient.setQueryData(['documents'], (oldData: DocumentRecord[] = []) =>
        oldData.map(doc => doc.id === failedDocument.id ? failedDocument : doc)
      );
      
      // Mark upload as failed
      setUploadProgress(prev => {
        const current = prev.get(failedDocument.id);
        if (current) {
          return new Map(prev.set(failedDocument.id, {
            ...current,
            status: DocumentStatus.FAILED,
            progress: 100,
            error: current.error,
          }));
        }
        return prev;
      });
    }
  });

  // Mutation for deleting documents
  const deleteDocumentMutation = useMutation({
    mutationFn: UnifiedDocumentService.deleteDocument,
    onSuccess: (_, documentId) => {
      // Remove from documents list
      queryClient.setQueryData(['documents'], (oldData: DocumentRecord[] = []) =>
        oldData.filter(doc => doc.id !== documentId)
      );
      
      // Remove from upload progress
      setUploadProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(documentId);
        return newMap;
      });
      
      // Refresh analytics
      queryClient.invalidateQueries({ queryKey: ['document-analytics'] });
    }
  });

  // Set up real-time subscriptions
  useEffect(() => {
    if (!enableRealTimeUpdates) return;

    const { data: userData } = {} as any; // We'll need to get this from auth context
    // For now, we'll skip real-time subscriptions and rely on polling
    
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [enableRealTimeUpdates]);

  // Helper function to get progress percentage for status
  const getProgressForStatus = (status: DocumentStatus): number => {
    switch (status) {
      case DocumentStatus.UPLOADED:
        return 25;
      case DocumentStatus.ANALYZING:
        return 50;
      case DocumentStatus.PROCESSING:
        return 75;
      case DocumentStatus.COMPLETED:
        return 100;
      case DocumentStatus.FAILED:
        return 100;
      default:
        return 0;
    }
  };

  // Public API
  const createDocument = useCallback(async (options: CreateDocumentOptions): Promise<DocumentRecord> => {
    try {
      const result = await createDocumentMutation.mutateAsync(options);
      return result;
    } catch (error) {
      throw error;
    }
  }, [createDocumentMutation]);

  const updateDocumentStatus = useCallback(async (
    documentId: string, 
    options: UpdateDocumentStatusOptions
  ): Promise<DocumentRecord> => {
    try {
      const result = await updateDocumentMutation.mutateAsync({ documentId, options });
      return result;
    } catch (error) {
      throw error;
    }
  }, [updateDocumentMutation]);

  const finalizeDocument = useCallback(async (
    documentId: string, 
    results: any
  ): Promise<DocumentRecord> => {
    try {
      const result = await finalizeDocumentMutation.mutateAsync({ documentId, results });
      return result;
    } catch (error) {
      throw error;
    }
  }, [finalizeDocumentMutation]);

  const markDocumentFailed = useCallback(async (
    documentId: string, 
    errorMessage: string,
    errorDetails?: any
  ): Promise<DocumentRecord> => {
    try {
      const result = await markFailedMutation.mutateAsync({ documentId, errorMessage, errorDetails });
      return result;
    } catch (error) {
      throw error;
    }
  }, [markFailedMutation]);

  const deleteDocument = useCallback(async (documentId: string): Promise<void> => {
    try {
      await deleteDocumentMutation.mutateAsync(documentId);
    } catch (error) {
      throw error;
    }
  }, [deleteDocumentMutation]);

  const getDocumentById = useCallback(async (documentId: string): Promise<DocumentRecord | null> => {
    try {
      return await UnifiedDocumentService.getDocumentById(documentId);
    } catch (error) {
      console.error('Failed to get document:', error);
      return null;
    }
  }, []);

  const refreshDocuments = useCallback(() => {
    refetchDocuments();
    queryClient.invalidateQueries({ queryKey: ['document-analytics'] });
  }, [refetchDocuments, queryClient]);

  const clearUploadProgress = useCallback((documentId: string) => {
    setUploadProgress(prev => {
      const newMap = new Map(prev);
      newMap.delete(documentId);
      return newMap;
    });
  }, []);

  const getUploadProgress = useCallback((documentId: string): DocumentUploadProgress | null => {
    return uploadProgress.get(documentId) || null;
  }, [uploadProgress]);

  const getAllUploadProgress = useCallback((): DocumentUploadProgress[] => {
    return Array.from(uploadProgress.values());
  }, [uploadProgress]);

  // Computed state
  const state: DocumentManagerState = {
    documents,
    isLoading: isLoadingDocuments || isLoadingAnalytics,
    error: documentsError?.message || analyticsError?.message || null,
    analytics,
  };

  const isCreatingDocument = createDocumentMutation.isPending;
  const isUpdatingDocument = updateDocumentMutation.isPending;
  const isDeletingDocument = deleteDocumentMutation.isPending;

  return {
    // State
    ...state,
    
    // Loading states
    isCreatingDocument,
    isUpdatingDocument,
    isDeletingDocument,
    
    // Upload progress tracking
    uploadProgress: Array.from(uploadProgress.values()),
    getUploadProgress,
    getAllUploadProgress,
    clearUploadProgress,
    
    // Actions
    createDocument,
    updateDocumentStatus,
    finalizeDocument,
    markDocumentFailed,
    deleteDocument,
    getDocumentById,
    refreshDocuments,
    
    // Utilities
    getProgressForStatus,
  };
}

export default useDocumentManager;