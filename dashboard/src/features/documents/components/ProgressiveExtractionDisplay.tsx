import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Loader2, AlertCircle, Clock } from 'lucide-react';

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

interface SmartVariable {
  id: string;
  name: string;
  type: string;
  description: string;
  extraction_hints: string[];
}

interface ProgressiveExtractionResult {
  content: string;
  metadata: any;
  structure: any;
  template: {
    id: number;
    name: string;
    smart_variables: SmartVariable[];
  };
  fieldProgress: Record<string, FieldExtractionProgress>;
  isComplete: boolean;
}

interface ProgressiveExtractionDisplayProps {
  progressiveResult: ProgressiveExtractionResult;
}

export function ProgressiveExtractionDisplay({ progressiveResult }: ProgressiveExtractionDisplayProps) {
  // Utility function to check if an extracted value is valid (non-empty)
  const isValidExtractedValue = (value: any): boolean => {
    return value !== null && 
           value !== undefined && 
           String(value).trim() !== '';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 rounded-full bg-gray-300" />;
      case 'extracting':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'analyzing':
        return <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-300" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Waiting...';
      case 'extracting':
        return 'Extracting...';
      case 'analyzing':
        return 'Analyzing...';
      case 'completed':
        return 'Complete';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          Field Extraction Progress
          {progressiveResult.isComplete && (
            <Badge variant="outline" className="ml-2 text-green-600 border-green-600">
              Complete
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {progressiveResult.template.smart_variables
            .filter(variable => {
              const progress = progressiveResult.fieldProgress[variable.name];
              // Show field if it has progress OR if extraction is complete and we want to show all fields
              return progress || !progressiveResult.isComplete;
            })
            .map(variable => {
            const progress = progressiveResult.fieldProgress[variable.name];
            
            return (
              <div key={variable.name} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(progress?.status || 'pending')}
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{variable.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {variable.type}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{getStatusText(progress?.status || 'pending')}</span>
                </div>

                {/* Progress bar - only show if not completed or failed */}
                {progress?.status !== 'completed' && progress?.status !== 'failed' && (
                  <div className="mb-3">
                    <Progress 
                      value={progress?.progress || 0} 
                      className="h-2" 
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{progress?.progress || 0}%</span>
                      {progress?.status === 'extracting' && <span>Finding in document...</span>}
                      {progress?.status === 'analyzing' && <span>Validating extraction...</span>}
                    </div>
                  </div>
                )}

                {/* Field result (if completed and has valid result) */}
                {progress?.status === 'completed' && progress?.result && 
                 isValidExtractedValue(progress.result.value) && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{String(progress.result.value)}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${
                          progress.result.confidence >= 0.8 ? 'text-green-600 dark:text-green-400' : 
                          progress.result.confidence >= 0.6 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {Math.round(progress.result.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                    {progress.result.sourceText && (
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-semibold">Source: </span>
                        <span className="italic font-medium">"{progress.result.sourceText}"</span>
                      </div>
                    )}
                    {progress.result.location && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">
                        {progress.result.location.page && `Page ${progress.result.location.page}`}
                        {progress.result.location.position && ` • Position ${progress.result.location.position}`}
                      </div>
                    )}
                  </div>
                )}

                {/* Field error (if failed) */}
                {progress?.status === 'failed' && progress?.error && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Extraction Failed</span>
                    </div>
                    <p className="text-xs text-red-600 mt-1">{progress.error}</p>
                  </div>
                )}

                {/* No result found (completed but no valid value) */}
                {progress?.status === 'completed' && (!progress?.result || 
                 !isValidExtractedValue(progress.result.value)) && (
                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                    <div className="flex items-center gap-2 text-yellow-700">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Not Found</span>
                    </div>
                    <p className="text-xs text-yellow-600 mt-1">This field was not found in the document</p>
                  </div>
                )}

                <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 font-medium">{variable.description}</p>
              </div>
            );
          })}
        </div>

        {/* Summary of successful extractions */}
        {progressiveResult.isComplete && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Extraction Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="font-medium text-green-600">
                  {Object.values(progressiveResult.fieldProgress).filter(p => 
                    p.status === 'completed' && 
                    p.result && 
                    isValidExtractedValue(p.result.value)
                  ).length}
                </div>
                <div className="text-green-700">Extracted</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-red-600">
                  {Object.values(progressiveResult.fieldProgress).filter(p => p.status === 'failed').length}
                </div>
                <div className="text-red-700">Failed</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-yellow-600">
                  {Object.values(progressiveResult.fieldProgress).filter(p => 
                    p.status === 'completed' && (!p.result || 
                    !isValidExtractedValue(p.result.value))
                  ).length}
                </div>
                <div className="text-yellow-700">Not Found</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-blue-600">
                  {progressiveResult.template.smart_variables.length}
                </div>
                <div className="text-blue-700">Total Fields</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}