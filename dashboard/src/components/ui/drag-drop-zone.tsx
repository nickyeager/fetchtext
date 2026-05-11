import React, { useCallback, useState, useRef } from 'react';
import { Upload, File, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DragDropZoneProps {
  onFileSelect: (file: File) => void;
  onEvaluationComplete?: (evaluation: DocumentEvaluation) => void;
  acceptedFormats?: string[];
  maxSize?: number; // in bytes
  isEvaluating?: boolean;
  evaluationResult?: DocumentEvaluation;
  disabled?: boolean;
  className?: string;
}

interface DocumentEvaluation {
  document_info: {
    filename: string;
    file_size: number;
    mime_type: string;
    format_supported: boolean;
  };
  type_evaluation: {
    primary_type: string;
    confidence: number;
    detection_method: string;
  };
  template_suggestions: Array<{
    template_id: number;
    template_name: string;
    match_score: number;
    category: string;
  }>;
  processing_recommendations: {
    workflow: string;
    suggested_action: string;
    confidence_level: string;
  };
}

const DEFAULT_ACCEPTED_FORMATS = ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.htm', '.txt', '.md', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff'];
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function DragDropZone({
  onFileSelect,
  onEvaluationComplete,
  acceptedFormats = DEFAULT_ACCEPTED_FORMATS,
  maxSize = DEFAULT_MAX_SIZE,
  isEvaluating = false,
  evaluationResult,
  disabled = false,
  className
}: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      return `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size (${(maxSize / 1024 / 1024).toFixed(1)}MB)`;
    }

    // Check file format
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFormats.includes(fileExtension)) {
      return `File format "${fileExtension}" is not supported. Accepted formats: ${acceptedFormats.join(', ')}`;
    }

    return null;
  }, [acceptedFormats, maxSize]);

  const handleFileSelect = useCallback((file: File) => {
    setError(null);
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    onFileSelect(file);
  }, [validateFile, onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [disabled, handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const openFileDialog = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <div className={cn("w-full", className)}>
      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Drag Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 transition-all duration-200 cursor-pointer",
          "hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/50",
          isDragging && "border-blue-500 bg-blue-50 dark:bg-blue-950 scale-[1.01]",
          disabled && "cursor-not-allowed opacity-50",
          error && "border-red-300 bg-red-50 dark:bg-red-950",
          evaluationResult && "border-green-300 bg-green-50 dark:bg-green-950",
          !error && !evaluationResult && !isDragging && "border-gray-300 dark:border-gray-600"
        )}
        data-testid="drop-zone"
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          {isEvaluating ? (
            <>
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900 dark:text-white">Analyzing document...</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Detecting document type and suggesting templates</p>
              </div>
            </>
          ) : evaluationResult ? (
            <>
              <CheckCircle className="w-12 h-12 text-green-500" />
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {evaluationResult.type_evaluation.primary_type.charAt(0).toUpperCase() + 
                   evaluationResult.type_evaluation.primary_type.slice(1)} Detected
                </p>
                <p className={cn("text-sm font-medium", getConfidenceColor(evaluationResult.type_evaluation.confidence))}>
                  {getConfidenceLabel(evaluationResult.type_evaluation.confidence)} Confidence 
                  ({Math.round(evaluationResult.type_evaluation.confidence * 100)}%)
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Click to upload a different document
                </p>
              </div>
            </>
          ) : error ? (
            <>
              <AlertCircle className="w-12 h-12 text-red-500" />
              <div className="text-center">
                <p className="text-lg font-medium text-red-900 dark:text-red-100">Upload Error</p>
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Click to try again</p>
              </div>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500" />
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  Drag & drop your document here
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">or click to browse files</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Supported formats: {acceptedFormats.join(', ')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Maximum size: {(maxSize / 1024 / 1024).toFixed(0)}MB
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Evaluation Results */}
      {evaluationResult && !error && (
        <div className="mt-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Document Analysis</h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {evaluationResult.document_info.filename}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Document Info */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Document Information</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Type:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{evaluationResult.type_evaluation.primary_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Size:</span>
                  <span className="text-gray-900 dark:text-white">{(evaluationResult.document_info.file_size / 1024).toFixed(1)} KB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Method:</span>
                  <span className="text-xs text-gray-900 dark:text-white">{evaluationResult.type_evaluation.detection_method}</span>
                </div>
              </div>
            </div>

            {/* Processing Recommendation */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recommendation</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Workflow:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{evaluationResult.processing_recommendations.workflow}</span>
                </div>
                <div className="text-gray-600 dark:text-gray-400 mt-2">
                  <span className="font-medium">Suggested:</span>
                  <p className="text-xs mt-1">{evaluationResult.processing_recommendations.suggested_action}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Template Suggestions */}
          {evaluationResult.template_suggestions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Suggested Templates</h4>
              <div className="space-y-2">
                {evaluationResult.template_suggestions.slice(0, 2).map((template, index) => (
                  <div key={template.template_id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{template.template_name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">({template.category})</span>
                    </div>
                    <span className="text-sm text-green-600 font-medium">
                      {Math.round(template.match_score * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}