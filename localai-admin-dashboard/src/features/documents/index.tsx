import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Zap, 
  History, 
  Download,
  Eye,
  Plus,
  Upload,
  Sparkles
} from 'lucide-react';
import { TemplateGallery } from './components/TemplateGallery';
import { CreateTemplateModal } from './components/CreateTemplateModal';
import { ProcessedDocumentsService, ProcessedDocument } from './services/processed-documents-service';
import { useQuery } from '@tanstack/react-query';

// Define interfaces
interface SmartVariable {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage';
  description: string;
  extraction_hints: string[];
  default_value?: string | number;
}

interface SmartTemplate {
  id: number;
  uuid: string;
  name: string;
  description: string;
  template_content: string;
  smart_variables: SmartVariable[];
  category: string;
}

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<'gallery' | 'history'>('gallery');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load real processed documents from Supabase
  const { 
    data: processedDocuments = [], 
    isLoading: isLoadingDocuments, 
    error: documentsError 
  } = useQuery({
    queryKey: ['processedDocuments'],
    queryFn: ProcessedDocumentsService.getProcessedDocuments,
  });

  const handleTemplateSelect = useCallback((template: SmartTemplate) => {
    // Navigate to the document processor route with template data
    console.log('Navigating to /documents/process-document with template:', template.name, 'ID:', template.id);
    navigate({ 
      to: '/documents/process-document',
      search: { templateId: template.id }
    });
  }, [navigate]);

  const handleCreateTemplate = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const downloadDocument = useCallback(async (document: ProcessedDocument) => {
    try {
      // Use the export functionality from the service
      const blob = await ProcessedDocumentsService.exportDocument(document.id, 'json');
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.name.replace(/\.[^/.]+$/, '')}_processed.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download document:', error);
      // Fallback to simple content download
      const content = document.content_text || 'No content available';
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.name}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const getStatusColor = useCallback((status?: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const getDocumentPreview = useCallback((document: ProcessedDocument) => {
    if (document.extracted_fields) {
      // Show extracted fields preview
      const fieldCount = Object.keys(document.extracted_fields).length;
      return `${fieldCount} fields extracted from ${document.name}`;
    }
    return document.content_text?.substring(0, 100) || 'No content preview available';
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Document Automation</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Create intelligent documents using AI-powered templates</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCreateTemplate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate({ to: '/documents/upload' })}
            className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 border-purple-200 dark:border-purple-800 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900 dark:hover:to-blue-900"
          >
            <Sparkles className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-400" />
            Smart Upload
          </Button>
          <Button onClick={() => setCurrentView('gallery')}>
            <Zap className="h-4 w-4 mr-2" />
            Browse Templates
          </Button>
        </div>
      </div>

      <CreateTemplateModal open={isModalOpen} onOpenChange={setIsModalOpen} />

      {/* Main Content Tabs */}
      <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as typeof currentView)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gallery" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Template Gallery
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Generated Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gallery" className="space-y-6">
          <TemplateGallery
            onSelectTemplate={handleTemplateSelect}
            onCreateTemplate={handleCreateTemplate}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Generated Documents
              </CardTitle>
              <CardDescription>
                Your recently generated documents and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingDocuments ? (
                <div className="text-center py-8">
                  <div className="animate-pulse">Loading documents...</div>
                </div>
              ) : documentsError ? (
                <div className="text-center py-8 text-red-600">
                  <p>Error loading documents: {documentsError.message}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {processedDocuments.map((document) => (
                    <div key={document.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900">
                            {document.template_name || document.name}
                          </h4>
                          <Badge className={getStatusColor(document.processing_status)}>
                            {document.processing_status || 'completed'}
                          </Badge>
                          {document.processing_method && (
                            <Badge variant="outline" className="text-xs">
                              {document.processing_method}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          Processed on {formatDate(document.created_at)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {getDocumentPreview(document)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(document.processing_status === 'completed' || !document.processing_status) && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate({ to: `/documents/${document.id}` })}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => downloadDocument(document)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {document.processing_status === 'processing' && (
                          <div className="text-sm text-blue-600">Processing...</div>
                        )}
                        {document.processing_status === 'failed' && (
                          <div className="text-sm text-red-600">Failed</div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {processedDocuments.length === 0 && (
                    <div className="text-center py-8">
                      <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Generated</h3>
                      <p className="text-gray-600 mb-4">Start by selecting a template and processing a document</p>
                      <Button onClick={() => setCurrentView('gallery')}>
                        <Zap className="h-4 w-4 mr-2" />
                        Get Started
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}