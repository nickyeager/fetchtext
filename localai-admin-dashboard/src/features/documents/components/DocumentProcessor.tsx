import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileText, 
  Brain, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Zap,
  ArrowRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

interface ProcessingStep {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
}

interface ExtractedData {
  [key: string]: string | number;
}

interface DocumentProcessorProps {
  selectedTemplate: SmartTemplate;
  onGenerationComplete: (generatedDocument: string) => void;
  onBack: () => void;
}

export function DocumentProcessor({ selectedTemplate, onGenerationComplete, onBack }: DocumentProcessorProps) {
  const [_uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [extractedData, setExtractedData] = useState<ExtractedData>({});
  const [manualAdjustments, setManualAdjustments] = useState<ExtractedData>({});
  const [generatedDocument, setGeneratedDocument] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [processing, setProcessing] = useState(false);
  
  const steps: ProcessingStep[] = [
    { id: 'upload', name: 'Upload Source Document', status: 'pending' },
    { id: 'extract', name: 'Extract Text Content', status: 'pending' },
    { id: 'analyze', name: 'AI Data Extraction', status: 'pending' },
    { id: 'review', name: 'Review & Adjust', status: 'pending' },
    { id: 'generate', name: 'Generate Document', status: 'pending' }
  ];

  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>(steps);

  const updateStepStatus = (stepId: string, status: ProcessingStep['status'], message?: string) => {
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, message } : step
    ));
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploadedFile(file);
      updateStepStatus('upload', 'completed');
      setCurrentStep(1);
      
      // Extract text using the same logic as your existing extractFromFile
      updateStepStatus('extract', 'processing');
      const text = await extractTextFromFile(file);
      setExtractedText(text);
      updateStepStatus('extract', 'completed');
      setCurrentStep(2);
      
      // Start AI extraction in a separate try-catch block
      // so that AI extraction errors don't affect the text extraction status
      performAIExtraction(text);
    } catch (error) {
      updateStepStatus('extract', 'error', (error as Error).message);
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    // For demo purposes, we'll handle text files directly
    // In production, you'd use your N8N workflow or a proper text extraction service
    if (file.type.startsWith('text/')) {
      // Handle both browser and test environments
      if (typeof file.text === 'function') {
        return await file.text();
      } else {
        // Fallback for test environments where File.text() is not available
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.onabort = () => reject(new Error('File read aborted'));
          reader.readAsText(file);
        });
      }
    }
    
    // For other file types, you could call your N8N workflow
    // This is a simplified implementation
    return `[Extracted text from ${file.name}]\n\nThis is placeholder text that would normally be extracted from your ${file.type} file using the N8N workflow with extractFromFile node.`;
  };

  const performAIExtraction = async (text: string) => {
    try {
      updateStepStatus('analyze', 'processing');
      
      // Simulate AI extraction using Ollama via N8N webhook
      const extractionPrompt = createExtractionPrompt(text, selectedTemplate.smart_variables);
      
      // Call your N8N webhook endpoint for AI processing
      const extracted = await callAIExtractionWorkflow(extractionPrompt);
      
      setExtractedData(extracted);
      setManualAdjustments(extracted);
      updateStepStatus('analyze', 'completed');
      setCurrentStep(3);
    } catch (error) {
      updateStepStatus('analyze', 'error', (error as Error).message);
    }
  };

  const createExtractionPrompt = (text: string, variables: SmartVariable[]): string => {
    const fieldDescriptions = variables.map(v => 
      `- ${v.name} (${v.type}): ${v.description}${v.extraction_hints.length > 0 ? ` [Hints: ${v.extraction_hints.join(', ')}]` : ''}`
    ).join('\n');

    return `
Extract the following information from this document text and return as JSON:

${fieldDescriptions}

Document text:
${text}

Please return a JSON object with the field names as keys and extracted values. If a field cannot be found, use null.
    `.trim();
  };

  const callAIExtractionWorkflow = async (prompt: string): Promise<ExtractedData> => {
    try {
      // Call the real N8N webhook endpoint for AI processing
      const webhookUrl = 'http://localhost:5678/webhook/document-processing';
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          template: {
            id: selectedTemplate.id,
            name: selectedTemplate.name,
            variables: selectedTemplate.smart_variables,
          },
          timestamp: new Date().toISOString(),
        }),
      });

      // Check if response exists before accessing properties
      if (!response || !response.ok) {
        throw new Error(`N8N webhook failed: ${response?.status || 'No response'} ${response?.statusText || 'Network error'}`);
      }

      const result = await response.json();
      
      // Handle the response from N8N/Ollama
      if (result.error) {
        throw new Error(result.error);
      }

      // Parse the AI response (could be a JSON string or object)
      let extractedData: ExtractedData = {};
      if (typeof result.data === 'string') {
        try {
          extractedData = JSON.parse(result.data);
        } catch {
          // If parsing fails, fall back to mock data
          extractedData = createMockExtractedData();
        }
      } else if (result.data && typeof result.data === 'object') {
        extractedData = result.data;
      } else {
        // Fallback to mock data if no valid response
        extractedData = createMockExtractedData();
      }

      return extractedData;
    } catch (_error) {
      // Fall back to mock data if N8N is not available
      return createMockExtractedData();
    }
  };

  const createMockExtractedData = (): ExtractedData => {
    const mockResponse: ExtractedData = {};
    
    selectedTemplate.smart_variables.forEach(variable => {
      // Simulate extraction based on variable type
      switch (variable.type) {
        case 'text':
          mockResponse[variable.name] = `Sample ${variable.name}`;
          break;
        case 'number':
          mockResponse[variable.name] = Math.floor(Math.random() * 1000);
          break;
        case 'date':
          mockResponse[variable.name] = new Date().toISOString().split('T')[0];
          break;
        case 'currency':
          mockResponse[variable.name] = `$${(Math.random() * 10000).toFixed(2)}`;
          break;
        case 'percentage':
          mockResponse[variable.name] = `${(Math.random() * 100).toFixed(1)}%`;
          break;
        default:
          mockResponse[variable.name] = variable.default_value || '';
      }
    });

    return mockResponse;
  };

  const generateDocument = async () => {
    try {
      setProcessing(true);
      updateStepStatus('generate', 'processing');
      
      // Replace template placeholders with extracted data
      let generated = selectedTemplate.template_content;
      
      Object.entries(manualAdjustments).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        generated = generated.replace(new RegExp(placeholder, 'g'), String(value));
      });
      
      setGeneratedDocument(generated);
      updateStepStatus('generate', 'completed');
      setCurrentStep(4);
      
      // Save to database
      await saveGeneratedDocument(generated);
      
      onGenerationComplete(generated);
    } catch (error) {
      updateStepStatus('generate', 'error', (error as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const saveGeneratedDocument = async (content: string) => {
    const user = await supabase.auth.getUser();
    if (!user.data.user) return;

    await supabase.from('generated_outputs').insert({
      document_id: null, // You'd link to the uploaded document
      template_id: selectedTemplate.id,
      generated_content: content,
      generation_settings: { extractedData: manualAdjustments },
      created_by: user.data.user.id
    });
  };

  const handleManualAdjustment = (fieldName: string, value: string | number) => {
    setManualAdjustments(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const proceedToReview = () => {
    updateStepStatus('review', 'completed');
    setCurrentStep(4);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Document Processing</h2>
          <p className="text-gray-600">Using template: {selectedTemplate.name}</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          ← Back to Templates
        </Button>
      </div>

      {/* Progress Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Processing Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            {processingSteps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${step.status === 'completed' ? 'bg-green-500 text-white' : 
                    step.status === 'processing' ? 'bg-blue-500 text-white' : 
                    step.status === 'error' ? 'bg-red-500 text-white' : 
                    'bg-gray-200 text-gray-600'}
                `}>
                  {step.status === 'completed' ? <CheckCircle className="h-4 w-4" /> :
                   step.status === 'processing' ? <Loader2 className="h-4 w-4 animate-spin" /> :
                   step.status === 'error' ? <AlertCircle className="h-4 w-4" /> :
                   index + 1}
                </div>
                {index < processingSteps.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-gray-400 mx-2" />
                )}
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-600">
            {processingSteps.find(s => s.status === 'processing')?.name || 
             processingSteps.find(s => s.status === 'error')?.name || 
             'Ready to start'}
          </div>
          {processingSteps.find(s => s.status === 'error')?.message && (
            <div className="text-sm text-red-600 mt-2">
              Error: {processingSteps.find(s => s.status === 'error')?.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Information Card - Always Visible */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Template: {selectedTemplate.name}
          </CardTitle>
          <CardDescription>
            {selectedTemplate.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">
                Data to Extract ({selectedTemplate.smart_variables.length} fields):
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedTemplate.smart_variables.map((variable) => (
                  <div key={variable.id} className="bg-gray-50 p-3 rounded-lg">
                    <div className="font-medium text-sm text-gray-900">
                      {variable.name} 
                      <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                        {variable.type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{variable.description}</p>
                    {variable.extraction_hints.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Hints: {variable.extraction_hints.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-blue-50 p-3 rounded-lg">
              <h4 className="font-medium text-sm text-blue-900 mb-1">Template Preview:</h4>
              <div className="bg-white p-2 rounded text-xs font-mono max-h-20 overflow-y-auto">
                {selectedTemplate.template_content.substring(0, 200)}...
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - File Upload & Text */}
        <div className="space-y-6">
          {/* File Upload */}
          {currentStep === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Source Document
                </CardTitle>
                <CardDescription>
                  Upload the document you want to extract data from
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <span className="mt-2 block text-sm font-medium text-gray-900">
                        Drop file here or click to upload
                      </span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                        accept=".txt,.pdf,.doc,.docx,.md"
                      />
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                      Supports: TXT, PDF, DOC, DOCX, MD files
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extracted Text */}
          {extractedText && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Extracted Text
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap">{extractedText}</pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Data Extraction & Generation */}
        <div className="space-y-6">
          {/* Data Extraction Review */}
          {currentStep >= 2 && Object.keys(extractedData).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Extracted Data
                  {currentStep === 3 && (
                    <Badge variant="secondary" className="ml-2">Review & Adjust</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Review and adjust the automatically extracted field values
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTemplate.smart_variables.map((variable) => (
                  <div key={variable.id} className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      {variable.name}
                      <span className="text-gray-500 ml-1">({variable.type})</span>
                    </label>
                    <p className="text-xs text-gray-500">{variable.description}</p>
                    {currentStep === 3 ? (
                      <Input
                        value={manualAdjustments[variable.name] || ''}
                        onChange={(e) => handleManualAdjustment(variable.name, e.target.value)}
                        placeholder={`Enter ${variable.name}...`}
                      />
                    ) : (
                      <div className="bg-gray-50 p-2 rounded text-sm">
                        {String(extractedData[variable.name] || 'Not extracted')}
                      </div>
                    )}
                  </div>
                ))}
                
                {currentStep === 3 && (
                  <div className="flex gap-2 pt-4">
                    <Button onClick={proceedToReview} className="flex-1">
                      Continue to Generation
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => performAIExtraction(extractedText)}
                    >
                      <Brain className="h-4 w-4 mr-1" />
                      Re-extract
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Document Generation */}
          {currentStep >= 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Generated Document
                </CardTitle>
                <CardDescription>
                  Your template populated with extracted data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!generatedDocument ? (
                  <Button 
                    onClick={generateDocument} 
                    disabled={processing}
                    className="w-full"
                  >
                    {processing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Generate Document
                  </Button>
                ) : (
                  <>
                    <div className="bg-white border rounded-lg p-4 max-h-60 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap">{generatedDocument}</pre>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      <Button variant="outline" onClick={() => setCurrentStep(0)}>
                        Process Another
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
} 