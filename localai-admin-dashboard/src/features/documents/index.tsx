import { useState, useCallback, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Zap,
  Download,
  Eye,
  Plus,
  Sparkles,
  Image,
  Upload,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  FileUp,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ProfileDropdown } from '@/components/profile-dropdown';
import { Search } from '@/components/search';
import { ThemeSwitch } from '@/components/theme-switch';
import { CreateTemplateModal } from './components/CreateTemplateModal';
import { UnifiedDocumentService, DocumentRecord } from '@/services/unified-document-service';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

export interface TemplateSelectionItem {
  id: string | number;
  name: string;
  description: string;
  type: 'smart' | 'standard' | 'workflow';
  category: string;
  source: 'smart' | 'standard' | 'workflow' | 'gallery';
  tags: string[];
  usageCount: number;
  rating: number;
  isSmartTemplate: boolean;
  variableCount: number;
}

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load real processed documents from Supabase
  const {
    data: processedDocuments = [],
    isLoading: isLoadingDocuments,
    error: documentsError,
  } = useQuery({
    queryKey: ['processedDocuments'],
    queryFn: UnifiedDocumentService.getUserDocuments,
  });

  const handleCreateTemplate = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  // ── Drop zone handlers ──────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        // Navigate to upload page – the file will be passed via state
        navigate({
          to: '/documents/upload',
          search: { droppedFile: files[0].name },
        });
      }
    },
    [navigate]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        navigate({ to: '/documents/upload' });
      }
    },
    [navigate]
  );

  // ── Helpers ──────────────────────────────────────────────────────
  const downloadDocument = useCallback(async (document: DocumentRecord) => {
    try {
      const content = JSON.stringify(document, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.name.replace(/\.[^/.]+$/, '')}_processed.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_error) {
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
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const getStatusConfig = useCallback((status?: string) => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle2,
          color: 'text-emerald-600 dark:text-emerald-400',
          bg: 'bg-emerald-50 dark:bg-emerald-950/50',
          border: 'border-emerald-200 dark:border-emerald-800',
          label: 'Completed',
        };
      case 'processing':
        return {
          icon: Loader2,
          color: 'text-primary',
          bg: 'bg-primary/5',
          border: 'border-primary/20',
          label: 'Processing',
        };
      case 'failed':
        return {
          icon: AlertCircle,
          color: 'text-destructive',
          bg: 'bg-destructive/5',
          border: 'border-destructive/20',
          label: 'Failed',
        };
      default:
        return {
          icon: CheckCircle2,
          color: 'text-emerald-600 dark:text-emerald-400',
          bg: 'bg-emerald-50 dark:bg-emerald-950/50',
          border: 'border-emerald-200 dark:border-emerald-800',
          label: 'Completed',
        };
    }
  }, []);

  const getFieldCount = useCallback((document: DocumentRecord) => {
    const extracted = document.metadata?.extracted_fields;
    if (extracted && typeof extracted === 'object') {
      return Object.keys(extracted).length;
    }
    return 0;
  }, []);

  // Stats
  const totalDocs = processedDocuments.length;
  const completedDocs = processedDocuments.filter(
    (d) => d.processing_status === 'completed' || !d.processing_status
  ).length;
  const recentDocs = processedDocuments.slice(0, 8);

  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Document Automation</h1>
          <p className="text-muted-foreground mt-1">
            Create intelligent documents using AI-powered templates
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCreateTemplate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate({ to: '/documents/gallery' })}
          >
            <Image className="h-4 w-4 mr-2" />
            Document Gallery
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate({ to: '/documents/upload' })}
            className="border-primary/30 hover:border-primary/60 hover:bg-primary/5"
          >
            <Sparkles className="h-4 w-4 mr-2 text-primary" />
            Smart Upload
          </Button>
          <Button onClick={() => navigate({ to: '/templates' })}>
            <Zap className="h-4 w-4 mr-2" />
            Browse Templates
          </Button>
        </div>
      </div>

      <CreateTemplateModal open={isModalOpen} onOpenChange={setIsModalOpen} />

      {/* ── Quick Stats ──────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card/70">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Documents</p>
                <p className="text-2xl font-bold">{totalDocs}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/70">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Processed</p>
                <p className="text-2xl font-bold">{completedDocs}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/70">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fields Extracted</p>
                <p className="text-2xl font-bold">
                  {processedDocuments.reduce((acc, d) => acc + getFieldCount(d), 0)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/70">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">
                  {totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 100) : 0}%
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Drop Zone ────────────────────────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.pptx,.xlsx,.html,.htm,.txt,.md,.png,.jpg,.jpeg"
        onChange={handleFileSelect}
        className="hidden"
      />
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => navigate({ to: '/documents/upload' })}
        className={cn(
          'relative group cursor-pointer rounded-xl border-2 border-dashed p-8 transition-all duration-300',
          'hover:border-primary/60 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/5',
          isDragging
            ? 'border-primary bg-primary/10 scale-[1.01] shadow-lg shadow-primary/10'
            : 'border-border'
        )}
      >
        <div className="flex items-center gap-6">
          {/* Icon */}
          <div
            className={cn(
              'h-16 w-16 rounded-xl flex items-center justify-center transition-all duration-300',
              'bg-primary/10 group-hover:bg-primary/15',
              isDragging && 'bg-primary/20 scale-110'
            )}
          >
            <FileUp
              className={cn(
                'h-8 w-8 text-primary transition-transform duration-300',
                'group-hover:-translate-y-0.5',
                isDragging && '-translate-y-1'
              )}
            />
          </div>

          {/* Text */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold">
              {isDragging ? 'Drop your document here' : 'Drop a document to start processing'}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isDragging
                ? 'Release to upload and auto-detect the document type'
                : 'Drag & drop or click to upload — AI will auto-detect the type and match the best template'}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-muted-foreground/70">
                PDF, DOCX, PPTX, XLSX, Images, HTML, Markdown
              </span>
              <span className="text-xs text-muted-foreground/50">•</span>
              <span className="text-xs text-muted-foreground/70">Up to 10MB</span>
            </div>
          </div>

          {/* Action */}
          <Button
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10"
            onClick={(e) => {
              e.stopPropagation();
              navigate({ to: '/documents/upload' });
            }}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* ── Recent Activity ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </div>
            {totalDocs > 8 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: '/documents/gallery' })}
                className="text-muted-foreground hover:text-foreground"
              >
                View all {totalDocs} documents
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
          <CardDescription>
            Your recently processed documents and their results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingDocuments ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-primary animate-spin mr-3" />
              <span className="text-muted-foreground">Loading documents…</span>
            </div>
          ) : documentsError ? (
            <div className="flex items-center justify-center py-12 text-destructive">
              <AlertCircle className="h-5 w-5 mr-2" />
              Error loading documents: {documentsError.message}
            </div>
          ) : recentDocs.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 mx-auto rounded-xl bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-1">No documents yet</h3>
              <p className="text-muted-foreground mb-4">
                Drop a document above or click Smart Upload to get started
              </p>
              <Button
                onClick={() => navigate({ to: '/documents/upload' })}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Upload Your First Document
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDocs.map((document) => {
                const status = getStatusConfig(document.processing_status);
                const StatusIcon = status.icon;
                const fieldCount = getFieldCount(document);
                const templateName = document.metadata?.template_name;
                const processingMethod = document.metadata?.processing_method;

                return (
                  <div
                    key={document.id}
                    onClick={() => navigate({ to: `/documents/${document.id}` })}
                    className={cn(
                      'flex items-center gap-4 p-3 rounded-lg border cursor-pointer',
                      'transition-all duration-200',
                      'hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm',
                      'border-transparent bg-muted/30'
                    )}
                  >
                    {/* Status Icon */}
                    <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0', status.bg)}>
                      <StatusIcon
                        className={cn(
                          'h-4.5 w-4.5',
                          status.color,
                          document.processing_status === 'processing' && 'animate-spin'
                        )}
                      />
                    </div>

                    {/* Document Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {document.name}
                        </span>
                        {templateName && (
                          <Badge variant="outline" className="text-xs flex-shrink-0 font-normal">
                            {templateName}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {fieldCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {fieldCount} fields extracted
                          </span>
                        )}
                        {fieldCount > 0 && processingMethod && (
                          <span className="text-xs text-muted-foreground/50">•</span>
                        )}
                        {processingMethod && (
                          <span className="text-xs text-muted-foreground/70">{processingMethod}</span>
                        )}
                      </div>
                    </div>

                    {/* Timestamp + Actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(document.created_at)}
                      </span>
                      {(document.processing_status === 'completed' || !document.processing_status) && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate({ to: `/documents/${document.id}` });
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadDocument(document);
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
        </div>
      </Main>
    </>
  );
}