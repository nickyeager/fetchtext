import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { EditorToolbar, type LayoutMode } from './EditorToolbar'
import { SplitPanelContainer } from './SplitPanelContainer'
import { SectionRenderer } from './SectionRenderer'
import { DocumentPreviewPanel } from './DocumentPreviewPanel'
import { DocumentTemplateEditor } from './DocumentTemplateEditor'
import type { EditMode } from './ModeSelector'
import type { FieldOverride } from '@/services/document-override-service'

export type ViewMode = 'simple' | 'wysiwyg'

interface ExtractedField {
  value: string | null
  confidence?: number
  sourceText?: string
  type?: string
}

interface SplitDocumentEditorProps {
  /** Document ID */
  documentId: string
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
  /** Enable inline editing */
  editable?: boolean
  /** Enable field value overrides */
  enableOverrides?: boolean
  /** Initial view mode */
  initialViewMode?: ViewMode
  /** Current field overrides */
  fieldOverrides?: Record<string, FieldOverride>
  /** Callback to save override */
  onSaveOverride?: (
    fieldName: string,
    newValue: string,
    originalValue: string | null
  ) => Promise<void>
  /** Callback to reset override */
  onResetOverride?: (fieldName: string) => Promise<void>
  /** Callback to save template content */
  onSaveTemplate?: (
    content: string,
    action: 'create' | 'modify',
    newName?: string
  ) => Promise<void>
  /** Callback to export document */
  onExport?: () => void
  /** Whether the editor is read-only */
  readOnly?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Main split document editor component
 * Orchestrates the toolbar, split panels, and content areas
 */
export function SplitDocumentEditor({
  documentId,
  fileUrl,
  fileName,
  fileType,
  fileSize,
  templateContent,
  extractedFields,
  templateName,
  templateId,
  editable = false,
  enableOverrides = false,
  initialViewMode = 'simple',
  fieldOverrides = {},
  onSaveOverride,
  onResetOverride,
  onSaveTemplate,
  onExport,
  readOnly = false,
  className,
}: SplitDocumentEditorProps) {
  // State
  const [editMode, setEditMode] = useState<EditMode>('override')
  const [layout, setLayout] = useState<LayoutMode>('side-by-side')
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [sectionOverrides, setSectionOverrides] = useState<Record<string, { value: string; original_value: string; modified_at: string }>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [wysiwygContent, setWysiwygContent] = useState(templateContent)

  // Normalize extracted fields to consistent format
  const normalizedFields = useMemo(() => {
    const result: Record<string, ExtractedField> = {}
    for (const [key, value] of Object.entries(extractedFields)) {
      if (value === null) {
        result[key] = { value: null }
      } else if (typeof value === 'string') {
        result[key] = { value }
      } else {
        result[key] = value as ExtractedField
      }
    }
    return result
  }, [extractedFields])

  // Calculate field counts
  const fieldCount = useMemo(() => {
    const entries = Object.entries(normalizedFields)
    const filled = entries.filter(([_, f]) => f.value !== null && f.value !== '').length
    return { filled, total: entries.length }
  }, [normalizedFields])

  // Count overrides
  const overrideCount = useMemo(() => {
    return Object.keys(fieldOverrides).length
  }, [fieldOverrides])

  // Handle section edit
  const handleSectionEdit = useCallback((sectionId: string) => {
    if (readOnly) return
    setEditingSectionId(sectionId)
  }, [readOnly])

  // Handle section save
  const handleSectionSave = useCallback(async (sectionId: string, newContent: string) => {
    if (editMode === 'override') {
      // Save as document-level override
      const originalContent = templateContent
      setSectionOverrides(prev => ({
        ...prev,
        [sectionId]: {
          value: newContent,
          original_value: originalContent,
          modified_at: new Date().toISOString(),
        },
      }))
    } else {
      // Template edit - will need save confirmation
      setHasChanges(true)
    }
    setEditingSectionId(null)
  }, [editMode, templateContent])

  // Handle section cancel
  const handleSectionCancel = useCallback(() => {
    setEditingSectionId(null)
  }, [])

  // Handle section reset
  const handleSectionReset = useCallback((sectionId: string) => {
    setSectionOverrides(prev => {
      const { [sectionId]: _, ...rest } = prev
      return rest
    })
  }, [])

  // Handle field override
  const handleFieldOverride = useCallback(async (
    fieldName: string,
    newValue: string,
    originalValue: string | null
  ) => {
    if (onSaveOverride) {
      await onSaveOverride(fieldName, newValue, originalValue)
    }
  }, [onSaveOverride])

  // Handle save
  const handleSave = useCallback(async () => {
    if (!onSaveTemplate || !hasChanges) return
    // TODO: Open save dialog to confirm action
    setHasChanges(false)
  }, [onSaveTemplate, hasChanges])

  // Render original document panel
  const originalPanel = (
    <div data-testid="original-document-panel" className="h-full">
      <DocumentPreviewPanel
        fileUrl={fileUrl}
        fileName={fileName}
        fileType={fileType}
        fileSize={fileSize}
        className="h-full"
      />
    </div>
  )

  // Handle WYSIWYG content changes
  const handleWysiwygChange = useCallback((content: string) => {
    setWysiwygContent(content)
    setHasChanges(true)
  }, [])

  // Prepare extracted data for WYSIWYG editor
  const extractedDataForEditor = useMemo(() => {
    const result: Record<string, string | null> = {}
    for (const [key, field] of Object.entries(normalizedFields)) {
      result[key] = field.value
    }
    return result
  }, [normalizedFields])

  // Render template output panel
  const outputPanel = (
    <div data-testid="template-output-panel" className="h-full overflow-auto p-4">
      {viewMode === 'wysiwyg' ? (
        <DocumentTemplateEditor
          content={wysiwygContent}
          onChange={handleWysiwygChange}
          extractedData={extractedDataForEditor}
          fieldOverrides={fieldOverrides}
          onValueChange={handleFieldOverride}
          onResetOverride={onResetOverride}
          readOnly={readOnly}
          showToolbar={editable && !readOnly}
          height="100%"
        />
      ) : (
        <SectionRenderer
          content={templateContent}
          extractedFields={normalizedFields}
          editingSectionId={editingSectionId}
          sectionOverrides={sectionOverrides}
          fieldOverrides={fieldOverrides}
          editMode={editMode}
          onSectionEdit={handleSectionEdit}
          onSectionSave={handleSectionSave}
          onSectionCancel={handleSectionCancel}
          onFieldOverride={handleFieldOverride}
          onResetSection={handleSectionReset}
          onResetFieldOverride={onResetOverride}
          readOnly={readOnly}
          enableSectionEditing={editable && !readOnly}
          enableOverrides={enableOverrides}
        />
      )}
    </div>
  )

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Toolbar */}
      <EditorToolbar
        editMode={editMode}
        onEditModeChange={setEditMode}
        layout={layout}
        onLayoutChange={setLayout}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        hasChanges={hasChanges}
        onSave={handleSave}
        onExport={onExport}
        templateName={templateName}
        fieldCount={fieldCount}
        overrideCount={overrideCount}
        disabled={readOnly}
      />

      {/* Split panel content */}
      <div className="min-h-0 flex-1">
        <SplitPanelContainer
          layout={layout}
          leftPanel={originalPanel}
          rightPanel={outputPanel}
        />
      </div>
    </div>
  )
}
