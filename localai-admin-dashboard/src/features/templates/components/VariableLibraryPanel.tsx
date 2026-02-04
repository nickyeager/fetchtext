/**
 * Variable Library Panel
 *
 * Side panel component displaying available template variables.
 * Features:
 * - List of available variables with type badges
 * - Insert button to add variables to editor
 * - Add new variable functionality
 * - Search/filter capability
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, Variable, Search, Copy, Settings2, Info } from 'lucide-react';
import type { SmartVariable } from '@/types/unified-template';
import { cn } from '@/lib/utils';

interface VariableLibraryPanelProps {
  variables: SmartVariable[];
  extractedData?: Record<string, unknown>;
  onInsertVariable: (variable: SmartVariable) => void;
  onAddVariable?: () => void;
  onEditVariable?: (variable: SmartVariable) => void;
  className?: string;
  showSearch?: boolean;
  showAddButton?: boolean;
  maxHeight?: string;
}

export function VariableLibraryPanel({
  variables,
  extractedData = {},
  onInsertVariable,
  onAddVariable,
  onEditVariable,
  className,
  showSearch = true,
  showAddButton = true,
  maxHeight = '400px',
}: VariableLibraryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter variables by search query
  const filteredVariables = useMemo(() => {
    if (!searchQuery.trim()) return variables;

    const query = searchQuery.toLowerCase();
    return variables.filter(
      (v) =>
        v.name.toLowerCase().includes(query) ||
        v.id.toLowerCase().includes(query) ||
        v.type?.toLowerCase().includes(query) ||
        v.description?.toLowerCase().includes(query)
    );
  }, [variables, searchQuery]);

  // Group variables by type
  const groupedVariables = useMemo(() => {
    const groups: Record<string, SmartVariable[]> = {};
    filteredVariables.forEach((v) => {
      const type = v.type || 'text';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(v);
    });
    return groups;
  }, [filteredVariables]);

  const hasVariables = variables.length > 0;
  const hasFilteredResults = filteredVariables.length > 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Variable className="h-5 w-5" />
            Variables
            {hasVariables && (
              <Badge variant="secondary" className="text-xs ml-1">
                {variables.length}
              </Badge>
            )}
          </CardTitle>
          {showAddButton && onAddVariable && (
            <Button variant="outline" size="sm" onClick={onAddVariable}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Search */}
        {showSearch && hasVariables && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search variables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {/* Variable List */}
        <ScrollArea style={{ maxHeight }}>
          <div className="space-y-4 pr-4">
            {!hasVariables ? (
              <EmptyState onAddVariable={onAddVariable} />
            ) : !hasFilteredResults ? (
              <NoResultsState searchQuery={searchQuery} />
            ) : (
              Object.entries(groupedVariables).map(([type, vars]) => (
                <VariableGroup
                  key={type}
                  type={type}
                  variables={vars}
                  extractedData={extractedData}
                  onInsertVariable={onInsertVariable}
                  onEditVariable={onEditVariable}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer hint */}
        {hasVariables && (
          <p className="text-xs text-muted-foreground pt-2 border-t">
            Click <strong>Insert</strong> or type{' '}
            <code className="px-1 py-0.5 bg-muted rounded text-[10px]">{'{{'}</code> in the editor
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Variable Group Component
 */
function VariableGroup({
  type,
  variables,
  extractedData,
  onInsertVariable,
  onEditVariable,
}: {
  type: string;
  variables: SmartVariable[];
  extractedData: Record<string, unknown>;
  onInsertVariable: (variable: SmartVariable) => void;
  onEditVariable?: (variable: SmartVariable) => void;
}) {
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs font-normal">
          {typeLabel}
        </Badge>
        <span className="text-xs text-muted-foreground">({variables.length})</span>
      </div>
      <div className="space-y-1.5">
        {variables.map((variable) => (
          <VariableItem
            key={variable.id}
            variable={variable}
            extractedValue={extractedData[variable.id]}
            onInsert={() => onInsertVariable(variable)}
            onEdit={onEditVariable ? () => onEditVariable(variable) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Variable Item Component
 */
function VariableItem({
  variable,
  extractedValue,
  onInsert,
  onEdit,
}: {
  variable: SmartVariable;
  extractedValue?: unknown;
  onInsert: () => void;
  onEdit?: () => void;
}) {
  const hasValue = extractedValue !== undefined && extractedValue !== null;
  const format = variable.post_processing?.transform;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'flex items-center justify-between p-2 rounded-lg border',
          'hover:bg-muted/50 transition-colors group'
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium truncate">{variable.name}</span>
            {format && format !== 'raw' && (
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {format}
              </Badge>
            )}
          </div>
          {variable.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {variable.description}
            </p>
          )}
          {hasValue && (
            <p className="text-xs text-primary/70 truncate mt-0.5 font-mono">
              = {String(extractedValue)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Info tooltip with variable details */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-mono text-xs">ID: {variable.id}</p>
                <p className="text-xs">Type: {variable.type || 'text'}</p>
                {variable.description && (
                  <p className="text-xs text-muted-foreground">{variable.description}</p>
                )}
                {hasValue && (
                  <p className="text-xs">
                    Value: <strong>{String(extractedValue)}</strong>
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Edit button */}
          {onEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Edit Variable</TooltipContent>
            </Tooltip>
          )}

          {/* Insert button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onInsert} className="h-7 px-2">
                <Copy className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">Insert</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Insert into editor</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

/**
 * Empty State Component
 */
function EmptyState({ onAddVariable }: { onAddVariable?: () => void }) {
  return (
    <div className="text-center py-8 px-4">
      <Variable className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground mb-1">No variables defined yet</p>
      <p className="text-xs text-muted-foreground mb-4">
        Variables are placeholders that get replaced with extracted values.
      </p>
      {onAddVariable && (
        <Button variant="outline" size="sm" onClick={onAddVariable}>
          <Plus className="h-4 w-4 mr-1" />
          Add First Variable
        </Button>
      )}
    </div>
  );
}

/**
 * No Results State Component
 */
function NoResultsState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="text-center py-6 px-4">
      <Search className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
      <p className="text-sm text-muted-foreground">
        No variables match "<strong>{searchQuery}</strong>"
      </p>
    </div>
  );
}
