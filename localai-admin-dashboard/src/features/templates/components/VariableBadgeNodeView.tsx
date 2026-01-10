/**
 * Variable Badge Node View
 *
 * React component that renders a template variable as an interactive badge
 * within the TipTap editor. Features:
 * - Styled badge appearance with {{variable}} syntax
 * - Hover tooltip showing extracted value and confidence
 * - Click handler to open format configuration dialog
 * - Inline value editing mode (when enableValueEditing is true)
 */

import React from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { EditableVariableBadgeView } from '@/features/documents/components/EditableVariableBadgeView';
import type { FieldOverride } from '@/services/document-override-service';

// Helper to extract display value from field data
// Field can be: string, { value: string, ... }, or null/undefined
function getDisplayValue(field: unknown): string | null {
  if (field === null || field === undefined) return null;
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && 'value' in field) {
    const val = (field as { value: unknown }).value;
    return val === null || val === undefined ? null : String(val);
  }
  return String(field);
}

export function VariableBadgeNodeView({
  node,
  selected,
  extension,
}: NodeViewProps) {
  const { variableId, variableName, format } = node.attrs as {
    variableId: string;
    variableName: string;
    format: string;
  };
  const extractedData = extension.options.extractedData || {};
  const rawFieldData = extractedData[variableId];
  const extractedValue = getDisplayValue(rawFieldData);
  const onVariableClick = extension.options.onVariableClick;

  // Value editing options
  const enableValueEditing = extension.options.enableValueEditing || false;
  const fieldOverrides: Record<string, FieldOverride> = extension.options.fieldOverrides || {};
  const onValueChange = extension.options.onValueChange;
  const onResetOverride = extension.options.onResetOverride;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onVariableClick) {
      onVariableClick(variableId);
    }
  };

  // Value editing mode - use EditableVariableBadgeView
  if (enableValueEditing) {
    const fieldOverride = fieldOverrides[variableId];
    const displayValue = fieldOverride?.value ?? extractedValue ?? null;
    const originalValue = extractedValue ?? null;
    const isOverride = !!fieldOverride;

    return (
      <NodeViewWrapper className="inline">
        <EditableVariableBadgeView
          variableId={variableId}
          variableName={variableName}
          value={displayValue}
          originalValue={originalValue}
          isOverride={isOverride}
          onValueChange={onValueChange || (async () => {})}
          onReset={onResetOverride}
        />
      </NodeViewWrapper>
    );
  }

  // Display mode - original badge with tooltip
  return (
    <NodeViewWrapper className="inline">
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleClick}
              contentEditable={false}
              className={cn(
                'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md mx-0.5',
                'font-mono text-sm transition-all cursor-pointer',
                'bg-primary/10 text-primary border border-primary/20',
                'hover:bg-primary/20 hover:border-primary/40',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
                selected && 'ring-2 ring-primary ring-offset-1'
              )}
            >
              <span className="text-primary/60">{'{'}</span>
              <span className="text-primary/60">{'{'}</span>
              <span>{variableName}</span>
              <span className="text-primary/60">{'}'}</span>
              <span className="text-primary/60">{'}'}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs p-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {variableId}
                </span>
                {format && format !== 'raw' && (
                  <Badge variant="outline" className="text-xs">
                    {format}
                  </Badge>
                )}
              </div>

              {extractedValue !== undefined && extractedValue !== null ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium border-l-2 border-primary pl-2">
                    {String(extractedValue)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click to configure format
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No value extracted yet
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </NodeViewWrapper>
  );
}
