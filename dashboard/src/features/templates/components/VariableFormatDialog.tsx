/**
 * Variable Format Dialog
 *
 * Dialog component for configuring the display format of a template variable.
 * Shows format options based on variable type with live preview of the
 * formatted value.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatValue, getFormatOptionsForType, detectVariableType } from '@/lib/format-utils';
import type { SmartVariable } from '@/types/unified-template';
import { cn } from '@/lib/utils';

interface VariableFormatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variable: SmartVariable;
  extractedValue?: unknown;
  onSave: (variableId: string, format: string) => void;
}

export function VariableFormatDialog({
  open,
  onOpenChange,
  variable,
  extractedValue,
  onSave,
}: VariableFormatDialogProps) {
  const currentFormat = variable.post_processing?.transform || 'raw';
  const [selectedFormat, setSelectedFormat] = useState(currentFormat);

  // Reset selection when dialog opens or variable changes
  useEffect(() => {
    setSelectedFormat(variable.post_processing?.transform || 'raw');
  }, [variable, open]);

  // Determine the best type for format options
  const variableType = useMemo(() => {
    // Use explicit type if available, otherwise detect from value
    if (variable.type && variable.type !== 'string') {
      return variable.type;
    }
    if (extractedValue !== undefined && extractedValue !== null) {
      return detectVariableType(extractedValue);
    }
    return 'text';
  }, [variable.type, extractedValue]);

  const formatOptions = useMemo(() => {
    return getFormatOptionsForType(variableType);
  }, [variableType]);

  // Preview the formatted value
  const formattedPreview = useMemo(() => {
    if (extractedValue === undefined || extractedValue === null) {
      return null;
    }
    return formatValue(extractedValue, selectedFormat);
  }, [extractedValue, selectedFormat]);

  const handleSave = () => {
    onSave(variable.id, selectedFormat);
    onOpenChange(false);
  };

  const hasChanges = selectedFormat !== currentFormat;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Variable Format</DialogTitle>
          <DialogDescription>
            Choose how this variable should be displayed in the generated document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Variable Info */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="font-mono">
              {`{{${variable.name}}}`}
            </Badge>
            <Badge variant="outline">{variableType}</Badge>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Display Format</Label>
            <ScrollArea className="h-[200px] rounded-md border p-2">
              <RadioGroup
                value={selectedFormat}
                onValueChange={setSelectedFormat}
                className="space-y-1"
              >
                {formatOptions.map((option) => (
                  <label
                    key={option.value}
                    htmlFor={`format-${option.value}`}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-md cursor-pointer',
                      'hover:bg-muted/50 transition-colors',
                      selectedFormat === option.value && 'bg-muted'
                    )}
                  >
                    <RadioGroupItem
                      value={option.value}
                      id={`format-${option.value}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{option.label}</p>
                      {option.example && (
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {option.example}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </ScrollArea>
          </div>

          {/* Preview Section */}
          <Separator />
          <div className="space-y-2">
            <Label>Preview</Label>
            {extractedValue !== undefined && extractedValue !== null ? (
              <div className="space-y-2">
                <div className="p-3 bg-muted/50 rounded-md space-y-1">
                  <p className="text-xs text-muted-foreground">Raw value:</p>
                  <p className="text-sm font-mono break-all">
                    {String(extractedValue)}
                  </p>
                </div>
                <div className="p-3 bg-primary/5 rounded-md border border-primary/20 space-y-1">
                  <p className="text-xs text-primary/70">Formatted value:</p>
                  <p className="text-sm font-medium break-all">
                    {formattedPreview}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground italic">
                  No extracted value available for preview
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Process a document to see a live preview with real data.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            {hasChanges ? 'Save Format' : 'No Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
