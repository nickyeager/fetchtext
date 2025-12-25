import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TemplateVariableChip } from './TemplateVariableChip';
import { Badge } from '@/components/ui/badge';
import { Variable } from 'lucide-react';

interface ExtractedField {
  value: string | null;
  confidence?: number;
  sourceText?: string;
  type?: string;
}

interface TemplateVariablesPanelProps {
  /** Panel title */
  title?: string;
  /** Template name (if matched) */
  templateName?: string;
  /** Extracted fields from the document */
  extractedFields: Record<string, ExtractedField | string | null>;
  /** Whether variables are editable */
  editable?: boolean;
  /** Handler when a variable is clicked for editing */
  onVariableClick?: (variableName: string) => void;
  /** Custom class name */
  className?: string;
}

export function TemplateVariablesPanel({
  title = 'Extracted Variables',
  templateName,
  extractedFields,
  editable = false,
  onVariableClick,
  className,
}: TemplateVariablesPanelProps) {
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

  const fieldCount = Object.keys(normalizedFields).length;
  const filledCount = Object.values(normalizedFields).filter(f => f.value).length;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Variable className="h-5 w-5" />
            {title}
          </CardTitle>
          <Badge variant="secondary">
            {filledCount}/{fieldCount} filled
          </Badge>
        </div>
        {templateName && (
          <p className="text-sm text-muted-foreground">
            Template: <span className="font-medium">{templateName}</span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          Hover over any variable to see its extracted value from this document.
        </p>
        <ScrollArea className="max-h-[200px]">
          <div className="flex flex-wrap gap-2">
            {Object.entries(normalizedFields).map(([name, field]) => (
              <TemplateVariableChip
                key={name}
                variableName={name}
                extractedValue={field.value}
                confidence={field.confidence}
                sourceText={field.sourceText}
                fieldType={field.type}
                editable={editable}
                onClick={onVariableClick ? () => onVariableClick(name) : undefined}
              />
            ))}
          </div>

          {fieldCount === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No variables extracted from this document
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
