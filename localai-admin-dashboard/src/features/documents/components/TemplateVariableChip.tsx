import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TemplateVariableChipProps {
  /** Variable name (e.g., "company_name") */
  variableName: string;
  /** Extracted value from the document */
  extractedValue: string | null;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Source text from document */
  sourceText?: string;
  /** Field type */
  fieldType?: string;
  /** Whether the variable is editable */
  editable?: boolean;
  /** Click handler for editing */
  onClick?: () => void;
  /** Custom class name */
  className?: string;
}

export function TemplateVariableChip({
  variableName,
  extractedValue,
  confidence,
  sourceText,
  fieldType,
  editable = false,
  onClick,
  className,
}: TemplateVariableChipProps) {
  const hasValue = extractedValue !== null && extractedValue !== '';
  const confidencePercent = confidence ? Math.round(confidence * 100) : null;

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.9) return 'text-green-600 dark:text-green-400';
    if (conf >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            disabled={!editable && !onClick}
            className={cn(
              'inline-flex items-center gap-0.5 px-2 py-1 rounded-md',
              'font-mono text-sm transition-colors',
              'bg-primary/10 text-primary border border-primary/20',
              'hover:bg-primary/20 hover:border-primary/40',
              editable && 'cursor-pointer',
              !editable && !onClick && 'cursor-default',
              !hasValue && 'opacity-60 border-dashed',
              className
            )}
          >
            <span className="text-primary/60">{'{'}</span>
            <span className="text-primary/60">{'{'}</span>
            <span>{variableName}</span>
            <span className="text-primary/60">{'}'}</span>
            <span className="text-primary/60">{'}'}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-sm p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {variableName}
            </span>
            {fieldType && (
              <Badge variant="outline" className="text-xs">
                {fieldType}
              </Badge>
            )}
          </div>

          {hasValue ? (
            <>
              <div className="font-medium text-sm border-l-2 border-primary pl-2">
                {extractedValue}
              </div>
              {confidencePercent !== null && (
                <div className={cn('text-xs flex items-center gap-1', getConfidenceColor(confidence!))}>
                  <span className="font-medium">{confidencePercent}%</span>
                  <span className="text-muted-foreground">confidence</span>
                </div>
              )}
              {sourceText && (
                <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                  <span className="font-medium">Source:</span>
                  <span className="italic ml-1">"{sourceText}"</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-muted-foreground text-sm italic">
              No value extracted
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
