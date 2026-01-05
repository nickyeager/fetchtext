import { useMemo } from 'react'
import { Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EditableSection, type EditMode } from './EditableSection'
import type { FieldOverride } from '@/services/document-override-service'

interface ExtractedField {
  value: string | null
  confidence?: number
  sourceText?: string
  type?: string
}

interface SectionOverride {
  value: string
  original_value: string
  modified_at: string
  modified_by?: string
}

interface SectionRendererProps {
  /** Template content with {{variable}} placeholders */
  content: string
  /** Extracted fields with values */
  extractedFields: Record<string, ExtractedField | string | null>
  /** ID of the section currently being edited */
  editingSectionId: string | null
  /** Section overrides for text sections */
  sectionOverrides?: Record<string, SectionOverride>
  /** Field overrides for variable values */
  fieldOverrides?: Record<string, FieldOverride>
  /** Current edit mode */
  editMode: EditMode
  /** Callback when section is clicked to edit */
  onSectionEdit: (sectionId: string) => void
  /** Callback when section save is requested */
  onSectionSave: (sectionId: string, newContent: string) => Promise<void>
  /** Callback when section edit is cancelled */
  onSectionCancel: () => void
  /** Callback when field is clicked to edit */
  onFieldEdit?: (fieldName: string, currentValue: string | number | null) => void
  /** Callback when field override is saved */
  onFieldOverride?: (fieldName: string, newValue: string, originalValue: string | null) => Promise<void>
  /** Callback to reset section override */
  onResetSection?: (sectionId: string) => void
  /** Callback to reset field override */
  onResetFieldOverride?: (fieldName: string) => Promise<void>
  /** Whether the component is read-only */
  readOnly?: boolean
  /** Enable section editing */
  enableSectionEditing?: boolean
  /** Enable field overrides */
  enableOverrides?: boolean
  /** Optional additional CSS classes */
  className?: string
}

interface ParsedPart {
  type: 'text' | 'variable'
  content: string
  sectionId: string
  field?: ExtractedField
  override?: SectionOverride
  fieldOverride?: FieldOverride
}

// Normalize a key for fuzzy matching
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '')
}

// Find a matching field using fuzzy key matching
function findMatchingField(
  fields: Record<string, ExtractedField | string | null>,
  varName: string
): ExtractedField | null {
  // Try exact match first
  const exact = fields[varName]
  if (exact) {
    if (typeof exact === 'string') return { value: exact }
    return exact
  }

  // Try normalized match
  const normalizedVar = normalizeKey(varName)
  for (const [key, value] of Object.entries(fields)) {
    if (normalizeKey(key) === normalizedVar) {
      if (value === null) return { value: null }
      if (typeof value === 'string') return { value }
      return value
    }
  }

  return null
}

/**
 * Renders template content as a mix of editable text sections and variable badges
 */
export function SectionRenderer({
  content,
  extractedFields,
  editingSectionId,
  sectionOverrides = {},
  fieldOverrides = {},
  editMode,
  onSectionEdit,
  onSectionSave,
  onSectionCancel,
  onFieldEdit,
  onFieldOverride,
  onResetSection,
  onResetFieldOverride,
  readOnly = false,
  enableSectionEditing = false,
  enableOverrides = false,
  className,
}: SectionRendererProps) {
  // Parse template content into parts
  const parts = useMemo<ParsedPart[]>(() => {
    const result: ParsedPart[] = []
    const regex = /\{\{(\w+)\}\}/g
    let lastIndex = 0
    let match
    let textIndex = 0
    let varIndex = 0

    while ((match = regex.exec(content)) !== null) {
      // Add text section before variable
      if (match.index > lastIndex) {
        const textContent = content.slice(lastIndex, match.index)
        const sectionId = `text-${textIndex}`
        const override = sectionOverrides[sectionId]

        result.push({
          type: 'text',
          content: override?.value ?? textContent,
          sectionId,
          override,
        })
        textIndex++
      }

      // Add variable section
      const varName = match[1]
      const field = findMatchingField(extractedFields, varName)
      const fieldOverride = fieldOverrides[varName]

      result.push({
        type: 'variable',
        content: varName,
        sectionId: `var-${varIndex}`,
        field: field ?? { value: null },
        fieldOverride,
      })
      varIndex++

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < content.length) {
      const textContent = content.slice(lastIndex)
      const sectionId = `text-${textIndex}`
      const override = sectionOverrides[sectionId]

      result.push({
        type: 'text',
        content: override?.value ?? textContent,
        sectionId,
        override,
      })
    }

    return result
  }, [content, extractedFields, sectionOverrides, fieldOverrides])

  const getConfidenceColor = (conf?: number) => {
    if (!conf) return 'text-muted-foreground'
    if (conf >= 0.9) return 'text-green-600 dark:text-green-400'
    if (conf >= 0.7) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('whitespace-pre-wrap font-mono text-sm', className)}>
        {parts.map((part) => {
          if (part.type === 'text') {
            if (enableSectionEditing && !readOnly) {
              return (
                <EditableSection
                  key={part.sectionId}
                  sectionId={part.sectionId}
                  content={part.content}
                  isEditing={editingSectionId === part.sectionId}
                  isOverride={!!part.override}
                  originalContent={part.override?.original_value}
                  onEdit={onSectionEdit}
                  onSave={onSectionSave}
                  onCancel={onSectionCancel}
                  onReset={onResetSection}
                  readOnly={readOnly}
                  editMode={editMode}
                />
              )
            }

            // Read-only text section
            return (
              <span key={part.sectionId} className={cn(
                part.override && 'bg-amber-50 border-b border-dotted border-amber-300'
              )}>
                {part.content}
              </span>
            )
          }

          // Variable badge
          const field = part.field!
          const hasValue = field.value !== null && field.value !== ''
          const displayValue = part.fieldOverride?.value ?? field.value
          const isOverride = !!part.fieldOverride
          const confidencePercent = field.confidence
            ? Math.round(field.confidence * 100)
            : null

          return (
            <Tooltip key={part.sectionId}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'mx-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5',
                    'cursor-help transition-colors',
                    isOverride
                      ? 'border border-dotted border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
                      : hasValue
                        ? 'border border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200'
                        : 'border border-dashed border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                  )}
                >
                  {hasValue ? (
                    <>
                      <Check className="h-3 w-3" />
                      <span>{displayValue}</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3" />
                      <span className="italic">{`{{${part.content}}}`}</span>
                    </>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm space-y-2 p-3">
                <div className="text-muted-foreground font-mono text-xs">
                  {part.content}
                </div>
                {hasValue ? (
                  <>
                    <div className="border-primary border-l-2 pl-2 text-sm font-medium">
                      {displayValue}
                    </div>
                    {isOverride && (
                      <div className="text-amber-600 text-xs">
                        Override (original: {field.value})
                      </div>
                    )}
                    {confidencePercent !== null && !isOverride && (
                      <div className={cn('text-xs', getConfidenceColor(field.confidence))}>
                        {confidencePercent}% confidence
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
      </div>
    </TooltipProvider>
  )
}
