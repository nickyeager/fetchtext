import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import type { FieldOverride } from '@/services/document-override-service'
import type { ExtractedFieldUpdate } from '@/types/extraction'
import Placeholder from '@tiptap/extension-placeholder'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
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
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced'
import { getExtractingFields } from '@/lib/field-extraction-state'
import { VariableAutocomplete } from '@/lib/tiptap/extensions/VariableAutocomplete'
import { VariableBadge } from '@/lib/tiptap/extensions/VariableBadge'
import { getVariableSuggestionOptions } from '@/lib/tiptap/suggestion-renderer'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth-context'
import { useFieldExtraction } from '@/hooks/use-field-extraction'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { DocumentOverrideBadge } from './DocumentOverrideBadge'
import { FieldOverrideIndicator } from './FieldOverrideIndicator'
import { InlineFieldEditor } from './InlineFieldEditor'
import { SaveTemplateDialog } from './SaveTemplateDialog'

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
  templateId?: number | string
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
  /** Document ID for saving extracted fields */
  documentId?: string
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
  /** Whether save is in progress */
  isSaving?: boolean
  /** Last saved timestamp */
  lastSavedAt?: Date | null
}

// Normalize a key for fuzzy matching (remove spaces, underscores, dashes, lowercase)
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '')
}

// Convert a key to snake_case for template variable matching
// "Contract Type" -> "contract_type", "Invoice Number" -> "invoice_number"
function toSnakeCase(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_') // spaces to underscores
    .replace(/-+/g, '_') // dashes to underscores
    .replace(/_+/g, '_') // collapse multiple underscores
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

// Convert {{variable}} syntax and Markdown to HTML for TipTap editor
function templateToHtml(template: string): string {
  // First strip any existing HTML tags (TipTap may have wrapped content before)
  let text = template.replace(/<[^>]+>/g, '')

  // Convert escaped newlines to actual newlines
  text = text.replace(/\\n/g, '\n')

  // Escape HTML entities
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Convert {{variable}} to variable badge spans (preserve for later)
  // Use data-variable-badge="" (with value) to ensure TipTap parses it correctly
  text = text.replace(
    /\{\{(\w+)\}\}/g,
    '<span data-variable-badge="" data-variable-id="$1" data-variable-name="$1">{{$1}}</span>'
  )

  // Process line by line for block-level Markdown
  const lines = text.split('\n')
  const htmlLines: string[] = []
  let inList = false
  let listType: 'ul' | 'ol' | null = null
  let listItems: string[] = []

  const closeList = () => {
    if (inList && listItems.length > 0) {
      const listHtml = listItems.map((item) => `<li>${item}</li>`).join('')
      htmlLines.push(`<${listType}>${listHtml}</${listType}>`)
      listItems = []
      inList = false
      listType = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Headings: # Heading 1, ## Heading 2, ### Heading 3
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      closeList()
      const level = headingMatch[1].length
      const content = processInlineMarkdown(headingMatch[2])
      htmlLines.push(`<h${level}>${content}</h${level}>`)
      continue
    }

    // Horizontal rule: --- or ***
    if (/^[-*]{3,}$/.test(line.trim())) {
      closeList()
      htmlLines.push('<hr>')
      continue
    }

    // Blockquote: > text
    const blockquoteMatch = line.match(/^>\s*(.*)$/)
    if (blockquoteMatch) {
      closeList()
      const content = processInlineMarkdown(blockquoteMatch[1])
      htmlLines.push(`<blockquote><p>${content}</p></blockquote>`)
      continue
    }

    // Bullet list: - item or * item
    const bulletMatch = line.match(/^[-*]\s+(.+)$/)
    if (bulletMatch) {
      if (!inList || listType !== 'ul') {
        closeList()
        inList = true
        listType = 'ul'
      }
      listItems.push(processInlineMarkdown(bulletMatch[1]))
      continue
    }

    // Numbered list: 1. item
    const numberedMatch = line.match(/^\d+\.\s+(.+)$/)
    if (numberedMatch) {
      if (!inList || listType !== 'ol') {
        closeList()
        inList = true
        listType = 'ol'
      }
      listItems.push(processInlineMarkdown(numberedMatch[1]))
      continue
    }

    // Empty line - close list and add empty paragraph
    if (line.trim() === '') {
      closeList()
      // Skip consecutive empty lines
      continue
    }

    // Regular paragraph
    closeList()
    const content = processInlineMarkdown(line)
    htmlLines.push(`<p>${content}</p>`)
  }

  // Close any remaining list
  closeList()

  return htmlLines.join('')
}

// Process inline Markdown: **bold**, *italic*, `code`
function processInlineMarkdown(text: string): string {
  return (
    text
      // Bold: **text** or __text__
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      // Italic: *text* or _text_ (but not inside words)
      .replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>')
      .replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>')
      // Inline code: `code`
      .replace(/`([^`]+)`/g, '<code>$1</code>')
  )
}

// Convert HTML with variable badges back to {{variable}} syntax and Markdown
function htmlToTemplate(html: string): string {
  let template = html
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

  // Convert headings to Markdown
  template = template
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')

  // Convert inline formatting to Markdown
  template = template
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<code>(.*?)<\/code>/gi, '`$1`')

  // Convert lists to Markdown
  template = template
    .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (_, content) => {
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n'
    })
    .replace(/<ol[^>]*>(.*?)<\/ol>/gis, (_, content) => {
      let index = 0
      return (
        content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => {
          index++
          return `${index}. $1\n`
        }) + '\n'
      )
    })

  // Convert blockquotes to Markdown
  template = template.replace(
    /<blockquote[^>]*>(.*?)<\/blockquote>/gis,
    (_, content) => {
      // Remove nested p tags and add > prefix
      const text = content.replace(/<\/?p[^>]*>/gi, '').trim()
      return `> ${text}\n\n`
    }
  )

  // Convert horizontal rules
  template = template.replace(/<hr\s*\/?>/gi, '---\n\n')

  // Convert paragraphs to double newlines
  template = template
    .replace(/<\/p>\s*<p>/g, '\n\n')
    .replace(/<p[^>]*>/g, '')
    .replace(/<\/p>/g, '\n\n')

  // Convert br to newlines
  template = template.replace(/<br\s*\/?>/gi, '\n')

  // Decode HTML entities
  template = template
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')

  // Remove any remaining HTML tags
  template = template.replace(/<[^>]+>/g, '')

  // Clean up extra whitespace
  template = template
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .trim()

  return template
}

/**
 * RichContentRenderer - Renders content that may be HTML (from TipTap) or Markdown
 * Detects the format and renders appropriately with variable badge support
 */
interface RichContentRendererProps {
  content: string
  processChildrenWithBadges: (children: React.ReactNode) => React.ReactNode
}

function RichContentRenderer({
  content,
  processChildrenWithBadges,
}: RichContentRendererProps) {
  // Always process content as Markdown - strip HTML tags and convert to clean Markdown
  const processedContent = useMemo(() => {
    if (!content) return ''

    return (
      content
        // Strip HTML tags (TipTap wraps content in <p>, etc.)
        .replace(/<[^>]+>/g, '')
        // Convert escaped newlines to actual newlines
        .replace(/\\n/g, '\n')
        // Clean up any extra whitespace
        .trim()
    )
  }, [content])

  // Always use ReactMarkdown for rendering
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        h1: ({ children }) => (
          <h1 className='mt-6 mb-4 text-2xl font-bold first:mt-0'>
            {processChildrenWithBadges(children)}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className='mt-5 mb-3 text-xl font-bold'>
            {processChildrenWithBadges(children)}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className='mt-4 mb-2 text-lg font-bold'>
            {processChildrenWithBadges(children)}
          </h3>
        ),
        p: ({ children }) => (
          <p className='mb-4 leading-relaxed'>
            {processChildrenWithBadges(children)}
          </p>
        ),
        li: ({ children }) => (
          <li className='mb-1'>{processChildrenWithBadges(children)}</li>
        ),
        strong: ({ children }) => (
          <strong className='font-semibold'>
            {processChildrenWithBadges(children)}
          </strong>
        ),
        em: ({ children }) => <em>{processChildrenWithBadges(children)}</em>,
        ul: ({ children }) => (
          <ul className='mb-4 list-disc space-y-1 pl-6'>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className='mb-4 list-decimal space-y-1 pl-6'>{children}</ol>
        ),
        blockquote: ({ children }) => (
          <blockquote className='border-primary/30 text-muted-foreground my-4 border-l-4 pl-4 italic'>
            {children}
          </blockquote>
        ),
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || '')
          const isInline = !match
          if (isInline) {
            return (
              <code
                className='bg-muted rounded px-1 py-0.5 font-mono text-sm'
                {...props}
              >
                {children}
              </code>
            )
          }
          return (
            <pre className='bg-muted my-4 overflow-x-auto rounded-md p-4'>
              <code className={`font-mono text-sm ${className}`} {...props}>
                {children}
              </code>
            </pre>
          )
        },
        table: ({ children }) => (
          <div className='my-4 overflow-x-auto'>
            <table className='divide-border min-w-full divide-y'>
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => <thead className='bg-muted'>{children}</thead>,
        th: ({ children }) => (
          <th className='text-muted-foreground px-4 py-2 text-left text-xs font-medium tracking-wider uppercase'>
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className='px-4 py-2 text-sm whitespace-nowrap'>
            {processChildrenWithBadges(children)}
          </td>
        ),
        hr: () => <hr className='border-border my-6' />,
        a: ({ href, children }) => (
          <a
            href={href}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:underline'
          >
            {children}
          </a>
        ),
      }}
    >
      {processedContent}
    </ReactMarkdown>
  )
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
  documentId,
  editable = false,
  onTemplateChange,
  onFieldsChange,
  onSaveTemplate,
  enableOverrides = false,
  fieldOverrides = {},
  onFieldOverride,
  onResetOverride,
  readOnly = false,
  isSaving = false,
  lastSavedAt = null,
}: TemplateOutputViewProps) {
  const { session } = useAuth()

  // Internal edit mode state (allows inline toggle without parent control)
  const [isInlineEditing, setIsInlineEditing] = useState(false)

  // Combined edit mode: either parent-controlled or internal
  const isEditing = editable || isInlineEditing

  // Editing state
  const [editableContent, setEditableContent] = useState(templateContent)
  const [localExtractedFields, setLocalExtractedFields] = useState<
    Record<string, ExtractedField>
  >({})
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // Field editing state for inline override editing
  const [editingFieldName, setEditingFieldName] = useState<string | null>(null)
  const [isSavingOverride, setIsSavingOverride] = useState(false)

  // Refs
  const previousVariablesRef = useRef<Set<string>>(new Set())
  const processorRef = useRef<DocumentProcessorEnhanced | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Ref to store latest onTemplateChange callback - prevents stale closure in TipTap's onUpdate
  const onTemplateChangeRef = useRef(onTemplateChange)

  // Keep the ref updated with latest callback
  useEffect(() => {
    onTemplateChangeRef.current = onTemplateChange
  }, [onTemplateChange])

  // Initialize processor
  useEffect(() => {
    const dp = new DocumentProcessorEnhanced()
    dp.setAccessToken(session?.access_token)
    processorRef.current = dp
  }, [session?.access_token])

  // Initialize field extraction hook for real-time extraction with toast notifications
  const {
    extractField,
    retryField,
    fieldStates,
    isExtracting: isFieldExtracting,
  } = useFieldExtraction({
    documentId,
    documentText,
    onFieldExtracted: (fieldUpdate: ExtractedFieldUpdate) => {
      // Update local state with extracted field
      const newField: ExtractedField = {
        value: String(fieldUpdate.value ?? ''),
        confidence: fieldUpdate.confidence,
        sourceText: fieldUpdate.sourceText,
      }
      setLocalExtractedFields((prev) => ({
        ...prev,
        [fieldUpdate.fieldName]: newField,
      }))

      // Notify parent
      onFieldsChange?.({
        ...localExtractedFields,
        [fieldUpdate.fieldName]: newField,
      })
    },
    onFieldFailed: (fieldName: string, error: string) => {
      // eslint-disable-next-line no-console
      console.error(
        `[TemplateOutputView] Field extraction failed for ${fieldName}:`,
        error
      )
      // Mark as failed in local state
      setLocalExtractedFields((prev) => ({
        ...prev,
        [fieldName]: { value: null, confidence: 0 },
      }))
    },
  })

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
  // Also add snake_case key mappings so template variables like {{contract_type}}
  // can find fields stored as "Contract Type" in the database
  const normalizedFields = useMemo(() => {
    const result: Record<string, ExtractedField> = {}
    for (const [key, value] of Object.entries(mergedExtractedFields)) {
      let normalizedValue: ExtractedField
      if (value === null || value === undefined) {
        normalizedValue = { value: null }
      } else if (typeof value === 'string') {
        normalizedValue = { value }
      } else if (typeof value === 'object' && 'value' in value) {
        normalizedValue = value as ExtractedField
      } else {
        normalizedValue = { value: JSON.stringify(value) }
      }

      // Store with original key
      result[key] = normalizedValue

      // Also store with snake_case key for template variable matching
      // e.g., "Contract Type" -> also accessible via "contract_type"
      const snakeCaseKey = toSnakeCase(key)
      if (snakeCaseKey !== key && !result[snakeCaseKey]) {
        result[snakeCaseKey] = normalizedValue
      }
    }
    // eslint-disable-next-line no-console
    console.log('[TemplateOutputView] normalizedFields:', {
      keys: Object.keys(result),
      fieldCount: Object.keys(result).length,
      sampleMappings: Object.entries(result)
        .slice(0, 5)
        .map(([k, v]) => ({ key: k, value: v?.value })),
    })
    return result
  }, [mergedExtractedFields])

  // Extract a single variable using the new extraction hook
  const extractSingleVariable = useCallback(
    async (variableName: string) => {
      if (!documentText) {
        // eslint-disable-next-line no-console
        console.warn('[TemplateOutputView] Cannot extract - no documentText')
        return
      }

      // eslint-disable-next-line no-console
      console.log(`[TemplateOutputView] Extracting variable: ${variableName}`)

      // Create SmartVariable for extraction
      const variable = {
        id: variableName,
        name: variableName,
        type: 'text' as const,
        description: `Extract ${variableName} from the document`,
        extraction_hints: [variableName.replace(/_/g, ' ')],
      }

      // Use the hook's extractField which handles toast notifications and persistence
      await extractField(variable)
    },
    [documentText, extractField]
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
          placeholder:
            'Enter template content with {{variable}} placeholders...',
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

        // Capture previous variables BEFORE notifying parent (which may trigger prop updates)
        // This prevents race condition where previousVariablesRef gets updated by useEffect
        // before our debounced extraction check runs
        const previousVariablesSnapshot = new Set(previousVariablesRef.current)

        // Use ref to avoid stale closure - always calls latest callback
        // eslint-disable-next-line no-console
        console.log('[TemplateOutputView] onUpdate fired', {
          hasCallback: !!onTemplateChangeRef.current,
          contentLength: newContent.length,
          contentPreview: newContent.substring(0, 100),
        })
        onTemplateChangeRef.current?.(newContent)

        // Debounced variable detection - uses captured snapshot to avoid race condition
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = setTimeout(() => {
          const currentVariables = new Set(
            extractVariablesFromContent(newContent)
          )

          for (const varName of currentVariables) {
            if (
              !previousVariablesSnapshot.has(varName) &&
              !normalizedFields[varName] &&
              !isFieldExtracting(varName)
            ) {
              // eslint-disable-next-line no-console
              console.log(
                `[TemplateOutputView] New variable detected, triggering extraction: ${varName}`
              )
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
  // Always sync on initial mount, and when NOT actively editing with unsaved changes
  useEffect(() => {
    if (editor) {
      const newHtml = templateToHtml(templateContent)
      // Only skip sync if user has made unsaved changes (hasChanges)
      // This allows initial content to load while preserving user edits
      if (!hasChanges && editor.getHTML() !== newHtml) {
        // eslint-disable-next-line no-console
        console.log(
          '[TemplateOutputView] Syncing editor content from templateContent',
          {
            templateContentLength: templateContent.length,
            hasChanges,
            isEditing,
          }
        )
        editor.commands.setContent(newHtml)
      }
    }
  }, [templateContent, editor, hasChanges, isEditing])

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
        console.error(
          '[TemplateOutputView] Failed to save field override:',
          error
        )
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
        console.error(
          '[TemplateOutputView] Failed to reset field override:',
          error
        )
      }
    },
    [onResetOverride]
  )

  // Handle entering inline edit mode
  const handleEnterEditMode = useCallback(() => {
    if (readOnly) return
    setIsInlineEditing(true)
  }, [readOnly])

  // Handle exiting inline edit mode - save changes first
  const handleExitEditMode = useCallback(async () => {
    // Save changes before exiting if there are any
    if (hasChanges && onSaveTemplate) {
      try {
        await onSaveTemplate(editableContent, 'modify')
        // Only exit and clear changes if save succeeded
        setIsInlineEditing(false)
        setHasChanges(false)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[TemplateOutputView] Failed to save on exit:', error)
        // Keep edit mode open so user doesn't lose work
        return
      }
    } else {
      // No changes to save, safe to exit
      setIsInlineEditing(false)
      setHasChanges(false)
    }
  }, [hasChanges, onSaveTemplate, editableContent])

  // Handle attempting to exit edit mode - show confirmation if changes exist
  const handleAttemptExit = useCallback(() => {
    if (hasChanges) {
      setShowExitConfirm(true)
    } else {
      setIsInlineEditing(false)
    }
  }, [hasChanges])

  // Handle confirmed exit (discard changes)
  const handleConfirmDiscard = useCallback(() => {
    setShowExitConfirm(false)
    setIsInlineEditing(false)
    setHasChanges(false)
    // Reset content to original
    setEditableContent(templateContent)
  }, [templateContent])

  // Handle save and exit - inline the save logic to avoid double saves
  const handleSaveAndExit = useCallback(async () => {
    setShowExitConfirm(false)
    if (hasChanges && onSaveTemplate) {
      try {
        await onSaveTemplate(editableContent, 'modify')
        setIsInlineEditing(false)
        setHasChanges(false)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[TemplateOutputView] Save & exit failed:', error)
        // Stay in edit mode on error so user doesn't lose work
      }
    } else {
      setIsInlineEditing(false)
      setHasChanges(false)
    }
  }, [hasChanges, onSaveTemplate, editableContent])

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

  // Helper function to process children and render variable badges inline
  const processChildrenWithBadges = useCallback(
    (children: React.ReactNode): React.ReactNode => {
      return React.Children.map(children, (child) => {
        if (typeof child !== 'string') {
          return child
        }

        // Split by {{variable}} pattern
        const parts = child.split(/(\{\{\w+\}\})/g)
        if (parts.length === 1) {
          return child
        }

        return parts.map((part, partIndex) => {
          const varMatch = part.match(/^\{\{(\w+)\}\}$/)
          if (!varMatch) {
            return part
          }

          const fieldName = varMatch[1]
          const field = findMatchingField(normalizedFields, fieldName) || {
            value: null,
          }
          const isLoading = isFieldExtracting(fieldName)
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
              <span key={partIndex} className='mx-0.5 inline-block'>
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
              <span key={partIndex} className='mx-0.5 inline-block'>
                <FieldOverrideIndicator
                  fieldName={fieldName}
                  value={displayValue}
                  originalValue={
                    isOverride ? override.original_value : undefined
                  }
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

          // Standard badge rendering
          return (
            <Tooltip key={partIndex}>
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
                      <Loader2 className='h-3 w-3 animate-spin' />
                      <span>Extracting...</span>
                    </>
                  ) : showRaw ? (
                    <span>{`{{${fieldName}}}`}</span>
                  ) : hasValue ? (
                    <>
                      <Check className='h-3 w-3' />
                      <span>{field.value}</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className='h-3 w-3' />
                      <span className='italic'>{`{{${fieldName}}}`}</span>
                    </>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent side='top' className='max-w-sm space-y-2 p-3'>
                <div className='text-muted-foreground font-mono text-xs'>
                  {fieldName}
                </div>
                {isLoading ? (
                  <div className='flex items-center gap-2 text-sm text-blue-600'>
                    <Loader2 className='h-3 w-3 animate-spin' />
                    Extracting from document...
                  </div>
                ) : hasValue ? (
                  <>
                    <div className='border-primary border-l-2 pl-2 text-sm font-medium'>
                      {field.value}
                    </div>
                    {confidencePercent !== null && (
                      <div
                        className={cn(
                          'text-xs',
                          field.confidence && field.confidence >= 0.9
                            ? 'text-green-600 dark:text-green-400'
                            : field.confidence && field.confidence >= 0.7
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-red-600 dark:text-red-400'
                        )}
                      >
                        {confidencePercent}% confidence
                      </div>
                    )}
                    {field.sourceText && (
                      <div className='text-muted-foreground border-t pt-2 text-xs'>
                        Source: "{field.sourceText}"
                      </div>
                    )}
                  </>
                ) : (
                  <div className='text-muted-foreground text-sm italic'>
                    No value extracted
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          )
        })
      })
    },
    [
      normalizedFields,
      isFieldExtracting,
      fieldOverrides,
      editingFieldName,
      enableOverrides,
      readOnly,
      showRaw,
      handleSaveFieldOverride,
      handleCancelFieldEdit,
      handleResetFieldOverride,
      handleFieldEdit,
    ]
  )

  // Count based on extractedFields prop (unified fields from DocumentDetailView)
  // This ensures the count matches ExtractedFieldsEditor which uses the same data source
  // Helper to check if a value is empty
  const isValueEmpty = (value: unknown): boolean => {
    if (value === null || value === undefined) return true
    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase()
      if (trimmed.length === 0) return true
      const emptyPatterns = [
        'null',
        'undefined',
        'n/a',
        'none',
        'not found',
        'not available',
        '[]',
        '{}',
      ]
      if (emptyPatterns.includes(trimmed)) return true
    }
    return false
  }

  // Get unique field keys from extractedFields prop (no snake_case duplicates)
  const uniqueFieldKeys = useMemo(() => {
    return Object.keys(extractedFields)
  }, [extractedFields])

  const totalCount = uniqueFieldKeys.length
  const filledCount = uniqueFieldKeys.filter((key) => {
    const field = normalizedFields[key]
    return field && !isValueEmpty(field.value)
  }).length

  const _getConfidenceColor = (conf?: number) => {
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
        <CardHeader className='flex-shrink-0 pb-3'>
          <div className='flex items-center justify-between'>
            <CardTitle className='flex items-center gap-2 text-lg'>
              <FileOutput className='h-5 w-5' />
              {isEditing
                ? 'Edit Template'
                : 'Generated Output From the Template'}
            </CardTitle>
            <div className='flex items-center gap-2'>
              <Badge variant='secondary'>
                {filledCount}/{totalCount} fields
              </Badge>
              {/* Show override badge when there are overrides */}
              {enableOverrides && overrideCount > 0 && (
                <DocumentOverrideBadge
                  overrideCount={overrideCount}
                  fieldOverrideCount={overrideCount}
                />
              )}
              {getExtractingFields(fieldStates).length > 0 && (
                <Badge variant='outline' className='gap-1'>
                  <Loader2 className='h-3 w-3 animate-spin' />
                  Extracting...
                </Badge>
              )}
              {/* Save status indicator */}
              {isInlineEditing &&
                (isSaving ? (
                  <Badge variant='outline' className='gap-1 text-blue-600'>
                    <Loader2 className='h-3 w-3 animate-spin' />
                    Saving...
                  </Badge>
                ) : hasChanges ? (
                  <Badge variant='outline' className='gap-1 text-amber-600'>
                    Unsaved changes
                  </Badge>
                ) : lastSavedAt ? (
                  <Badge variant='outline' className='gap-1 text-green-600'>
                    <Check className='h-3 w-3' />
                    Saved
                  </Badge>
                ) : null)}
              {isEditing && hasChanges && onSaveTemplate && (
                <Button
                  variant='default'
                  size='sm'
                  onClick={() => setShowSaveDialog(true)}
                >
                  <Save className='mr-1 h-4 w-4' />
                  Save Template
                </Button>
              )}
              {/* Done button to exit inline edit mode */}
              {isInlineEditing && (
                <Button variant='outline' size='sm' onClick={handleAttemptExit}>
                  Done
                </Button>
              )}
              {/* Edit button only when not in edit mode and has templateId */}
              {onEditTemplate && templateId && !isEditing && (
                <Button variant='outline' size='sm' onClick={onEditTemplate}>
                  <Edit className='mr-1 h-4 w-4' />
                  Edit
                </Button>
              )}
              <Button
                variant='outline'
                size='sm'
                onClick={copyToClipboard}
                title='Copy to clipboard'
              >
                <Copy className='h-4 w-4' />
              </Button>
              {onExport && (
                <Button variant='default' size='sm' onClick={onExport}>
                  <Download className='mr-1 h-4 w-4' />
                  Export
                </Button>
              )}
            </div>
          </div>
          <p className='text-muted-foreground text-sm'>
            {templateName || 'No template applied'}
            {isEditing && (
              <span className='ml-2 text-blue-600 dark:text-blue-400'>
                - Type {'{{variable_name}}'} to add and extract new fields
                {isInlineEditing && ' (Press Escape to exit)'}
              </span>
            )}
          </p>
        </CardHeader>
        <CardContent className='flex min-h-0 flex-1 flex-col overflow-hidden'>
          {isEditing ? (
            // WYSIWYG TipTap editor mode
            <div
              className='template-output-editor flex h-full min-h-0 flex-col'
              onKeyDown={handleEditKeyDown}
            >
              {/* Minimal Toolbar */}
              <div className='mb-2 flex flex-shrink-0 flex-wrap items-center gap-1 border-b pb-2'>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() =>
                          editor?.chain().focus().toggleBold().run()
                        }
                        className={cn(
                          'h-8 w-8 p-0',
                          editor?.isActive('bold') && 'bg-muted'
                        )}
                      >
                        <Bold className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='bottom' className='text-xs'>
                      Bold (Ctrl+B)
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() =>
                          editor?.chain().focus().toggleItalic().run()
                        }
                        className={cn(
                          'h-8 w-8 p-0',
                          editor?.isActive('italic') && 'bg-muted'
                        )}
                      >
                        <Italic className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='bottom' className='text-xs'>
                      Italic (Ctrl+I)
                    </TooltipContent>
                  </Tooltip>
                  <Separator orientation='vertical' className='mx-1 h-6' />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() =>
                          editor
                            ?.chain()
                            .focus()
                            .toggleHeading({ level: 1 })
                            .run()
                        }
                        className={cn(
                          'h-8 w-8 p-0',
                          editor?.isActive('heading', { level: 1 }) &&
                            'bg-muted'
                        )}
                      >
                        <Heading1 className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='bottom' className='text-xs'>
                      Heading 1
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() =>
                          editor
                            ?.chain()
                            .focus()
                            .toggleHeading({ level: 2 })
                            .run()
                        }
                        className={cn(
                          'h-8 w-8 p-0',
                          editor?.isActive('heading', { level: 2 }) &&
                            'bg-muted'
                        )}
                      >
                        <Heading2 className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='bottom' className='text-xs'>
                      Heading 2
                    </TooltipContent>
                  </Tooltip>
                  <Separator orientation='vertical' className='mx-1 h-6' />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() =>
                          editor?.chain().focus().toggleBulletList().run()
                        }
                        className={cn(
                          'h-8 w-8 p-0',
                          editor?.isActive('bulletList') && 'bg-muted'
                        )}
                      >
                        <List className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='bottom' className='text-xs'>
                      Bullet List
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() =>
                          editor?.chain().focus().toggleOrderedList().run()
                        }
                        className={cn(
                          'h-8 w-8 p-0',
                          editor?.isActive('orderedList') && 'bg-muted'
                        )}
                      >
                        <ListOrdered className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='bottom' className='text-xs'>
                      Numbered List
                    </TooltipContent>
                  </Tooltip>
                  <Separator orientation='vertical' className='mx-1 h-6' />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => editor?.chain().focus().undo().run()}
                        disabled={!editor?.can().undo()}
                        className='h-8 w-8 p-0'
                      >
                        <Undo className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='bottom' className='text-xs'>
                      Undo (Ctrl+Z)
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => editor?.chain().focus().redo().run()}
                        disabled={!editor?.can().redo()}
                        className='h-8 w-8 p-0'
                      >
                        <Redo className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='bottom' className='text-xs'>
                      Redo (Ctrl+Y)
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {/* Editor Content */}
              <style>{`
                .template-output-editor .ProseMirror {
                  min-height: 250px;
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
                .template-output-editor .ProseMirror ul {
                  margin: 0.5em 0;
                  padding-left: 1.5em;
                  list-style-type: disc;
                }
                .template-output-editor .ProseMirror ol {
                  margin: 0.5em 0;
                  padding-left: 1.5em;
                  list-style-type: decimal;
                }
                .template-output-editor .ProseMirror li {
                  margin: 0.25em 0;
                }
                .template-output-editor .ProseMirror blockquote {
                  border-left: 4px solid var(--border, #e5e7eb);
                  margin: 1em 0;
                  padding-left: 1em;
                  font-style: italic;
                  color: var(--muted-foreground, #6b7280);
                }
                .template-output-editor .ProseMirror code {
                  background-color: var(--muted, #f3f4f6);
                  border: 1px solid var(--border, #e5e7eb);
                  padding: 2px 4px;
                  border-radius: 3px;
                  font-family: monospace;
                  font-size: 0.9em;
                }
                .template-output-editor .ProseMirror pre {
                  background-color: var(--muted, #f3f4f6);
                  border: 1px solid var(--border, #e5e7eb);
                  padding: 10px;
                  border-radius: 5px;
                  overflow-x: auto;
                  font-family: monospace;
                }
                .template-output-editor .ProseMirror hr {
                  border: none;
                  border-top: 2px solid var(--border, #e5e7eb);
                  margin: 1em 0;
                }
                .template-output-editor .ProseMirror strong {
                  font-weight: bold;
                }
                .template-output-editor .ProseMirror em {
                  font-style: italic;
                }
              `}</style>
              {/* Scrollable editor wrapper */}
              <div className='min-h-0 flex-1 overflow-y-auto rounded-lg border'>
                <EditorContent
                  editor={editor}
                  className={cn(
                    'prose prose-sm dark:prose-invert max-w-none',
                    'p-4',
                    'focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2'
                  )}
                />
              </div>
            </div>
          ) : (
            // Read-only display mode with rich content and variable badges
            <ScrollArea className='h-full'>
              <div
                className={cn(
                  'prose prose-sm dark:prose-invert bg-muted/30 max-w-none rounded-lg p-4',
                  !readOnly &&
                    'hover:bg-muted/50 focus:ring-ring cursor-text transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none'
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
                  <RichContentRenderer
                    content={templateContent || '*No content available*'}
                    processChildrenWithBadges={processChildrenWithBadges}
                  />
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

      {/* Unsaved Changes Confirmation Dialog */}
      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this template output. What would you
              like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowExitConfirm(false)}>
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction
              className='border-input bg-background hover:bg-accent hover:text-accent-foreground border'
              onClick={handleConfirmDiscard}
            >
              Discard Changes
            </AlertDialogAction>
            <AlertDialogAction onClick={handleSaveAndExit}>
              Save & Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
