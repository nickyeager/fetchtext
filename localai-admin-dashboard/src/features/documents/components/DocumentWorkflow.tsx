import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced';
import { WorkflowClient } from '@/lib/workflow-client';
import { DocumentTemplateService } from '../services/template-service';
import { ProcessedDocumentsService } from '../services/processed-documents-service';
import { useDocumentManager } from '@/hooks/use-document-manager';
import { UploadSource } from '@/services/unified-document-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle, XCircle, FileText, Workflow, Users, Settings } from 'lucide-react';
import { ProgressiveExtractionDisplay } from './ProgressiveExtractionDisplay';
import { WorkflowFileUpload } from './WorkflowFileUpload';
import { useQuery } from '@tanstack/react-query';

interface ProcessedDocument {
  content: string;
  metadata: {
    title?: string;
    format: string;
    pages?: number;
    [key: string]: unknown;
  };
  structure: {
    headings: Array<{
      level: number;
      text: string;
      position: number;
    }>;
    tables: Array<{
      position: number;
      rows: number;
      columns: number;
    }>;
    images: Array<{
      position: number;
      alt?: string;
      dimensions?: {
        width: number;
        height: number;
      };
    }>;
  };
  templateSuggestions: Array<{
    templateId: string;
    templateName: string;
    confidence: number;
    matchReasons: string[];
  }>;
}

interface ExtractedField {
  value: any;
  confidence: number;
  sourceText?: string;
  location?: {
    page?: number;
    position?: number;
  };
}

interface TemplateExtractionResult {
  content: string;
  metadata: {
    title?: string;
    format: string;
    pages?: number;
    [key: string]: unknown;
  };
  structure: {
    headings: Array<{
      level: number;
      text: string;
      position: number;
    }>;
    tables: Array<{
      position: number;
      rows: number;
      columns: number;
    }>;
    images: Array<{
      position: number;
      alt?: string;
      dimensions?: {
        width: number;
        height: number;
      };
    }>;
  };
  extractedFields: Record<string, ExtractedField>;
  template: {
    id: number;
    name: string;
    smart_variables: Array<{
      id: string;
      name: string;
      type: string;
      description: string;
      extraction_hints: string[];
    }>;
  };
}

interface FieldExtractionProgress {
  fieldName: string;
  status: 'pending' | 'extracting' | 'analyzing' | 'completed' | 'failed';
  progress: number; // 0-100
  result?: ExtractedField;
  error?: string;
}

interface ProgressiveExtractionResult {
  content: string;
  metadata: {
    title?: string;
    format: string;
    pages?: number;
    [key: string]: unknown;
  };
  structure: {
    headings: Array<{
      level: number;
      text: string;
      position: number;
    }>;
    tables: Array<{
      position: number;
      rows: number;
      columns: number;
    }>;
    images: Array<{
      position: number;
      alt?: string;
      dimensions?: {
        width: number;
        height: number;
      };
    }>;
  };
  template: {
    id: number;
    name: string;
    smart_variables: Array<{
      id: string;
      name: string;
      type: string;
      description: string;
      extraction_hints: string[];
    }>;
  };
  fieldProgress: Record<string, FieldExtractionProgress>;
  isComplete: boolean;
}

interface WorkflowExecutionState {
  isExecuting: boolean;
  progress: number;
  status: string;
  result?: any;
  error?: string;
}

interface DocumentWorkflowProps {
  selectedTemplateId?: string | number;
}

export function DocumentWorkflow({ selectedTemplateId }: DocumentWorkflowProps = {}) {
  const navigate = useNavigate();
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

  const documentProcessor = useMemo(() => new DocumentProcessorEnhanced(), []);

  // Load template data if templateId is provided
  const { 
    data: template, 
    isLoading: isTemplateLoading, 
    error: templateError 
  } = useQuery({
    queryKey: ['template', selectedTemplateId],
    queryFn: () => DocumentTemplateService.getTemplateById(selectedTemplateId!),
    enabled: !!selectedTemplateId,
  });

  // Helper function to save processed document to database
  const saveProcessedDocument = useCallback(async (
    file: File, 
    result: any, 
    method: 'template_guided' | 'generic' | 'progressive'
  ) => {
    try {
      await ProcessedDocumentsService.saveProcessedDocument({
        name: file.name,
        file_path: `/uploads/${file.name}`, // This would be updated to real file path after upload
        file_type: file.type,
        file_size: file.size,
        content_text: result.content,
        metadata: {
          ...result.metadata,
          structure: result.structure,
        },
        template_id: template?.id,
        template_name: template?.name,
        extracted_fields: result.extractedFields,
        processing_method: method,
      });
    } catch (error) {
      console.error('Failed to save processed document:', error);
      // Don't throw error - processing was successful, saving failed
    }
  }, [template]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setProcessedDocument(null);
    setTemplateExtractionResult(null);
    setProgressiveResult(null);
    setSelectedTemplate(null);
    setIsProcessing(true);

    try {
      console.log('Processing document with template:', template?.name, 'useProgressiveExtraction:', useProgressiveExtraction);
      // Use template-guided processing if template is available
      if (template) {
        if (useProgressiveExtraction) {
          // Progressive extraction with real-time updates - FIXED GENERATOR CONSUMPTION
          console.log('Starting progressive extraction...');
          const progressiveGenerator = documentProcessor.processDocumentWithTemplateProgressive(selectedFile, template);
          
          let finalProgressiveResult: any = null;
          let updateCount = 0;
          
          // Properly consume the async generator
          for await (const progressUpdate of progressiveGenerator) {
            updateCount++;
            console.log(`Progress update ${updateCount}:`, progressUpdate);
            setProgressiveResult(progressUpdate);
            finalProgressiveResult = progressUpdate; // Keep track of the last update
            
            // Add small delay to prevent UI flooding
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          console.log(`Progressive extraction completed with ${updateCount} updates`);
          
          // Convert final progressive result to template extraction result
          if (finalProgressiveResult?.isComplete) {
            const templateResult = {
              content: finalProgressiveResult.content,
              metadata: finalProgressiveResult.metadata,
              structure: finalProgressiveResult.structure,
              template: finalProgressiveResult.template,
              extractedFields: Object.entries(finalProgressiveResult.fieldProgress).reduce((acc: Record<string, any>, [key, progress]: [string, any]) => {
                if (progress.result) {
                  acc[key] = progress.result;
                }
                return acc;
              }, {})
            };
            
            setTemplateExtractionResult(templateResult);
            
            // Save to database and navigate to document detail page
            const savedDocument = await saveProcessedDocument(selectedFile, templateResult, 'progressive');
            navigate({ to: '/documents/$documentId', params: { documentId: savedDocument.id } });
          }
        } else {
          // Standard batch processing
          const result = await documentProcessor.processDocumentWithTemplate(selectedFile, template);
          setTemplateExtractionResult(result);
          
          // Save to database and navigate to document detail page
          const savedDocument = await saveProcessedDocument(selectedFile, result, 'template_guided');
          navigate({ to: '/documents/$documentId', params: { documentId: savedDocument.id } });
        }
      } else {
        // Fallback to generic processing
        const result = await documentProcessor.processDocumentWithDocling(selectedFile);
        setProcessedDocument(result);
        
        // Save generic processing result and navigate to document detail page
        const savedDocument = await saveProcessedDocument(selectedFile, result, 'generic');
        navigate({ to: '/documents/$documentId', params: { documentId: savedDocument.id } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  }, [documentProcessor, template, useProgressiveExtraction]);

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

  const getSelectedTemplateName = () => {
    if (!selectedTemplate || !processedDocument) return '';
    const template = processedDocument.templateSuggestions.find(t => t.templateId === selectedTemplate);
    return template?.templateName || '';
  };

  return (
    <div>
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
                  <Badge variant="secondary" className="ml-4">
                    {template.category}
                  </Badge>
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
                {template.smart_variables && template.smart_variables.length > 0 && (
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
                    {template.template_content}
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
          <CardContent>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="progressive"
                checked={useProgressiveExtraction}
                onCheckedChange={(checked) => setUseProgressiveExtraction(checked === true)}
              />
              <label htmlFor="progressive" className="text-sm font-medium">
                Enable progressive field extraction
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              See extraction progress in real-time as each field is processed
            </p>
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing document...</span>
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
        <div className="space-y-6">
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
        <div className="space-y-6">
          {/* Extracted Fields */}
          <Card>
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
                    <div key={fieldName} className="border rounded-lg p-4 bg-muted">
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
                      {templateExtractionResult.structure.headings.map((heading, index) => (
                        <div
                          key={index}
                          className={`pl-${heading.level * 4} py-1`}
                          role="heading"
                          aria-level={heading.level}
                        >
                          <span className="font-medium">{heading.text}</span>
                        </div>
                      ))}
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
        <div className="space-y-6">
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
                      {processedDocument.structure.headings.map((heading, index) => (
                        <div
                          key={index}
                          className={`pl-${heading.level * 4} py-1`}
                          role="heading"
                          aria-level={heading.level}
                        >
                          <span className="font-medium">{heading.text}</span>
                        </div>
                      ))}
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

                  {workflowExecution.result && (
                    <Alert>
                      <CheckCircle className="w-4 h-4" />
                      <AlertDescription>
                        Workflow completed successfully! Result: {workflowExecution.result ? String(JSON.stringify(workflowExecution.result)) : 'No result data'}
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
