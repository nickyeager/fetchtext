import React, { useState, useCallback } from 'react';
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced';
import { WorkflowClient } from '@/lib/workflow-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, CheckCircle, XCircle, FileText, Workflow } from 'lucide-react';

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

interface WorkflowExecutionState {
  isExecuting: boolean;
  progress: number;
  status: string;
  result?: any;
  error?: string;
}

export function DocumentWorkflow() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedDocument, setProcessedDocument] = useState<ProcessedDocument | null>(null);
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

  const documentProcessor = new DocumentProcessorEnhanced();

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setProcessedDocument(null);
    setSelectedTemplate(null);
    setIsProcessing(true);

    try {
      const result = await documentProcessor.processDocumentWithDocling(selectedFile);
      setProcessedDocument(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  }, [documentProcessor]);

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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Workflow className="w-6 h-6" />
        <h1 className="text-3xl font-bold">Document Workflow</h1>
      </div>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Document
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="file"
            accept=".pdf,.docx,.txt,.md,.pptx,.xlsx,.html,.csv"
            onChange={handleFileUpload}
            disabled={isProcessing}
            aria-label="Upload document"
          />
          {file && (
            <div className="mt-2 text-sm text-gray-600">
              Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Processed Document Results */}
      {processedDocument && (
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
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{suggestion.templateName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary">
                            {Math.round(suggestion.confidence * 100)}%
                          </Badge>
                          <span className="text-sm text-gray-600">
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
                        <div key={index} className="text-sm text-gray-600">
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
                        <div key={index} className="text-sm text-gray-600">
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
                      <div className="text-sm text-gray-600">{workflowExecution.status}</div>
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
