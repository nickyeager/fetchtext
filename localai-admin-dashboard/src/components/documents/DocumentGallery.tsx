import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { 
  ChevronLeft, 
  ChevronRight, 
  Upload, 
  RefreshCw, 
  FileText, 
  AlertCircle,
  Inbox,
  Grid3X3,
  List
} from 'lucide-react';
import { DocumentCard } from './DocumentCard';
import { DocumentTable } from './DocumentTable';
import { DocumentGalleryFilters } from './DocumentGalleryFilters';
import { DragDropUpload } from './DragDropUpload';
import { useDocumentGallery } from '@/hooks/use-document-gallery';
import { toast } from 'sonner';

// Helper function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

interface DocumentGalleryProps {
  viewMode?: 'grid' | 'list';
  showFilters?: boolean;
  showStats?: boolean;
}

export function DocumentGallery({ 
  viewMode = 'grid', 
  showFilters = true,
  showStats = true 
}: DocumentGalleryProps) {
  const navigate = useNavigate();
  
  // Load view mode from localStorage, fallback to prop
  const [currentViewMode, setCurrentViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('document-gallery-view-mode');
      return (saved as 'grid' | 'list') || viewMode;
    } catch {
      return viewMode;
    }
  });
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{id: number, name: string, size?: number} | null>(null);
  const [showUploadZone, setShowUploadZone] = useState(false);

  // Save view mode to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('document-gallery-view-mode', currentViewMode);
    } catch (error) {
      console.warn('Failed to save view mode to localStorage:', error);
    }
  }, [currentViewMode]);
  
  const {
    documents,
    totalCount,
    hasMore,
    stats,
    isLoading,
    isLoadingStats,
    error,
    filters,
    pagination,
    sort,
    updateFilters,
    updateSort,
    nextPage,
    previousPage,
    goToPage,
    reprocessDocument,
    deleteDocument,
    downloadDocument,
    isReprocessing,
    isDeleting,
    isDownloading,
    refetch,
  } = useDocumentGallery();

  const handleViewDocument = (documentId: number) => {
    navigate({ to: `/documents/${documentId.toString()}` });
  };

  const handleReprocessDocument = async (documentId: number) => {
    try {
      await reprocessDocument(documentId);
    } catch (error) {
      console.error('Failed to reprocess document:', error);
    }
  };

  const handleDeleteDocument = (documentId: number) => {
    const document = documents.find(doc => doc.id === documentId);
    if (document) {
      // Ensure we have the document name - check both possible properties
      const documentName = document.filename || document.name || document.uuid || 'Untitled Document';
      
      setDocumentToDelete({ 
        id: documentId, 
        name: documentName,
        size: document.file_size
      });
      setDeleteDialogOpen(true);
    } else {
      console.error('Document not found for deletion:', documentId);
      toast.error('Document not found. It may have already been deleted.');
    }
  };

  const confirmDeleteDocument = async () => {
    if (documentToDelete) {
      try {
        console.log('Starting delete operation for document:', documentToDelete);
        await deleteDocument(documentToDelete.id);
        console.log('Delete operation completed successfully');
        setDeleteDialogOpen(false);
        setDocumentToDelete(null);
        
        // Force a refetch after a short delay to ensure UI is updated
        setTimeout(() => {
          refetch();
        }, 500);
      } catch (error) {
        console.error('Failed to delete document:', error);
        // Don't reset the dialog state on error - let user see what happened
        toast.error('Failed to delete document. Please try again.');
      }
    } else {
      console.error('No document selected for deletion');
      toast.error('No document selected for deletion');
    }
  };

  const cancelDeleteDocument = () => {
    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };

  const handleDownloadDocument = async (documentId: number) => {
    try {
      await downloadDocument(documentId);
    } catch (error) {
      console.error('Failed to download document:', error);
    }
  };

  const handleUploadClick = () => {
    navigate({ to: '/documents/upload' });
  };

  const renderEmptyState = () => {
    if (Object.keys(filters).length > 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Inbox className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No documents match your filters
          </h3>
          <p className="text-gray-600 text-center mb-6 max-w-md">
            Try adjusting your search criteria or filters to find more documents.
          </p>
          <Button onClick={() => updateFilters({})}>
            Clear All Filters
          </Button>
        </div>
      );
    }

    // Show drag-and-drop zone when no documents
    return (
      <DragDropUpload 
        onUploadComplete={(documentId) => {
          refetch(); // Refresh the document list
        }}
      />
    );
  };

  const renderError = () => (
    <Alert>
      <AlertCircle className="w-4 h-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>Failed to load documents. Please try again.</span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          className="ml-4"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );

  const renderStats = () => {
    if (!showStats || isLoadingStats || !stats) return null;

    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.by_status.completed || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.by_status.analyzing || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.by_status.failed || 0}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderDocuments = () => {
    if (currentViewMode === 'grid') {
      return (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {documents.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              onView={handleViewDocument}
              onReprocess={handleReprocessDocument}
              onDelete={handleDeleteDocument}
              onDownload={handleDownloadDocument}
              isLoading={isReprocessing || isDeleting || isDownloading}
            />
          ))}
        </div>
      );
    } else {
      return (
        <DocumentTable
          documents={documents}
          sort={sort}
          onView={handleViewDocument}
          onReprocess={handleReprocessDocument}
          onDelete={handleDeleteDocument}
          onDownload={handleDownloadDocument}
          onSortChange={updateSort}
          isLoading={isReprocessing || isDeleting || isDownloading}
        />
      );
    }
  };

  const renderLoadingSkeletons = () => {
    if (currentViewMode === 'grid') {
      return (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: pagination.limit }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    } else {
      return (
        <div className="rounded-md border">
          <div className="p-4">
            {Array.from({ length: Math.min(pagination.limit, 10) }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4 py-3 border-b last:border-b-0">
                <Skeleton className="w-8 h-8 rounded" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-6 rounded" />
              </div>
            ))}
          </div>
        </div>
      );
    }
  };

  const renderPagination = () => {
    if (totalCount <= pagination.limit) return null;

    const totalPages = Math.ceil(totalCount / pagination.limit);
    const startIndex = (pagination.page - 1) * pagination.limit + 1;
    const endIndex = Math.min(pagination.page * pagination.limit, totalCount);

    return (
      <div className="flex items-center justify-between pt-6">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <span>
            Showing {startIndex}-{endIndex} of {totalCount} documents
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={previousPage}
            disabled={pagination.page === 1 || isLoading}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          
          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }
              
              return (
                <Button
                  key={pageNum}
                  variant={pagination.page === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(pageNum)}
                  disabled={isLoading}
                  className="w-8 h-8 p-0"
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={nextPage}
            disabled={!hasMore || isLoading}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Gallery</h1>
          <p className="text-gray-600 mt-1">
            Browse and manage your uploaded documents
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Button
              variant={currentViewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCurrentViewMode('grid')}
              className="h-8 w-8 p-0"
              title="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={currentViewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCurrentViewMode('list')}
              className="h-8 w-8 p-0"
              title="Table view"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Upload Button */}
          <Button 
            onClick={() => setShowUploadZone(!showUploadZone)} 
            className="hidden sm:flex"
            variant={showUploadZone ? "secondary" : "default"}
          >
            <Upload className="w-4 h-4 mr-2" />
            {showUploadZone ? 'Hide Upload' : 'Upload Document'}
          </Button>
          
          {/* Mobile Upload Button */}
          <Button 
            onClick={() => setShowUploadZone(!showUploadZone)} 
            size="sm"
            className="sm:hidden"
            variant={showUploadZone ? "secondary" : "default"}
          >
            <Upload className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Upload Zone */}
      {showUploadZone && (
        <DragDropUpload 
          className="mb-6"
          onUploadStart={() => {
            // Optional: Add loading state
          }}
          onUploadComplete={(documentId) => {
            setShowUploadZone(false);
            refetch(); // Refresh the document list
          }}
        />
      )}

      {/* Statistics */}
      {renderStats()}

      {/* Filters */}
      {showFilters && (
        <DocumentGalleryFilters
          filters={filters}
          sort={sort}
          onFiltersChange={updateFilters}
          onSortChange={updateSort}
          isLoading={isLoading}
          documentStats={stats}
        />
      )}

      {/* Results Info */}
      {!isLoading && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            {totalCount > 0 ? (
              `Found ${totalCount} document${totalCount === 1 ? '' : 's'}`
            ) : (
              'No documents found'
            )}
          </div>
          
          {isLoading && (
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Loading...</span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {error ? (
        renderError()
      ) : isLoading ? (
        renderLoadingSkeletons()
      ) : documents.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          {renderDocuments()}
          {renderPagination()}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>
                  Are you sure you want to delete <span className="font-semibold">{documentToDelete?.name}</span>?
                </p>
                {documentToDelete?.size && (
                  <p className="text-sm text-gray-600">
                    File size: <span className="font-medium">{formatFileSize(documentToDelete.size)}</span> will be freed from storage
                  </p>
                )}
                <p className="text-sm font-medium text-red-600">
                  ⚠️ This action cannot be undone and will permanently remove:
                </p>
                <ul className="text-sm text-gray-600 list-disc list-inside ml-2">
                  <li>The document file from storage</li>
                  <li>All extracted text and metadata</li>
                  <li>Any generated templates or outputs</li>
                  <li>Processing history and analytics</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDeleteDocument} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteDocument}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Document'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}