/**
 * Template Validation Panel Component
 * Shows validation results with detailed feedback
 */
import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  UseTemplateValidatorResult,
  getValidationSummary,
  ValidationError,
  ValidationWarning 
} from '@/hooks/use-template-validator';
import { Template } from '@/lib/template-validator';

interface TemplateValidationPanelProps {
  template: Partial<Template> | null;
  validator: UseTemplateValidatorResult; // Required prop
  className?: string;
  showQualityScore?: boolean;
  showAutoFix?: boolean;
  onAutoFix?: (fixedTemplate: Template) => void;
}

export function TemplateValidationPanel({ 
  template, 
  validator,
  className,
  showQualityScore = true,
  showAutoFix = true,
  onAutoFix
}: TemplateValidationPanelProps) {
  // No validation here - parent controls validation

  const summary = getValidationSummary(validator.validationResult);

  if (!template || !validator.validationResult) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info size={20} />
            Template Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No template to validate
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleAutoFix = () => {
    if (template && onAutoFix) {
      const fixed = validator.autoFix(template);
      onAutoFix(fixed);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {validator.isValid ? (
              <CheckCircle size={20} className="text-green-500" />
            ) : (
              <AlertCircle size={20} className="text-red-500" />
            )}
            Template Validation
          </div>
          
          {showAutoFix && !validator.isValid && (
            <button
              onClick={handleAutoFix}
              className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md transition-colors"
            >
              Auto Fix Issues
            </button>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Validation Summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge 
              variant={validator.isValid ? "default" : "destructive"}
              className="capitalize"
            >
              {validator.isValid ? 'Valid' : 'Invalid'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {summary.summary}
            </span>
          </div>
          
          {summary.errorCount > 0 && (
            <Badge variant="destructive">
              {summary.errorCount} Error{summary.errorCount !== 1 ? 's' : ''}
            </Badge>
          )}
          
          {summary.warningCount > 0 && (
            <Badge variant="secondary">
              {summary.warningCount} Warning{summary.warningCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Quality Score */}
        {showQualityScore && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Quality Score</span>
              <span className={`font-semibold ${
                summary.qualityLevel === 'excellent' ? 'text-green-600' :
                summary.qualityLevel === 'good' ? 'text-blue-600' :
                summary.qualityLevel === 'fair' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {summary.qualityScore}/100 ({summary.qualityLevel})
              </span>
            </div>
            <Progress 
              value={summary.qualityScore} 
              className="h-2"
              // Custom color based on quality level
            />
          </div>
        )}

        {/* Errors */}
        {validator.errors.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-red-600 flex items-center gap-1">
              <AlertCircle size={16} />
              Errors ({validator.errors.length})
            </h4>
            <div className="space-y-1">
              {validator.errors.map((error, index) => (
                <ErrorItem key={index} error={error} />
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {validator.warnings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-yellow-600 flex items-center gap-1">
              <AlertTriangle size={16} />
              Warnings ({validator.warnings.length})
            </h4>
            <div className="space-y-1">
              {validator.warnings.map((warning, index) => (
                <WarningItem key={index} warning={warning} />
              ))}
            </div>
          </div>
        )}

        {/* Success Message */}
        {validator.isValid && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Template is valid and ready to use! Quality score: {summary.qualityScore}/100
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Error item component
 */
function ErrorItem({ error }: { error: ValidationError }) {
  return (
    <Alert className="border-red-200 bg-red-50 py-2">
      <AlertCircle className="h-4 w-4 text-red-600" />
      <AlertDescription className="text-red-800">
        <span className="font-medium">{error.field}:</span> {error.message}
        {error.code && (
          <Badge variant="outline" className="ml-2 text-xs">
            {error.code}
          </Badge>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Warning item component
 */
function WarningItem({ warning }: { warning: ValidationWarning }) {
  return (
    <Alert className="border-yellow-200 bg-yellow-50 py-2">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="text-yellow-800">
        <span className="font-medium">{warning.field}:</span> {warning.message}
        {warning.suggestion && (
          <div className="mt-1 text-sm italic">
            💡 {warning.suggestion}
          </div>
        )}
        {warning.code && (
          <Badge variant="outline" className="ml-2 text-xs">
            {warning.code}
          </Badge>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Compact validation status component
 */
export function TemplateValidationStatus({ 
  template, 
  showDetails = false 
}: { 
  template: Partial<Template> | null;
  showDetails?: boolean;
}) {
  const validator = useTemplateValidator();
  
  React.useEffect(() => {
    if (template) {
      validator.validate(template);
    }
  }, [template, validator]);

  const summary = getValidationSummary(validator.validationResult);

  if (!template || !validator.validationResult) {
    return <Badge variant="secondary">Not validated</Badge>;
  }

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={validator.isValid ? "default" : "destructive"}
        className="flex items-center gap-1"
      >
        {validator.isValid ? (
          <CheckCircle size={12} />
        ) : (
          <AlertCircle size={12} />
        )}
        {validator.isValid ? 'Valid' : 'Invalid'}
      </Badge>
      
      {showDetails && (
        <>
          {summary.errorCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {summary.errorCount} error{summary.errorCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {summary.warningCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {summary.warningCount} warning{summary.warningCount !== 1 ? 's' : ''}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            Score: {summary.qualityScore}/100
          </span>
        </>
      )}
    </div>
  );
}