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
import { UnifiedDocumentService, DocumentStatus } from '@/services/unified-document-service';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';

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

  /**
   * Handle navigation back to documents list
   */
  const handleBack = () => {
    navigate({ to: '/documents' });
  };

  /**
   * Handle document download in specified format
   * @param format - Export format (json, txt, csv, html, docx)
   */
  const handleDownload = async (format: 'json' | 'txt' | 'csv' | 'html' | 'docx') => {
    // Export functionality needs to be implemented in UnifiedDocumentService
    // For now, we'll create a simple text export
    const docRecord = await UnifiedDocumentService.getDocumentById(documentId);
    if (!docRecord) throw new Error('Document not found');

    let content = '';
    if (format === 'json') {
      content = JSON.stringify(docRecord, null, 2);
    } else {
      content = docRecord.content_text || 'No content available';
    }
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `document_${documentId}.${format}`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * Handle save of edited content
   * @param content - The edited HTML content
   */
  const handleSave = async (content: string) => {
    await UnifiedDocumentService.updateDocumentStatus(documentId, {
      status: DocumentStatus.COMPLETED,
      content_text: content,
      metadata: {
        last_edited_at: new Date().toISOString(),
        edited_by: 'user'
      }
    });
  };

  return (
    <>
      <Header />
      <Main>
        <DocumentDetailView
          documentId={documentId}
          onBack={handleBack}
          onDownload={handleDownload}
          onSave={handleSave}
        />
      </Main>
    </>
  );
}