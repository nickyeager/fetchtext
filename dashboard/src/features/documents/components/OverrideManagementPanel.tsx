import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  FileText,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
import type { DocumentOverrides, FieldOverride } from '@/services/document-override-service'

interface OverrideManagementPanelProps {
  /** The document overrides */
  overrides: DocumentOverrides
  /** Callback when a field reset is requested */
  onResetField: (fieldName: string) => void
  /** Callback when all overrides should be reset */
  onResetAll: () => void
  /** Callback when template content should be reset */
  onResetTemplateContent?: () => void
  /** Callback to compare template changes */
  onCompareTemplate?: () => void
  /** Whether the panel is collapsed by default */
  defaultCollapsed?: boolean
  /** Additional class name */
  className?: string
}

interface ConfirmDialogState {
  open: boolean
  type: 'field' | 'template' | 'all'
  fieldName?: string
  originalValue?: string | number | null
}

export function OverrideManagementPanel({
  overrides,
  onResetField,
  onResetAll,
  onResetTemplateContent,
  onCompareTemplate,
  defaultCollapsed = false,
  className,
}: OverrideManagementPanelProps) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    type: 'field',
  })

  // Don't render if no overrides
  if (!overrides.has_overrides) {
    return null
  }

  const fieldOverrides = Object.entries(overrides.field_overrides || {})
  const fieldCount = fieldOverrides.length
  const hasTemplateOverride = overrides.template_content_override !== undefined
  const totalCount = fieldCount + (hasTemplateOverride ? 1 : 0)

  const handleResetField = (fieldName: string, override: FieldOverride) => {
    setConfirmDialog({
      open: true,
      type: 'field',
      fieldName,
      originalValue: override.original_value,
    })
  }

  const handleResetTemplate = () => {
    setConfirmDialog({
      open: true,
      type: 'template',
    })
  }

  const handleResetAll = () => {
    setConfirmDialog({
      open: true,
      type: 'all',
    })
  }

  const handleConfirm = () => {
    if (confirmDialog.type === 'field' && confirmDialog.fieldName) {
      onResetField(confirmDialog.fieldName)
    } else if (confirmDialog.type === 'template') {
      onResetTemplateContent?.()
    } else if (confirmDialog.type === 'all') {
      onResetAll()
    }
    setConfirmDialog({ open: false, type: 'field' })
  }

  const handleCancel = () => {
    setConfirmDialog({ open: false, type: 'field' })
  }

  return (
    <>
      <Card
        className={cn('border-amber-200 dark:border-amber-800', className)}
        role="region"
        aria-label="Document Overrides"
      >
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="pb-2">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-0 hover:bg-transparent"
                aria-expanded={isOpen}
                aria-label={isOpen ? 'Collapse overrides' : 'Expand overrides'}
              >
                <CardTitle className="flex items-center gap-2 text-base">
                  Document Overrides
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {fieldCount > 0 && `${fieldCount} field override${fieldCount !== 1 ? 's' : ''}`}
                    {fieldCount > 0 && hasTemplateOverride && ' | '}
                    {hasTemplateOverride && '1 template change'}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="pt-2">
              <div className="space-y-3">
                {/* Field Overrides */}
                {fieldOverrides.map(([fieldName, override]) => {
                  const hasConflict = (override as FieldOverride & { has_conflict?: boolean }).has_conflict
                  const conflictValue = (override as FieldOverride & { conflict_new_value?: string }).conflict_new_value

                  return (
                    <div
                      key={fieldName}
                      data-testid="override-row"
                      className={cn(
                        'flex items-center justify-between rounded-lg border p-2',
                        hasConflict
                          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                          : 'border-amber-100 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20'
                      )}
                    >
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            {fieldName}
                          </span>
                          {override.modified_by_name && (
                            <span className="text-xs text-muted-foreground">
                              by {override.modified_by_name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground line-through">
                            {String(override.original_value)}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium text-amber-700 dark:text-amber-300">
                            {String(override.value)}
                          </span>
                        </div>
                        {hasConflict && conflictValue && (
                          <div className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            New extracted: {conflictValue}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetField(fieldName, override)}
                        className="text-amber-700 hover:text-amber-900 dark:text-amber-300"
                        aria-label={`Reset ${fieldName} to original`}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Reset
                      </Button>
                    </div>
                  )
                })}

                {/* Template Content Override */}
                {hasTemplateOverride && (
                  <div className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/50 p-2 dark:border-amber-900 dark:bg-amber-950/20">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium">
                        Template content modified
                      </span>
                      {overrides.template_content_override?.modified_by_name && (
                        <span className="text-xs text-muted-foreground">
                          by {overrides.template_content_override.modified_by_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {onCompareTemplate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onCompareTemplate}
                          aria-label="Compare template changes"
                        >
                          Compare
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetTemplate}
                        className="text-amber-700 hover:text-amber-900 dark:text-amber-300"
                        aria-label="Reset template to original"
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Reset
                      </Button>
                    </div>
                  </div>
                )}

                {/* Reset All Button */}
                {totalCount > 1 && (
                  <div className="flex justify-end border-t pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetAll}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                      aria-label={`Reset all ${totalCount} overrides`}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Reset All Overrides
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === 'all'
                ? `Reset ${totalCount} overrides?`
                : confirmDialog.type === 'template'
                  ? 'Reset template content?'
                  : 'Reset to original value?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === 'all' ? (
                <>
                  This will reset all {totalCount} overrides to their original values.
                  This action cannot be undone.
                </>
              ) : confirmDialog.type === 'template' ? (
                <>
                  This will reset the template content to the original template.
                  Your custom modifications will be lost.
                </>
              ) : (
                <>
                  This will reset <strong>{confirmDialog.fieldName}</strong> to its original
                  value: <strong>{String(confirmDialog.originalValue)}</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
