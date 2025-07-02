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
  Plus
} from 'lucide-react';
import { TemplateGallery } from './components/TemplateGallery';

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

interface GeneratedDocument {
  id: string;
  template_name: string;
  content: string;
  created_at: string;
  status: 'completed' | 'processing' | 'failed';
}

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<'gallery' | 'history'>('gallery');
  const [generatedDocuments] = useState<GeneratedDocument[]>([]);

  // Mock data for recent documents
  const recentDocuments: GeneratedDocument[] = [
    {
      id: '1',
      template_name: 'Project Proposal',
      content: 'Generated project proposal content...',
      created_at: '2024-01-15T10:30:00Z',
      status: 'completed'
    },
    {
      id: '2', 
      template_name: 'Marketing Brief',
      content: 'Generated marketing brief content...',
      created_at: '2024-01-15T09:15:00Z',
      status: 'completed'
    },
    {
      id: '3',
      template_name: 'Contract Template',
      content: 'Processing...',
      created_at: '2024-01-15T11:00:00Z',
      status: 'processing'
    }
  ];

  const handleTemplateSelect = useCallback((template: SmartTemplate) => {
    // Navigate to the document processor route with template data
    console.log('Navigating to /documents/process-document with template:', template.name);
    navigate({ 
      to: '/documents/process-document',
      search: { templateId: template.id.toString() }
    });
  }, [navigate]);

  const handleCreateTemplate = useCallback(() => {
    // TODO: Implement template creation modal
    console.log('Create new template'); // eslint-disable-line no-console
  }, []);

  const downloadDocument = useCallback((document: GeneratedDocument) => {
    const blob = new Blob([document.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${document.template_name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
          <Button onClick={() => setCurrentView('gallery')}>
            <Zap className="h-4 w-4 mr-2" />
            Start Processing
          </Button>
        </div>
      </div>

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
              <div className="space-y-4">
                {[...generatedDocuments, ...recentDocuments].map((document) => (
                  <div key={document.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{document.template_name}</h4>
                        <Badge className={getStatusColor(document.status)}>
                          {document.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        Generated on {formatDate(document.created_at)}
                      </p>
                      {document.status === 'completed' && (
                        <p className="text-xs text-gray-500 mt-1">
                          {document.content.substring(0, 100)}...
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {document.status === 'completed' && (
                        <>
                          <Button variant="outline" size="sm">
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
                      {document.status === 'processing' && (
                        <div className="text-sm text-blue-600">Processing...</div>
                      )}
                    </div>
                  </div>
                ))}
                
                {generatedDocuments.length === 0 && recentDocuments.length === 0 && (
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 