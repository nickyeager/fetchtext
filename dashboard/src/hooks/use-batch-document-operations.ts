import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { documentQueries } from './use-document-gallery';

interface BatchDeleteResult {
  successful: number[];
  failed: Array<{ id: number; error: string }>;
  totalFreedSpace: number;
}

/**
 * Hook for batch document operations including deletion
 */
export function useBatchDocumentOperations() {
  const queryClient = useQueryClient();

  const batchDeleteMutation = useMutation({
    mutationFn: async (documentIds: number[]): Promise<BatchDeleteResult> => {
      const result: BatchDeleteResult = {
        successful: [],
        failed: [],
        totalFreedSpace: 0
      };

      // Process deletions sequentially to avoid overwhelming the storage service
      for (const documentId of documentIds) {
        try {
          // Get document info
          const { data: document, error: fetchError } = await supabase
            .from('documents')
            .select('file_path, name, file_size')
            .eq('id', documentId)
            .single();

          if (fetchError || !document) {
            result.failed.push({
              id: documentId,
              error: 'Document not found'
            });
            continue;
          }

          // Delete from storage if file_path exists
          if (document.file_path) {
            const { error: storageError } = await supabase.storage
              .from('documents')
              .remove([document.file_path]);

            if (storageError && !storageError.message?.includes('not found')) {
              result.failed.push({
                id: documentId,
                error: `Storage deletion failed: ${storageError.message}`
              });
              continue;
            }
          }

          // Delete from database
          const { error: dbError } = await supabase
            .from('documents')
            .delete()
            .eq('id', documentId);

          if (dbError) {
            result.failed.push({
              id: documentId,
              error: `Database deletion failed: ${dbError.message}`
            });
            // Note: File is already deleted at this point - log for cleanup
            console.error('Orphaned file after batch deletion:', document.file_path);
          } else {
            result.successful.push(documentId);
            result.totalFreedSpace += document.file_size || 0;
          }
        } catch (error) {
          result.failed.push({
            id: documentId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return result;
    },
    onSuccess: (result) => {
      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: documentQueries.lists()
      });
      queryClient.invalidateQueries({
        queryKey: documentQueries.stats()
      });

      // Remove successful deletions from cache
      result.successful.forEach(id => {
        queryClient.removeQueries({
          queryKey: documentQueries.detail(id)
        });
      });

      // Show results
      if (result.successful.length > 0) {
        const freedSpaceText = result.totalFreedSpace > 0 
          ? ` (${formatFileSize(result.totalFreedSpace)} freed)`
          : '';
        toast.success(
          `Successfully deleted ${result.successful.length} document${
            result.successful.length > 1 ? 's' : ''
          }${freedSpaceText}`
        );
      }

      if (result.failed.length > 0) {
        toast.error(
          `Failed to delete ${result.failed.length} document${
            result.failed.length > 1 ? 's' : ''
          }. Check console for details.`
        );
        console.error('Batch deletion failures:', result.failed);
      }
    },
    onError: (error) => {
      console.error('Batch deletion error:', error);
      toast.error('Batch deletion failed. Please try again.');
    }
  });

  return {
    batchDeleteDocuments: batchDeleteMutation.mutate,
    isBatchDeleting: batchDeleteMutation.isPending,
    batchDeleteResult: batchDeleteMutation.data
  };
}

// Helper function
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}