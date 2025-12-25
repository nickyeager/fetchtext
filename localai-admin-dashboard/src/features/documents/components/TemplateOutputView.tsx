import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { FileOutput, Check, AlertCircle, Edit, Download, Copy } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ExtractedField {
  value: string | null;
  confidence?: number;
  sourceText?: string;
  type?: string;
}

interface TemplateOutputViewProps {
  /** Template content with {{variable}} placeholders */
  templateContent: string;
  /** Extracted fields with values */
  extractedFields: Record<string, ExtractedField | string | null>;
  /** Template name */
  templateName?: string;
  /** Template ID for editing */
  templateId?: number;
  /** Whether to show the raw template vs filled */
  showRaw?: boolean;
  /** Handler for editing the template */
  onEditTemplate?: () => void;
  /** Handler for exporting the filled document */
  onExport?: () => void;
  /** Custom class name */
  className?: string;
}

export function TemplateOutputView({
  templateContent,
  extractedFields,
  templateName,
  templateId,
  showRaw = false,
  onEditTemplate,
  onExport,
  className,
}: TemplateOutputViewProps) {
  // Normalize fields to consistent structure
  const normalizedFields = useMemo(() => {
    const result: Record<string, ExtractedField> = {};
    for (const [key, value] of Object.entries(extractedFields)) {
      if (value === null || value === undefined) {
        result[key] = { value: null };
      } else if (typeof value === 'string') {
        result[key] = { value };
      } else if (typeof value === 'object' && 'value' in value) {
        result[key] = value as ExtractedField;
      } else {
        result[key] = { value: JSON.stringify(value) };
      }
    }
    return result;
  }, [extractedFields]);

  // Parse template content and replace variables with interactive elements
  const renderedContent = useMemo(() => {
    if (!templateContent) return null;

    // Split content by variable placeholders
    const parts: Array<{ type: 'text' | 'variable'; content: string; field?: ExtractedField }> = [];
    const regex = /\{\{(\w+)\}\}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(templateContent)) !== null) {
      // Add text before the variable
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: templateContent.slice(lastIndex, match.index),
        });
      }

      // Add the variable
      const varName = match[1];
      const field = normalizedFields[varName] || { value: null };
      parts.push({
        type: 'variable',
        content: varName,
        field,
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < templateContent.length) {
      parts.push({
        type: 'text',
        content: templateContent.slice(lastIndex),
      });
    }

    return parts;
  }, [templateContent, normalizedFields]);

  const filledCount = Object.values(normalizedFields).filter(f => f.value).length;
  const totalCount = Object.keys(normalizedFields).length;

  const getConfidenceColor = (conf?: number) => {
    if (!conf) return 'text-muted-foreground';
    if (conf >= 0.9) return 'text-green-600 dark:text-green-400';
    if (conf >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const copyToClipboard = async () => {
    // Generate filled text for clipboard
    let filledText = templateContent;
    for (const [key, field] of Object.entries(normalizedFields)) {
      const placeholder = `{{${key}}}`;
      const value = field.value || `[${key}]`;
      filledText = filledText.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    await navigator.clipboard.writeText(filledText);
  };

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileOutput className="h-5 w-5" />
            Generated Output
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {filledCount}/{totalCount} fields
            </Badge>
            {onEditTemplate && templateId && (
              <Button variant="outline" size="sm" onClick={onEditTemplate}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={copyToClipboard} title="Copy to clipboard">
              <Copy className="h-4 w-4" />
            </Button>
            {onExport && (
              <Button variant="default" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {templateName || 'No template applied'}
        </p>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-muted/30 rounded-lg font-mono text-sm whitespace-pre-wrap">
            <TooltipProvider delayDuration={200}>
              {renderedContent?.map((part, index) => {
                if (part.type === 'text') {
                  return <span key={index}>{part.content}</span>;
                }

                const field = part.field!;
                const hasValue = field.value !== null && field.value !== '';
                const confidencePercent = field.confidence ? Math.round(field.confidence * 100) : null;

                return (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded mx-0.5',
                          'transition-colors cursor-help',
                          hasValue
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 border-dashed'
                        )}
                      >
                        {showRaw ? (
                          <span>{`{{${part.content}}}`}</span>
                        ) : hasValue ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>{field.value}</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3" />
                            <span className="italic">{`{{${part.content}}}`}</span>
                          </>
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm p-3 space-y-2">
                      <div className="font-mono text-xs text-muted-foreground">
                        {part.content}
                      </div>
                      {hasValue ? (
                        <>
                          <div className="font-medium text-sm border-l-2 border-primary pl-2">
                            {field.value}
                          </div>
                          {confidencePercent !== null && (
                            <div className={cn('text-xs', getConfidenceColor(field.confidence))}>
                              {confidencePercent}% confidence
                            </div>
                          )}
                          {field.sourceText && (
                            <div className="text-xs text-muted-foreground border-t pt-2">
                              Source: "{field.sourceText}"
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
                );
              })}
            </TooltipProvider>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
