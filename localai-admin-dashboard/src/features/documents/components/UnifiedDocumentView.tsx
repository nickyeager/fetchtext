import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { DocumentPreviewPanel } from './DocumentPreviewPanel'
import { TemplateOutputView } from './TemplateOutputView'
import type { FieldOverride } from '@/services/document-override-service'

interface ExtractedField {
  value: string | null
  confidence?: number
  sourceText?: string
  type?: string
}

interface UnifiedDocumentViewProps {
  /** Original document file URL */
  fileUrl: string | null
  /** Original document file name */
  fileName: string
  /** Original document file type */
  fileType: string
  /** Original document file size */
  fileSize?: number
  /** Template content with {{variable}} placeholders */
  templateContent: string
  /** Extracted fields with values */
  extractedFields: Record<string, ExtractedField | string | null>
  /** Template name */
  templateName?: string
  /** Template ID */
  templateId?: number
  /** Handler for editing template */
  onEditTemplate?: () => void
  /** Handler for export */
  onExport?: () => void
  /** Custom class name */
  className?: string
  /** Document text content for real-time extraction */
  documentText?: string
  /** Enable inline editing mode */
  editable?: boolean
  /** Callback when template content changes */
  onTemplateChange?: (content: string) => void
  /** Callback when fields are extracted */
  onFieldsChange?: (fields: Record<string, ExtractedField>) => void
  /** Callback to save template */
  onSaveTemplate?: (
    content: string,
    action: 'create' | 'modify',
    newName?: string
  ) => Promise<void>
  /** Enable field value overrides (document-level, not template changes) */
  enableOverrides?: boolean
  /** Current field overrides for this document */
  fieldOverrides?: Record<string, FieldOverride>
  /** Callback when a field value is overridden */
  onFieldOverride?: (
    fieldName: string,
    newValue: string,
    originalValue: string | null
  ) => Promise<void>
  /** Callback when a field override is reset */
  onResetOverride?: (fieldName: string) => Promise<void>
  /** Whether the view is read-only (no edits allowed) */
  readOnly?: boolean
  /** Whether save is in progress */
  isSaving?: boolean
  /** Last saved timestamp */
  lastSavedAt?: Date | null
}

export function UnifiedDocumentView({
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
  enableOverrides,
  fieldOverrides,
  onFieldOverride,
  onResetOverride,
  readOnly,
  isSaving,
  lastSavedAt,
}: UnifiedDocumentViewProps) {
  // Default to Output view (true = Output, false = Original)
  const [showOutput, setShowOutput] = useState(true)

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Toggle Switch */}
      <div className="mb-4 flex items-center justify-center gap-3">
        <Label
          htmlFor="view-toggle"
          className={cn(
            'cursor-pointer text-sm transition-colors',
            !showOutput ? 'font-medium text-foreground' : 'text-muted-foreground'
          )}
        >
          Original
        </Label>
        <Switch
          id="view-toggle"
          checked={showOutput}
          onCheckedChange={setShowOutput}
          aria-label="Toggle between original document and generated output"
        />
        <Label
          htmlFor="view-toggle"
          className={cn(
            'cursor-pointer text-sm transition-colors',
            showOutput ? 'font-medium text-foreground' : 'text-muted-foreground'
          )}
        >
          Output
        </Label>
      </div>

      {/* Content Area - conditionally render one or the other */}
      <div className="min-h-0 flex-1">
        {showOutput ? (
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
            enableOverrides={enableOverrides}
            fieldOverrides={fieldOverrides}
            onFieldOverride={onFieldOverride}
            onResetOverride={onResetOverride}
            readOnly={readOnly}
            isSaving={isSaving}
            lastSavedAt={lastSavedAt}
          />
        ) : (
          <DocumentPreviewPanel
            fileUrl={fileUrl}
            fileName={fileName}
            fileType={fileType}
            fileSize={fileSize}
            className="h-full"
          />
        )}
      </div>
    </div>
  )
}
