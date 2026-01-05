import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import {
  FileOutput,
  Check,
  AlertCircle,
  Edit,
  Download,
  Copy,
  Loader2,
  Save,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Undo,
  Redo,
} from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { VariableBadge } from '@/lib/tiptap/extensions/VariableBadge'
import { VariableAutocomplete } from '@/lib/tiptap/extensions/VariableAutocomplete'
import { getVariableSuggestionOptions } from '@/lib/tiptap/suggestion-renderer'
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced'
import { SaveTemplateDialog } from './SaveTemplateDialog'
import { FieldOverrideIndicator } from './FieldOverrideIndicator'
import { InlineFieldEditor } from './InlineFieldEditor'
import { DocumentOverrideBadge } from './DocumentOverrideBadge'
import type { FieldOverride } from '@/services/document-override-service'

interface ExtractedField {
  value: string | null
  confidence?: number
  sourceText?: string
  type?: string
}

interface TemplateOutputViewProps {
  /** Template content with {{variable}} placeholders */
  templateContent: string
  /** Extracted fields with values */
  extractedFields: Record<string, ExtractedField | string | null>
  /** Template name */
  templateName?: string
  /** Template ID for editing */
  templateId?: number
  /** Whether to show the raw template vs filled */
  showRaw?: boolean
  /** Handler for editing the template */
  onEditTemplate?: () => void
  /** Handler for exporting the filled document */
  onExport?: () => void
  /** Custom class name */
  className?: string
  /** Document text content for real-time extraction */
  documentText?: string
  /** Enable inline editing mode */
  editable?: boolean
  /** Callback when template content changes (with new variables) */
  onTemplateChange?: (content: string) => void
  /** Callback when fields are extracted */
  onFieldsChange?: (fields: Record<string, ExtractedField>) => void
  /** Callback to save template (create new or modify existing) */
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
}

// Normalize a key for fuzzy matching (remove spaces, underscores, dashes, lowercase)
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '')
}

// Find a matching field using fuzzy key matching
function findMatchingField(
  fields: Record<string, ExtractedField>,
  varName: string
): ExtractedField | null {
  // Try exact match first
  if (fields[varName]) {
    return fields[varName]
  }

  // Try normalized match
  const normalizedVar = normalizeKey(varName)
  for (const [key, value] of Object.entries(fields)) {
    if (normalizeKey(key) === normalizedVar) {
      return value
    }
  }

  return null
}

// Extract variable names from template content
function extractVariablesFromContent(content: string): string[] {
  const regex = /\{\{(\w+)\}\}/g
  const matches = content.matchAll(regex)
  return Array.from(matches, (m) => m[1])
}

// Convert {{variable}} syntax to HTML with variable badge nodes
function templateToHtml(template: string): string {
  // Escape HTML entities first
  let html = template
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Convert {{variable}} to variable badge spans
  html = html.replace(
    /\{\{(\w+)\}\}/g,
    '<span data-variable-badge data-variable-id="$1" data-variable-name="$1">{{$1}}</span>'
  )

  // Convert newlines to paragraphs
  const paragraphs = html.split(/\n\n+/)
  if (paragraphs.length > 1) {
    html = paragraphs.map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
  } else {
    html = `<p>${html.replace(/\n/g, '<br>')}</p>`
  }

  return html
}

// Convert HTML with variable badges back to {{variable}} syntax
function htmlToTemplate(html: string): string {
  // Remove wrapping tags and convert back
  const template = html
    // Remove variable badge spans, keep just {{variable}}
    .replace(
      /<span[^>]*data-variable-badge[^>]*data-variable-name="(\w+)"[^>]*>[^<]*<\/span>/g,
      '{{$1}}'
    )
    // Also handle the case where attributes are in different order
    .replace(
      /<span[^>]*data-variable-name="(\w+)"[^>]*data-variable-badge[^>]*>[^<]*<\/span>/g,
      '{{$1}}'
    )
    // Convert paragraphs to double newlines
    .replace(/<\/p>\s*<p>/g, '\n\n')
    // Remove remaining p tags
    .replace(/<\/?p>/g, '')
    // Convert br to newlines
    .replace(/<br\s*\/?>/g, '\n')
    // Decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    // Remove any other HTML tags
    .replace(/<[^>]+>/g, '')
    // Trim extra whitespace
    .trim()

  return template
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
  documentText,
  editable = false,
  onTemplateChange,
  onFieldsChange,
  onSaveTemplate,
  enableOverrides = false,
  fieldOverrides = {},
  onFieldOverride,
  onResetOverride,
  readOnly = false,
}: TemplateOutputViewProps) {
  // Internal edit mode state (allows inline toggle without parent control)
  const [isInlineEditing, setIsInlineEditing] = useState(false)

  // Combined edit mode: either parent-controlled or internal
  const isEditing = editable || isInlineEditing

  // Editing state
  const [editableContent, setEditableContent] = useState(templateContent)
  const [loadingVariables, setLoadingVariables] = useState<Set<string>>(
    new Set()
  )
  const [localExtractedFields, setLocalExtractedFields] = useState<
    Record<string, ExtractedField>
  >({})
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Field editing state for inline override editing
  const [editingFieldName, setEditingFieldName] = useState<string | null>(null)
  const [isSavingOverride, setIsSavingOverride] = useState(false)

  // Refs
  const previousVariablesRef = useRef<Set<string>>(new Set())
  const processorRef = useRef<DocumentProcessorEnhanced | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize processor
  useEffect(() => {
    processorRef.current = new DocumentProcessorEnhanced()
  }, [])

  // Sync with prop changes
  useEffect(() => {
    setEditableContent(templateContent)
    previousVariablesRef.current = new Set(
      extractVariablesFromContent(templateContent)
    )
  }, [templateContent])

  // Debug: Log incoming extractedFields
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[TemplateOutputView] extractedFields received:', {
      keys: Object.keys(extractedFields),
      fieldCount: Object.keys(extractedFields).length,
      sample: Object.entries(extractedFields).slice(0, 3),
    })
  }, [extractedFields])

  // Merge local extracted fields with prop extracted fields
  const mergedExtractedFields = useMemo(() => {
    return { ...extractedFields, ...localExtractedFields }
  }, [extractedFields, localExtractedFields])

  // Normalize fields to consistent structure
  const normalizedFields = useMemo(() => {
    const result: Record<string, ExtractedField> = {}
    for (const [key, value] of Object.entries(mergedExtractedFields)) {
      if (value === null || value === undefined) {
        result[key] = { value: null }
      } else if (typeof value === 'string') {
        result[key] = { value }
      } else if (typeof value === 'object' && 'value' in value) {
        result[key] = value as ExtractedField
      } else {
        result[key] = { value: JSON.stringify(value) }
      }
    }
    // eslint-disable-next-line no-console
    console.log('[TemplateOutputView] normalizedFields:', {
      keys: Object.keys(result),
      fieldCount: Object.keys(result).length,
    })
    return result
  }, [mergedExtractedFields])

  // Extract a single variable using the backend
  const extractSingleVariable = useCallback(
    async (variableName: string) => {
      if (!documentText || !processorRef.current) {
        // eslint-disable-next-line no-console
        console.warn(
          '[TemplateOutputView] Cannot extract - no documentText or processor'
        )
        return
      }

      // eslint-disable-next-line no-console
      console.log(`[TemplateOutputView] Extracting variable: ${variableName}`)

      // Mark as loading
      setLoadingVariables((prev) => new Set(prev).add(variableName))

      try {
        // Create a minimal template structure for single variable extraction
        // Satisfies SmartTemplate interface from document-processor-enhanced.ts
        const singleVarTemplate = {
          id: 0,
          name: 'temp',
          description: 'Temporary template for single variable extraction',
          template_content: `{{${variableName}}}`,
          category: 'temp',
          tags: [] as string[],
          smart_variables: [
            {
              id: variableName,
              name: variableName,
              type: 'text' as const,
              description: `Extract ${variableName} from the document`,
              extraction_hints: [variableName.replace(/_/g, ' ')],
            },
          ],
        }

        const result = await processorRef.current.extractWithTemplateFast(
          documentText,
          singleVarTemplate,
          0.6
        )

        // eslint-disable-next-line no-console
        console.log(
          `[TemplateOutputView] Extraction result for ${variableName}:`,
          result
        )

        // Update local extracted fields
        if (result[variableName]) {
          const newField = result[variableName]
          setLocalExtractedFields((prev) => ({
            ...prev,
            [variableName]: newField,
          }))

          // Notify parent
          onFieldsChange?.({
            ...localExtractedFields,
            [variableName]: newField,
          })
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `[TemplateOutputView] Failed to extract ${variableName}:`,
          error
        )
        // Mark as failed extraction (null value)
        setLocalExtractedFields((prev) => ({
          ...prev,
          [variableName]: { value: null, confidence: 0 },
        }))
      } finally {
        // Remove loading state
        setLoadingVariables((prev) => {
          const next = new Set(prev)
          next.delete(variableName)
          return next
        })
      }
    },
    [documentText, localExtractedFields, onFieldsChange]
  )

  // Convert template variables to SmartVariable format for autocomplete
  const smartVariables = useMemo(() => {
    return Object.keys(normalizedFields).map((key) => ({
      id: key,
      name: key,
      type: 'text' as const,
      description: `Variable: ${key}`,
      extraction_hints: [key.replace(/_/g, ' ')],
    }))
  }, [normalizedFields])

  // Get suggestion options for variable autocomplete
  const suggestionOptions = useMemo(() => getVariableSuggestionOptions(), [])

  // TipTap editor for WYSIWYG editing
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        Placeholder.configure({
          placeholder: 'Enter template content with {{variable}} placeholders...',
        }),
        VariableBadge.configure({
          extractedData: normalizedFields,
          onVariableClick: undefined,
        }),
        VariableAutocomplete.configure({
          variables: smartVariables,
          suggestion: {
            ...suggestionOptions,
            char: '{{',
          },
        }),
      ],
      content: templateToHtml(editableContent),
      editable: true,
      onUpdate: ({ editor: ed }) => {
        const html = ed.getHTML()
        const newContent = htmlToTemplate(html)
        setEditableContent(newContent)
        setHasChanges(newContent !== templateContent)
        onTemplateChange?.(newContent)

        // Debounced variable detection
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = setTimeout(() => {
          const currentVariables = new Set(extractVariablesFromContent(newContent))
          const previousVariables = previousVariablesRef.current

          for (const varName of currentVariables) {
            if (
              !previousVariables.has(varName) &&
              !normalizedFields[varName] &&
              !loadingVariables.has(varName)
            ) {
              extractSingleVariable(varName)
            }
          }

          previousVariablesRef.current = currentVariables
        }, 500)
      },
    },
    [isEditing, smartVariables] // Recreate editor when editing mode changes
  )

  // Sync editor content when template changes externally
  useEffect(() => {
    if (editor && !isEditing) {
      const newHtml = templateToHtml(templateContent)
      if (editor.getHTML() !== newHtml) {
        editor.commands.setContent(newHtml)
      }
    }
  }, [templateContent, editor, isEditing])

  // Update editor extracted data when fields change
  useEffect(() => {
    if (editor) {
      editor.extensionManager.extensions.forEach((ext) => {
        if (ext.name === 'variableBadge') {
          ext.options.extractedData = normalizedFields
        }
      })
    }
  }, [normalizedFields, editor])

  // Handle save template
  const handleSaveTemplate = useCallback(
    async (action: 'create' | 'modify', newName?: string) => {
      if (onSaveTemplate) {
        await onSaveTemplate(editableContent, action, newName)
        setHasChanges(false)
      }
    },
    [editableContent, onSaveTemplate]
  )

  // Handle field override edit (double-click to edit)
  const handleFieldEdit = useCallback(
    (fieldName: string, _currentValue: string | number | null) => {
      if (readOnly || !enableOverrides) return
      setEditingFieldName(fieldName)
    },
    [readOnly, enableOverrides]
  )

  // Handle saving field override
  const handleSaveFieldOverride = useCallback(
    async (newValue: string) => {
      if (!editingFieldName || !onFieldOverride) return

      setIsSavingOverride(true)
      try {
        const field = normalizedFields[editingFieldName]
        const originalValue = field?.value || null
        await onFieldOverride(editingFieldName, newValue, originalValue)
        setEditingFieldName(null)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[TemplateOutputView] Failed to save field override:', error)
      } finally {
        setIsSavingOverride(false)
      }
    },
    [editingFieldName, onFieldOverride, normalizedFields]
  )

  // Handle canceling field edit
  const handleCancelFieldEdit = useCallback(() => {
    setEditingFieldName(null)
  }, [])

  // Handle resetting field override
  const handleResetFieldOverride = useCallback(
    async (fieldName: string) => {
      if (!onResetOverride) return
      try {
        await onResetOverride(fieldName)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[TemplateOutputView] Failed to reset field override:', error)
      }
    },
    [onResetOverride]
  )

  // Handle entering inline edit mode
  const handleEnterEditMode = useCallback(() => {
    if (readOnly) return
    setIsInlineEditing(true)
  }, [readOnly])

  // Handle exiting inline edit mode
  const handleExitEditMode = useCallback(() => {
    setIsInlineEditing(false)
  }, [])

  // Handle keyboard shortcuts in edit mode
  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExitEditMode()
      }
    },
    [handleExitEditMode]
  )

  // Count overrides
  const overrideCount = Object.keys(fieldOverrides).length

  // Parse template content for display mode
  const renderedContent = useMemo(() => {
    const contentToRender = isEditing ? editableContent : templateContent
    if (!contentToRender) return null

    const parts: Array<{
      type: 'text' | 'variable'
      content: string
      field?: ExtractedField
      isLoading?: boolean
    }> = []
    const regex = /\{\{(\w+)\}\}/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(contentToRender)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: contentToRender.slice(lastIndex, match.index),
        })
      }

      const varName = match[1]
      const field = findMatchingField(normalizedFields, varName) || {
        value: null,
      }
      const isLoading = loadingVariables.has(varName)

      parts.push({
        type: 'variable',
        content: varName,
        field,
        isLoading,
      })

      lastIndex = match.index + match[0].length
    }

    if (lastIndex < contentToRender.length) {
      parts.push({
        type: 'text',
        content: contentToRender.slice(lastIndex),
      })
    }

    return parts
  }, [
    templateContent,
    editableContent,
    isEditing,
    normalizedFields,
    loadingVariables,
  ])

  const filledCount = Object.values(normalizedFields).filter(
    (f) => f.value
  ).length
  const totalCount = Object.keys(normalizedFields).length

  const getConfidenceColor = (conf?: number) => {
    if (!conf) return 'text-muted-foreground'
    if (conf >= 0.9) return 'text-green-600 dark:text-green-400'
    if (conf >= 0.7) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const copyToClipboard = async () => {
    let filledText = isEditing ? editableContent : templateContent
    for (const [key, field] of Object.entries(normalizedFields)) {
      const placeholder = `{{${key}}}`
      const value = field.value || `[${key}]`
      filledText = filledText.replace(
        new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
        value
      )
    }
    await navigator.clipboard.writeText(filledText)
  }

  return (
    <>
      <Card className={cn('flex h-full flex-col', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileOutput className="h-5 w-5" />
              {isEditing ? 'Edit Template' : 'Generated Output From the Template'}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {filledCount}/{totalCount} fields
              </Badge>
              {/* Show override badge when there are overrides */}
              {enableOverrides && overrideCount > 0 && (
                <DocumentOverrideBadge
                  overrideCount={overrideCount}
                  fieldOverrideCount={overrideCount}
                />
              )}
              {loadingVariables.size > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Extracting...
                </Badge>
              )}
              {isEditing && hasChanges && onSaveTemplate && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                >
                  <Save className="mr-1 h-4 w-4" />
                  Save Template
                </Button>
              )}
              {/* Done button to exit inline edit mode */}
              {isInlineEditing && (
                <Button variant="outline" size="sm" onClick={handleExitEditMode}>
                  Done
                </Button>
              )}
              {/* Edit button only when not in edit mode and has templateId */}
              {onEditTemplate && templateId && !isEditing && (
                <Button variant="outline" size="sm" onClick={onEditTemplate}>
                  <Edit className="mr-1 h-4 w-4" />
                  Edit
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                title="Copy to clipboard"
              >
                <Copy className="h-4 w-4" />
              </Button>
              {onExport && (
                <Button variant="default" size="sm" onClick={onExport}>
                  <Download className="mr-1 h-4 w-4" />
                  Export
                </Button>
              )}
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            {templateName || 'No template applied'}
            {isEditing && (
              <span className="ml-2 text-blue-600 dark:text-blue-400">
                - Type {'{{variable_name}}'} to add and extract new fields
                {isInlineEditing && ' (Press Escape to exit)'}
              </span>
            )}
          </p>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          {isEditing ? (
            // WYSIWYG TipTap editor mode
            <div className="template-output-editor flex flex-col h-full" onKeyDown={handleEditKeyDown}>
              {/* Minimal Toolbar */}
              <div className="flex flex-wrap items-center gap-1 pb-2 border-b mb-2">
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor?.chain().focus().toggleBold().run()}
                        className={cn('h-8 w-8 p-0', editor?.isActive('bold') && 'bg-muted')}
                      >
                        <Bold className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Bold (Ctrl+B)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor?.chain().focus().toggleItalic().run()}
                        className={cn('h-8 w-8 p-0', editor?.isActive('italic') && 'bg-muted')}
                      >
                        <Italic className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Italic (Ctrl+I)</TooltipContent>
                  </Tooltip>
                  <Separator orientation="vertical" className="mx-1 h-6" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                        className={cn('h-8 w-8 p-0', editor?.isActive('heading', { level: 1 }) && 'bg-muted')}
                      >
                        <Heading1 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Heading 1</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={cn('h-8 w-8 p-0', editor?.isActive('heading', { level: 2 }) && 'bg-muted')}
                      >
                        <Heading2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Heading 2</TooltipContent>
                  </Tooltip>
                  <Separator orientation="vertical" className="mx-1 h-6" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor?.chain().focus().toggleBulletList().run()}
                        className={cn('h-8 w-8 p-0', editor?.isActive('bulletList') && 'bg-muted')}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Bullet List</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                        className={cn('h-8 w-8 p-0', editor?.isActive('orderedList') && 'bg-muted')}
                      >
                        <ListOrdered className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Numbered List</TooltipContent>
                  </Tooltip>
                  <Separator orientation="vertical" className="mx-1 h-6" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor?.chain().focus().undo().run()}
                        disabled={!editor?.can().undo()}
                        className="h-8 w-8 p-0"
                      >
                        <Undo className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Undo (Ctrl+Z)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor?.chain().focus().redo().run()}
                        disabled={!editor?.can().redo()}
                        className="h-8 w-8 p-0"
                      >
                        <Redo className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Redo (Ctrl+Y)</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {/* Editor Content */}
              <style>{`
                .template-output-editor .ProseMirror {
                  min-height: 250px;
                  max-height: 500px;
                  overflow-y: auto;
                  outline: none;
                }
                .template-output-editor .ProseMirror p.is-editor-empty:first-child::before {
                  color: #adb5bd;
                  content: attr(data-placeholder);
                  float: left;
                  height: 0;
                  pointer-events: none;
                }
                .template-output-editor .ProseMirror h1 {
                  font-size: 1.75em;
                  font-weight: bold;
                  margin: 0.5em 0;
                }
                .template-output-editor .ProseMirror h2 {
                  font-size: 1.5em;
                  font-weight: bold;
                  margin: 0.5em 0;
                }
                .template-output-editor .ProseMirror h3 {
                  font-size: 1.25em;
                  font-weight: bold;
                  margin: 0.5em 0;
                }
                .template-output-editor .ProseMirror p {
                  margin: 0.5em 0;
                }
                .template-output-editor .ProseMirror ul,
                .template-output-editor .ProseMirror ol {
                  margin: 0.5em 0;
                  padding-left: 1.5em;
                }
              `}</style>
              <EditorContent
                editor={editor}
                className={cn(
                  'prose prose-sm dark:prose-invert max-w-none flex-1',
                  'rounded-lg border p-4',
                  'focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2'
                )}
              />
            </div>
          ) : (
            // Read-only display mode with variable badges - click to edit
            <ScrollArea className="h-full">
              <div
                className={cn(
                  'prose prose-sm dark:prose-invert bg-muted/30 max-w-none rounded-lg p-4 font-mono text-sm whitespace-pre-wrap',
                  !readOnly && 'cursor-text hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
                )}
                onClick={handleEnterEditMode}
                onKeyDown={(e) => {
                  if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    handleEnterEditMode()
                  }
                }}
                {...(!readOnly && {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': 'Click to edit template',
                })}
              >
                <TooltipProvider delayDuration={200}>
                  {renderedContent?.map((part, index) => {
                    if (part.type === 'text') {
                      return <span key={index}>{part.content}</span>
                    }

                    const field = part.field!
                    const fieldName = part.content
                    const isLoading = part.isLoading
                    const hasValue = field.value !== null && field.value !== ''
                    const confidencePercent = field.confidence
                      ? Math.round(field.confidence * 100)
                      : null

                    // Check if this field has an override
                    const override = fieldOverrides[fieldName]
                    const isOverride = !!override
                    const displayValue = isOverride
                      ? String(override.value ?? '')
                      : field.value

                    // If we're editing this field, show the inline editor
                    if (editingFieldName === fieldName) {
                      return (
                        <span key={index} className="mx-0.5 inline-block">
                          <InlineFieldEditor
                            fieldName={fieldName}
                            currentValue={displayValue || ''}
                            onSave={handleSaveFieldOverride}
                            onCancel={handleCancelFieldEdit}
                          />
                        </span>
                      )
                    }

                    // When overrides are enabled, use FieldOverrideIndicator
                    if (enableOverrides && hasValue) {
                      return (
                        <span key={index} className="mx-0.5 inline-block">
                          <FieldOverrideIndicator
                            fieldName={fieldName}
                            value={displayValue}
                            originalValue={isOverride ? override.original_value : undefined}
                            isOverride={isOverride}
                            confidence={field.confidence}
                            modifiedBy={override?.modified_by_name}
                            modifiedAt={override?.modified_at}
                            onReset={isOverride ? handleResetFieldOverride : undefined}
                            onEdit={handleFieldEdit}
                            readOnly={readOnly}
                          />
                        </span>
                      )
                    }

                    // Standard rendering (no overrides enabled or loading state)
                    return (
                      <Tooltip key={index}>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              'mx-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5',
                              'cursor-help transition-colors',
                              isLoading
                                ? 'border border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                                : hasValue
                                  ? 'border border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200'
                                  : 'border border-dashed border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                            )}
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Extracting...</span>
                              </>
                            ) : showRaw ? (
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
                        <TooltipContent
                          side="top"
                          className="max-w-sm space-y-2 p-3"
                        >
                          <div className="text-muted-foreground font-mono text-xs">
                            {part.content}
                          </div>
                          {isLoading ? (
                            <div className="text-blue-600 text-sm flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Extracting from document...
                            </div>
                          ) : hasValue ? (
                            <>
                              <div className="border-primary border-l-2 pl-2 text-sm font-medium">
                                {field.value}
                              </div>
                              {confidencePercent !== null && (
                                <div
                                  className={cn(
                                    'text-xs',
                                    getConfidenceColor(field.confidence)
                                  )}
                                >
                                  {confidencePercent}% confidence
                                </div>
                              )}
                              {field.sourceText && (
                                <div className="text-muted-foreground border-t pt-2 text-xs">
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
                    )
                  })}
                </TooltipProvider>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Save Template Dialog */}
      <SaveTemplateDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        templateName={templateName}
        templateId={templateId}
        onSave={handleSaveTemplate}
      />
    </>
  )
}
