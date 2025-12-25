/**
 * Variable Badge Node View
 *
 * React component that renders a template variable as an interactive badge
 * within the TipTap editor. Features:
 * - Styled badge appearance with {{variable}} syntax
 * - Hover tooltip showing extracted value and confidence
 * - Click handler to open format configuration dialog
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

interface VariableBadgeNodeViewProps extends NodeViewProps {
  node: {
    attrs: {
      variableId: string;
      variableName: string;
      format: string;
    };
  };
}

export function VariableBadgeNodeView({
  node,
  selected,
  extension,
}: VariableBadgeNodeViewProps) {
  const { variableId, variableName, format } = node.attrs;
  const extractedData = extension.options.extractedData || {};
  const extractedValue = extractedData[variableId];
  const onVariableClick = extension.options.onVariableClick;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onVariableClick) {
      onVariableClick(variableId);
    }
  };

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
