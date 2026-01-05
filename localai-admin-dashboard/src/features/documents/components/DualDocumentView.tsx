import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  PanelLeftClose,
  PanelRightClose,
  Columns,
  Rows,
  GripVertical,
} from 'lucide-react';
import { DocumentPreviewPanel } from './DocumentPreviewPanel';
import { TemplateOutputView } from './TemplateOutputView';

interface ExtractedField {
  value: string | null;
  confidence?: number;
  sourceText?: string;
  type?: string;
}

interface DualDocumentViewProps {
  /** Original document file URL */
  fileUrl: string | null;
  /** Original document file name */
  fileName: string;
  /** Original document file type */
  fileType: string;
  /** Original document file size */
  fileSize?: number;
  /** Template content with {{variable}} placeholders */
  templateContent: string;
  /** Extracted fields with values */
  extractedFields: Record<string, ExtractedField | string | null>;
  /** Template name */
  templateName?: string;
  /** Template ID */
  templateId?: number;
  /** Handler for editing template */
  onEditTemplate?: () => void;
  /** Handler for export */
  onExport?: () => void;
  /** Custom class name */
  className?: string;
  /** Document text content for real-time extraction */
  documentText?: string;
  /** Enable inline editing mode */
  editable?: boolean;
  /** Callback when template content changes */
  onTemplateChange?: (content: string) => void;
  /** Callback when fields are extracted */
  onFieldsChange?: (fields: Record<string, ExtractedField>) => void;
  /** Callback to save template */
  onSaveTemplate?: (
    content: string,
    action: 'create' | 'modify',
    newName?: string
  ) => Promise<void>;
}

type LayoutMode = 'side-by-side' | 'stacked' | 'original-only' | 'output-only';

export function DualDocumentView({
  fileUrl,
  fileName,
  fileType,
  fileSize,
  templateContent,
  extractedFields,
  templateName,
  templateId,
  onEditTemplate,
  onExport,
  className,
  documentText,
  editable,
  onTemplateChange,
  onFieldsChange,
  onSaveTemplate,
}: DualDocumentViewProps) {
  const [layout, setLayout] = useState<LayoutMode>('side-by-side');
  const [splitRatio, setSplitRatio] = useState(50); // Percentage for left panel

  const handleDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startRatio = splitRatio;
    const container = e.currentTarget.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newRatio = Math.max(20, Math.min(80, startRatio + deltaPercent));
      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Layout Controls */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <Button
          variant={layout === 'side-by-side' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLayout('side-by-side')}
          title="Side by side view"
        >
          <Columns className="h-4 w-4" />
        </Button>
        <Button
          variant={layout === 'stacked' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLayout('stacked')}
          title="Stacked view"
        >
          <Rows className="h-4 w-4" />
        </Button>
        <Button
          variant={layout === 'original-only' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLayout('original-only')}
          title="Original only"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
        <Button
          variant={layout === 'output-only' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLayout('output-only')}
          title="Output only"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {/* Content Area */}
      <div
        className={cn(
          'flex-1 min-h-0',
          layout === 'side-by-side' && 'flex gap-0 relative',
          layout === 'stacked' && 'flex flex-col gap-4'
        )}
      >
        {/* Original Document Panel */}
        {layout !== 'output-only' && (
          <div
            className={cn(
              layout === 'side-by-side' && 'overflow-hidden',
              layout === 'stacked' && 'flex-1 min-h-[300px]',
              layout === 'original-only' && 'h-full'
            )}
            style={
              layout === 'side-by-side'
                ? { width: `${splitRatio}%` }
                : undefined
            }
          >
            <DocumentPreviewPanel
              fileUrl={fileUrl}
              fileName={fileName}
              fileType={fileType}
              fileSize={fileSize}
              className="h-full"
            />
          </div>
        )}

        {/* Resizable Divider (side-by-side only) */}
        {layout === 'side-by-side' && (
          <div
            className="w-2 bg-border hover:bg-primary/50 cursor-col-resize flex items-center justify-center transition-colors"
            onMouseDown={handleDrag}
          >
            <GripVertical className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        {/* Template Output Panel */}
        {layout !== 'original-only' && (
          <div
            className={cn(
              layout === 'side-by-side' && 'flex-1 overflow-hidden',
              layout === 'stacked' && 'flex-1 min-h-[300px]',
              layout === 'output-only' && 'h-full'
            )}
            style={
              layout === 'side-by-side'
                ? { width: `${100 - splitRatio}%` }
                : undefined
            }
          >
            <TemplateOutputView
              templateContent={templateContent}
              extractedFields={extractedFields}
              templateName={templateName}
              templateId={templateId}
              onEditTemplate={onEditTemplate}
              onExport={onExport}
              className="h-full"
              documentText={documentText}
              editable={editable}
              onTemplateChange={onTemplateChange}
              onFieldsChange={onFieldsChange}
              onSaveTemplate={onSaveTemplate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
