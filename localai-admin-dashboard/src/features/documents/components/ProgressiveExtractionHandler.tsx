import React, { useState, useCallback, useRef } from 'react';
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced';

interface FieldExtractionProgress {
  fieldName: string;
  status: 'pending' | 'extracting' | 'analyzing' | 'completed' | 'failed';
  progress: number;
  result?: {
    value: any;
    confidence: number;
    sourceText?: string;
    location?: {
      page?: number;
      position?: number;
    };
  };
  error?: string;
}

interface ProgressiveExtractionResult {
  content: string;
  metadata: any;
  structure: any;
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

interface TemplateExtractionResult {
  content: string;
  metadata: any;
  structure: any;
  extractedFields: Record<string, any>;
  template: any;
}

interface ProgressiveExtractionHandlerProps {
  documentProcessor: DocumentProcessorEnhanced;
  file: File;
  template: any;
  onProgressUpdate: (result: ProgressiveExtractionResult) => void;
  onComplete: (result: TemplateExtractionResult) => void;
  onError: (error: string) => void;
}

export function useProgressiveExtraction() {
  const [isProcessing, setIsProcessing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const processDocumentProgressive = useCallback(async ({
    documentProcessor,
    file,
    template,
    onProgressUpdate,
    onComplete,
    onError
  }: ProgressiveExtractionHandlerProps) => {
    // Cleanup any previous processing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsProcessing(true);

    try {
      const progressiveGenerator = documentProcessor.processDocumentWithTemplateProgressive(file, template);
      
      let lastUpdate: ProgressiveExtractionResult | null = null;
      
      // Process updates using proper async iteration
      for await (const progressUpdate of progressiveGenerator) {
        // Check if processing was aborted
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Processing was cancelled');
        }

        lastUpdate = progressUpdate;
        onProgressUpdate(progressUpdate);

        // Add small delay to prevent overwhelming the UI
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // The generator should naturally complete and return the final result
      // We don't manually call .next() again as that was causing the issue
      if (lastUpdate?.isComplete) {
        // Convert the final progressive result to template extraction result
        const finalResult: TemplateExtractionResult = {
          content: lastUpdate.content,
          metadata: lastUpdate.metadata,
          structure: lastUpdate.structure,
          template: lastUpdate.template,
          extractedFields: Object.entries(lastUpdate.fieldProgress).reduce((acc, [key, progress]) => {
            if (progress.result) {
              acc[key] = progress.result;
            }
            return acc;
          }, {} as Record<string, any>)
        };

        onComplete(finalResult);
      } else {
        throw new Error('Progressive extraction did not complete successfully');
      }

    } catch (error) {
      if (error instanceof Error && error.message === 'Processing was cancelled') {
        // Silent cancellation, don't report as error
        return;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Progressive extraction failed';
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  }, []);

  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    processDocumentProgressive,
    cancelProcessing,
    isProcessing
  };
}