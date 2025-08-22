/**
 * Document Detail Route
 * 
 * Route handler for displaying detailed view of a processed document.
 * Accessible at /documents/{documentId}
 * 
 * Features:
 * - Document metadata and processing information
 * - Extracted fields with confidence scores
 * - AI enhancement details (if available)
 * - Content viewing and export functionality
 * - Navigation back to documents list
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { DocumentDetailView } from '@/features/documents/components/DocumentDetailView';
import { ProcessedDocumentsService } from '@/features/documents/services/processed-documents-service';

// Route search params validation
interface DocumentDetailSearch {
  tab?: 'overview' | 'extracted-fields' | 'content' | 'ai-analysis';
  debug?: boolean;
}

export const Route = createFileRoute('/_authenticated/documents/$documentId')({
  // Validate route parameters
  validateSearch: (search: Record<string, unknown>): DocumentDetailSearch => ({
    tab: search.tab as DocumentDetailSearch['tab'],
    debug: search.debug === 'true' || search.debug === true,
  }),

  // Page component
  component: DocumentDetailPage,

  // Error boundary
  errorComponent: ({ error }) => (
    <div className="container mx-auto p-6">
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Document</h1>
        <p className="text-gray-600 mb-4">
          {error.message || 'An unexpected error occurred while loading the document.'}
        </p>
        <button 
          onClick={() => window.location.href = '/documents'}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Back to Documents
        </button>
      </div>
    </div>
  ),

  // Not found component
  notFoundComponent: () => (
    <div className="container mx-auto p-6">
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Document Not Found</h1>
        <p className="text-gray-600 mb-4">
          The document you're looking for doesn't exist or you don't have permission to view it.
        </p>
        <button 
          onClick={() => window.location.href = '/documents'}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Back to Documents
        </button>
      </div>
    </div>
  ),
});

function DocumentDetailPage() {
  const navigate = useNavigate();
  const { documentId } = Route.useParams();
  const { tab, debug } = Route.useSearch();

  /**
   * Handle navigation back to documents list
   */
  const handleBack = () => {
    navigate({ to: '/documents/gallery' });
  };

  /**
   * Handle document download in specified format
   * @param format - Export format (json, txt, csv, html, docx)
   */
  const handleDownload = async (format: 'json' | 'txt' | 'csv' | 'html' | 'docx') => {
    try {
      const blob = await ProcessedDocumentsService.exportDocument(documentId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document_${documentId}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Could show toast notification here
    }
  };

  /**
   * Handle save of edited content
   * @param content - The edited HTML content
   */
  const handleSave = async (content: string) => {
    try {
      await ProcessedDocumentsService.updateDocument(documentId, {
        processed_content: content,
        metadata: {
          ...((await ProcessedDocumentsService.getDocument(documentId))?.metadata || {}),
          last_edited: new Date().toISOString(),
          edited_by: 'user'
        }
      });
      // Could show toast notification here
    } catch (error) {
      console.error('Save failed:', error);
      // Could show error toast here
    }
  };

  return (
    <DocumentDetailView
      documentId={documentId}
      onBack={handleBack}
      onDownload={handleDownload}
      onSave={handleSave}
    />
  );
}