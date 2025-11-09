import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
// import { useNavigate } from '@tanstack/react-router'; // currently unused
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced';
import { WorkflowClient } from '@/lib/workflow-client';
import { templateService } from '@/services/template-service';
import { UnifiedTemplate, isSmartTemplate } from '@/types/unified-template';

// Define TemplateSource type
type TemplateSource = 'smart' | 'standard' | 'workflow' | 'gallery';
// ProcessedDocumentsService functionality moved to UnifiedDocumentService
// import { useDocumentManager } from '@/hooks/use-document-manager';
// import { UploadSource } from '@/services/unified-document-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle, XCircle, FileText, Users, Settings } from 'lucide-react';
import { ProgressiveExtractionDisplay } from './ProgressiveExtractionDisplay';
import { WorkflowFileUpload } from './WorkflowFileUpload';
import {
  ProcessedDocument,
  TemplateExtractionResult,
  ProgressiveExtractionResult,
  ExtractedField,
} from '@/types/extraction';
import { useQuery } from '@tanstack/react-query';


interface WorkflowExecutionState {
  isExecuting: boolean;
  progress: number;
  status: string;
  result?: unknown;
  error?: string;
}

interface DocumentWorkflowProps {
  selectedTemplateId?: string | number;
  templateSource?: TemplateSource;
}

export function DocumentWorkflow({ selectedTemplateId, templateSource }: DocumentWorkflowProps = {}) {
  // const navigate = useNavigate(); // reserved for future navigation actions
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedDocument, setProcessedDocument] = useState<ProcessedDocument | null>(null);
  const [templateExtractionResult, setTemplateExtractionResult] = useState<TemplateExtractionResult | null>(null);
  const [progressiveResult, setProgressiveResult] = useState<ProgressiveExtractionResult | null>(null);
  const [useProgressiveExtraction, setUseProgressiveExtraction] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [workflowExecution, setWorkflowExecution] = useState<WorkflowExecutionState>({
    isExecuting: false,
    progress: 0,
    status: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [showStructure, setShowStructure] = useState({
    headings: true,
    tables: false,
    images: false,
  });
  // Simple in-memory log lines accumulated during progressive extraction
  const [progressLogs, setProgressLogs] = useState<string[]>([]);
  // Instrumentation for E2E visibility
  const [processingStarted, setProcessingStarted] = useState(false);
  const [progressUpdateCount, setProgressUpdateCount] = useState(0);
  const [genericProcessingStarted, setGenericProcessingStarted] = useState(false);
  const [heartbeatTicks, setHeartbeatTicks] = useState(0);
  const [backendHealthy, setBackendHealthy] = useState(true);
  // Added instrumentation states (A & B requirements)
  const [extractionMode, setExtractionMode] = useState<string | null>(null); // 'template-progressive' | 'template-standard' | 'generic'
  const [fileChecksum, setFileChecksum] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const heartbeatRef = useRef<number | null>(null);

  // Constants
  const MAX_LOG_LINES = 200;

  useEffect(() => {
    return () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    };
  }, []);

  const documentProcessor = useMemo(() => new DocumentProcessorEnhanced(), []);

  // Load template data if templateId is provided
  const { 
    data: template, 
    isLoading: isTemplateLoading, 
    error: templateError 
  } = useQuery<UnifiedTemplate | null>({
    queryKey: ['unified-template', selectedTemplateId, templateSource],
    queryFn: async (): Promise<UnifiedTemplate | null> => {
      if (!selectedTemplateId) return null;
      return await templateService.getTemplate(Number(selectedTemplateId)) as unknown as UnifiedTemplate;
    },
    enabled: !!selectedTemplateId,
  });

  // Helper function to save processed document to database
  const saveProcessedDocument = useCallback(async (
    _file: File,
    _result: unknown,
    _method: 'template_guided' | 'generic' | 'progressive'
  ): Promise<{ id: string }> => {
    // Placeholder: return stub id so navigation guard passes
    return { id: 'stub-id' };
  }, []);

  // --- Logging helper (gated) ---
  const debugLog = useCallback((...args: unknown[]) => {
    const viteEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
    if (viteEnv?.VITE_E2E_DEBUG || (process.env && (process.env as Record<string, string | undefined>).E2E_DEBUG)) {
      // eslint-disable-next-line no-console
      console.log('[DocumentWorkflow]', ...args);
    }
  }, []);

  const resetStateForNewFile = (f: File) => {
    setFile(f);
    setError(null);
    setProcessedDocument(null);
    setTemplateExtractionResult(null);
    setProgressiveResult(null);
    setSelectedTemplate(null);
    setIsProcessing(true);
    setProgressLogs([]);
    setProcessingStarted(true);
    setProgressUpdateCount(0);
    setGenericProcessingStarted(false);
    setExtractionMode(null);
    setCorrelationId(null);
    if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    heartbeatRef.current = window.setInterval(() => setHeartbeatTicks(t => t + 1), 5000);
  };

  const finalizeProcessing = () => {
    setIsProcessing(false);
    if (heartbeatRef.current) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  const consumeProgressiveGenerator = async (
    gen: AsyncGenerator<ProgressiveExtractionResult, TemplateExtractionResult, unknown>
  ) => {
    let updateCount = 0;
    let lastSnapshot: ProgressiveExtractionResult | null = null;
    for await (const snapshot of gen) {
      updateCount++;
      lastSnapshot = snapshot;
      setProgressiveResult(snapshot);
      setProgressLogs(prev => [
        ...prev,
        `UPDATE ${updateCount} fields:${Object.keys(snapshot.fieldProgress).length} complete:${snapshot.isComplete ? 'yes' : 'no'}`
      ].slice(-MAX_LOG_LINES));
      setProgressUpdateCount(updateCount);
      await new Promise(r => setTimeout(r, 40)); // small delay guard
    }
  setProgressLogs(prev => [...prev, 'COMPLETED'].slice(-MAX_LOG_LINES));
    if (lastSnapshot?.isComplete) {
      const extractedFields: Record<string, ExtractedField> = {};
      Object.entries(lastSnapshot.fieldProgress).forEach(([k, v]) => {
        if (v.result) extractedFields[k] = v.result;
      });
      if (Object.keys(extractedFields).length > 0) {
        setTemplateExtractionResult({
          content: lastSnapshot.content,
          metadata: lastSnapshot.metadata,
          structure: lastSnapshot.structure,
          template: lastSnapshot.template,
          extractedFields
        });
        // If backend embedded correlation id in metadata during progressive path
        const cid = (lastSnapshot.metadata as Record<string, unknown>)?.correlationId as string | undefined;
        if (cid) setCorrelationId(cid);
      }
    }
  };

  const processWithTemplate = useCallback(async (f: File, tmpl: UnifiedTemplate) => {
      const isSmart = isSmartTemplate(tmpl);
      debugLog('Template detected. smart?', isSmart, 'progressive?', useProgressiveExtraction);
      if (useProgressiveExtraction && isSmart) {
        debugLog('Starting progressive extraction');
        setExtractionMode('template-progressive');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SmartTemplate type not exported from processor module
  const gen = documentProcessor.processDocumentWithTemplateProgressive(f, tmpl as any) as AsyncGenerator<ProgressiveExtractionResult, TemplateExtractionResult, unknown>;
  await consumeProgressiveGenerator(gen);
      } else {
        debugLog('Starting standard template extraction');
        setExtractionMode('template-standard');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await documentProcessor.processDocumentWithTemplate(f, tmpl as any);
  setTemplateExtractionResult(result as TemplateExtractionResult);
        const cid = (result.metadata as Record<string, unknown>)?.correlationId as string | undefined;
        if (cid) setCorrelationId(cid);
        await saveProcessedDocument(f, result, 'template_guided');
      }
    }, [useProgressiveExtraction, documentProcessor, saveProcessedDocument, debugLog]);

  const processGeneric = useCallback(async (f: File) => {
      setGenericProcessingStarted(true);
      debugLog('Starting generic docling processing');
      setExtractionMode('generic');
      const result = await documentProcessor.processDocumentWithDocling(f);
      setProcessedDocument(result);
      const cid = (result.metadata as Record<string, unknown>)?.correlationId as string | undefined;
      if (cid) setCorrelationId(cid);
      await saveProcessedDocument(f, result, 'generic');
    }, [documentProcessor, saveProcessedDocument, debugLog]);

  // Backend health probe
  const checkBackendHealth = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('http://localhost:8090/health', { method: 'GET', signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    resetStateForNewFile(selectedFile);
    // Compute checksum early (B requirement) – ignore errors silently
    (async () => {
      try {
        const buf = await selectedFile.arrayBuffer();
        const hash = await crypto.subtle.digest('SHA-256', buf);
        const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        setFileChecksum(hex);
      } catch { /* no-op */ }
    })();
    try {
      // Early backend health gate
      const healthy = await checkBackendHealth();
      setBackendHealthy(healthy);
      if (!healthy) {
        debugLog('Backend health check failed - aborting processing');
        setError('Backend service unavailable. Please try again shortly.');
        finalizeProcessing();
        return;
      }
      debugLog('File selected for processing', { name: selectedFile.name, size: selectedFile.size, hasTemplate: !!template });
      if (template) {
        await processWithTemplate(selectedFile, template);
      } else {
        await processGeneric(selectedFile);
      }
    } catch (err) {
      debugLog('Processing error', err);
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      finalizeProcessing();
    }
  // Dependencies intentionally limited: template & handlers capture other stable refs
  }, [template, processWithTemplate, processGeneric, debugLog, checkBackendHealth]);

  const handleTemplateSelection = useCallback((templateId: string) => {
    setSelectedTemplate(templateId);
  }, []);

  const handleWorkflowExecution = useCallback(async () => {
    if (!processedDocument || !selectedTemplate) return;

    setWorkflowExecution({
      isExecuting: true,
      progress: 0,
      status: 'Executing workflow...',
    });

    try {
      // Simulate progress updates
      setWorkflowExecution(prev => ({ ...prev, progress: 25, status: 'Initializing workflow...' }));
      
      const result = await WorkflowClient.executeWorkflow({
        templateId: selectedTemplate,
        documentData: processedDocument,
        parameters: {},
      });

      setWorkflowExecution(prev => ({ ...prev, progress: 75, status: 'Processing results...' }));

      // Final completion
      setWorkflowExecution({
        isExecuting: false,
        progress: 100,
        status: 'Workflow completed',
        result,
      });
    } catch (err) {
      setWorkflowExecution({
        isExecuting: false,
        progress: 0,
        status: '',
        error: err instanceof Error ? err.message : 'Workflow execution failed',
      });
    }
  }, [processedDocument, selectedTemplate]);

  const toggleStructureSection = useCallback((section: keyof typeof showStructure) => {
    setShowStructure(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const getSelectedTemplateName = useCallback(() => {
    if (!selectedTemplate || !processedDocument) return '';
    const t = processedDocument.templateSuggestions.find(ts => ts.templateId === selectedTemplate);
    return t?.templateName || '';
  }, [selectedTemplate, processedDocument]);

  // Safe indentation utility (Tailwind can't generate dynamic classes reliably)
  const headingIndentClass = (level: number) => {
    const map: Record<number, string> = { 1: 'pl-2', 2: 'pl-4', 3: 'pl-6', 4: 'pl-8', 5: 'pl-10', 6: 'pl-12' };
    return map[Math.min(6, Math.max(1, level))];
  };

  return (
    <div data-testid="document-workflow-root">
      {processingStarted && (
        <div data-testid="processing-init" className="hidden" />
      )}
      {progressUpdateCount > 0 && (
        <div data-testid="processing-heartbeat" data-updates={progressUpdateCount} data-ticks={heartbeatTicks} className="hidden" />
      )}
      {genericProcessingStarted && (
        <div data-testid="processing-generic-started" className="hidden" />
      )}
      {processingStarted && !backendHealthy && (
        <div data-testid="processing-backend-unhealthy" className="hidden" />
      )}
      {extractionMode && (
        <div data-testid="extraction-mode" data-mode={extractionMode} className="hidden" />
      )}
      {fileChecksum && (
        <div data-testid="file-checksum" data-value={fileChecksum} className="hidden" />
      )}
      {correlationId && (
        <div data-testid="correlation-id" data-value={correlationId} className="hidden" />
      )}
      {progressiveResult?.isComplete && (
        <div data-testid="progressive-complete" className="hidden" />
      )}
        <div className="flex items-center gap-2">
          
          
        </div>
        
        <Separator className="shadow-sm" />

      {/* Template Information */}
      {selectedTemplateId && (
        <div className="space-y-4">
          {isTemplateLoading && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Loading template...</span>
                </div>
              </CardContent>
            </Card>
          )}

          {templateError && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <span>Error loading template: {templateError.message}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {template && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <FileText className="w-6 h-6 text-blue-600" />
                      {template.name}
                    </CardTitle>
                    <p className="text-muted-foreground mt-1">{template.description}</p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Badge variant="secondary">
                      {template.category}
                    </Badge>
                    <Badge variant={isSmartTemplate(template) ? "default" : "outline"}>
                      {isSmartTemplate(template) ? "Smart Template" : "Standard"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Template Stats */}
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{template.usage_count} uses</span>
                  </div>
                </div>

                {/* Tags */}
                {template.tags && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {template.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Smart Variables */}
                {isSmartTemplate(template) && template.smart_variables.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-foreground mb-3">
                      Template Fields ({template.smart_variables.length} fields):
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {template.smart_variables.map((variable) => (
                        <div key={variable.id} className="bg-muted p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-foreground">
                              {variable.name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {variable.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{variable.description}</p>
                          {variable.extraction_hints && variable.extraction_hints.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Hints: {variable.extraction_hints.join(', ')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Template Preview */}
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                  <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100 mb-2">Template Preview:</h4>
                  <div className="bg-background p-3 rounded text-sm font-mono max-h-32 overflow-y-auto border">
                    {isSmartTemplate(template) ? template.template_content : ''}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Extraction Settings */}
      {selectedTemplateId && template && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Extraction Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="progressive"
                checked={useProgressiveExtraction}
                onCheckedChange={(checked) => setUseProgressiveExtraction(checked === true)}
                disabled={!isSmartTemplate(template)}
              />
              <label htmlFor="progressive" className="text-sm font-medium">
                Enable progressive field extraction
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              {isSmartTemplate(template) 
                ? "See extraction progress in real-time as each field is processed"
                : "Progressive extraction is only available for Smart Templates"
              }
            </p>
            
            {isSmartTemplate(template) && (
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Smart Template Features:</strong> AI-powered extraction with confidence scores, 
                  source attribution, and advanced validation.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* File Upload */}
      <WorkflowFileUpload 
        file={file}
        isProcessing={isProcessing}
        onFileUpload={handleFileUpload}
      />

      {/* Processing Status */}
      {isProcessing && (
        <Card data-testid="document-processing-status">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span data-testid="document-processing-status-text">Processing document...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progressive Extraction Log Lines */}
      {progressLogs.length > 0 && (
        <Card data-testid="processing-logs">
          <CardHeader>
            <CardTitle className="text-sm">Processing Logs ({progressLogs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto space-y-1 text-xs font-mono">
              {progressLogs.map((line, idx) => (
                <div
                  key={idx}
                  data-testid="processing-log-line"
                  className="whitespace-pre-wrap"
                >
                  {line}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Progressive Extraction Results */}
      {progressiveResult && (
        <div className="space-y-6" data-testid="document-evaluation">
          <ProgressiveExtractionDisplay progressiveResult={progressiveResult} />
          
          {/* Document Content (for progressive results) */}
          {progressiveResult.content && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Document Content
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg max-h-60 overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap">{progressiveResult.content}</pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Template Extraction Results */}
      {templateExtractionResult && !progressiveResult && (
  <div className="space-y-6" data-testid="document-processed">
          {/* Extracted Fields */}
          <Card data-testid="extracted-fields">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Extracted Template Fields
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(templateExtractionResult.extractedFields).map(([fieldName, field]) => {
                  const variable = templateExtractionResult.template.smart_variables.find(v => v.name === fieldName);
                  const confidenceColor = field.confidence >= 0.8 ? 'text-green-600 dark:text-green-400' : 
                                        field.confidence >= 0.6 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
                  const confidenceLabel = field.confidence >= 0.8 ? 'High' : 
                                        field.confidence >= 0.6 ? 'Medium' : 'Low';
                  
                  return (
                    <div key={fieldName} className="border rounded-lg p-4 bg-muted" data-testid="extracted-field">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{fieldName}</span>
                          {variable && (
                            <Badge variant="outline" className="text-xs">
                              {variable.type}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${confidenceColor}`}>
                            {confidenceLabel}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(field.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="bg-background p-3 rounded border mb-2">
                        <span className="text-sm font-mono">{String(field.value)}</span>
                      </div>
                      
                      {variable && (
                        <p className="text-xs text-muted-foreground mb-2">{variable.description}</p>
                      )}
                      
                      {field.sourceText && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Source: </span>
                          <span className="italic">"{field.sourceText}"</span>
                        </div>
                      )}
                      
                      {field.location && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {field.location.page && `Page ${field.location.page}`}
                          {field.location.position && ` • Position ${field.location.position}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Document Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Document Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg max-h-60 overflow-y-auto">
                <pre className="text-sm whitespace-pre-wrap">{templateExtractionResult.content}</pre>
              </div>
            </CardContent>
          </Card>

          {/* Document Structure */}
          <Card>
            <CardHeader>
              <CardTitle>Document Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Headings */}
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleStructureSection('headings')}
                    className="mb-2"
                  >
                    Headings ({templateExtractionResult.structure.headings.length})
                  </Button>
                  {showStructure.headings && (
                    <div className="space-y-2 ml-4">
                      {templateExtractionResult.structure.headings.map((heading) => {
                        const key = `${heading.text}-${heading.position}`;
                        return (
                          <div key={key} className={`${headingIndentClass(heading.level)} py-1 font-medium`}>{heading.text}</div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Tables */}
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleStructureSection('tables')}
                    className="mb-2"
                  >
                    Tables ({templateExtractionResult.structure.tables.length})
                  </Button>
                  {showStructure.tables && (
                    <div className="space-y-2 ml-4">
                      {templateExtractionResult.structure.tables.map((table, index) => (
                        <div key={index} className="text-sm text-muted-foreground">
                          Table {index + 1}: {table.rows} rows, {table.columns} columns
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Images */}
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleStructureSection('images')}
                    className="mb-2"
                  >
                    Images ({templateExtractionResult.structure.images.length})
                  </Button>
                  {showStructure.images && (
                    <div className="space-y-2 ml-4">
                      {templateExtractionResult.structure.images.map((image, index) => (
                        <div key={index} className="text-sm text-muted-foreground">
                          {image.alt || `Image ${index + 1}`}
                          {image.dimensions && (
                            <span className="ml-2">
                              ({image.dimensions.width}x{image.dimensions.height})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Processed Document Results (Generic Processing) */}
      {processedDocument && !templateExtractionResult && (
        <div className="space-y-6" data-testid="generic-processed-document">
          {/* Document Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {processedDocument.metadata.title || 'Processed Document'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-semibold">Format:</span>
                  <div>{processedDocument.metadata.format}</div>
                </div>
                {processedDocument.metadata.pages && (
                  <div>
                    <span className="font-semibold">Pages:</span>
                    <div>{processedDocument.metadata.pages}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Template Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle>Template Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {processedDocument.templateSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.templateId}
                    className={`p-4 border rounded-lg ${
                      selectedTemplate === suggestion.templateId
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{suggestion.templateName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary">
                            {Math.round(suggestion.confidence * 100)}%
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {suggestion.matchReasons.join(', ')}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant={selectedTemplate === suggestion.templateId ? "default" : "outline"}
                        onClick={() => handleTemplateSelection(suggestion.templateId)}
                        aria-label={`Select ${suggestion.templateName}`}
                      >
                        {selectedTemplate === suggestion.templateId ? 'Selected' : 'Select'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Document Structure */}
          <Card>
            <CardHeader>
              <CardTitle>Document Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Headings */}
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleStructureSection('headings')}
                    className="mb-2"
                  >
                    Headings ({processedDocument.structure.headings.length})
                  </Button>
                  {showStructure.headings && (
                    <div className="space-y-2 ml-4">
                      {processedDocument.structure.headings.map((heading) => {
                        const key = `${heading.text}-${heading.position}`;
                        return (
                          <div key={key} className={`${headingIndentClass(heading.level)} py-1 font-medium`}>{heading.text}</div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Tables */}
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleStructureSection('tables')}
                    className="mb-2"
                    aria-label="Toggle tables"
                  >
                    Tables ({processedDocument.structure.tables.length})
                  </Button>
                  {showStructure.tables && (
                    <div className="space-y-2 ml-4">
                      {processedDocument.structure.tables.map((table, index) => (
                        <div key={index} className="text-sm text-muted-foreground">
                          Table {index + 1}: {table.rows} rows, {table.columns} columns
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Images */}
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleStructureSection('images')}
                    className="mb-2"
                  >
                    Images ({processedDocument.structure.images.length})
                  </Button>
                  {showStructure.images && (
                    <div className="space-y-2 ml-4">
                      {processedDocument.structure.images.map((image, index) => (
                        <div key={index} className="text-sm text-muted-foreground">
                          {image.alt || `Image ${index + 1}`}
                          {image.dimensions && (
                            <span className="ml-2">
                              ({image.dimensions.width}x{image.dimensions.height})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Template Display */}
          {selectedTemplate && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Selected template: {getSelectedTemplateName()}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Workflow Execution */}
          {selectedTemplate && (
            <Card>
              <CardHeader>
                <CardTitle>Execute Workflow</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!workflowExecution.isExecuting && !workflowExecution.result && !workflowExecution.error && (
                    <Button
                      onClick={handleWorkflowExecution}
                      className="w-full"
                      aria-label="Execute workflow"
                    >
                      Execute Workflow with {getSelectedTemplateName()}
                    </Button>
                  )}

                  {workflowExecution.isExecuting && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Executing workflow...</span>
                      </div>
                      <Progress value={workflowExecution.progress} className="w-full" />
                      <div className="text-sm text-muted-foreground">{workflowExecution.status}</div>
                    </div>
                  )}

                  {workflowExecution.result !== undefined && workflowExecution.result !== null && (
                    <Alert>
                      <CheckCircle className="w-4 h-4" />
                      <AlertDescription>
                        {`Workflow completed successfully! Result: ${(() => {
                          try {
                            return JSON.stringify(workflowExecution.result);
                          } catch {
                            return String(workflowExecution.result);
                          }
                        })()}`}
                      </AlertDescription>
                    </Alert>
                  )}

                  {workflowExecution.error && (
                    <Alert variant="destructive">
                      <XCircle className="w-4 h-4" />
                      <AlertDescription>{workflowExecution.error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
