import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FileEdit, FilePlus, FileText, Loader2 } from 'lucide-react'

export type SaveAction = 'create' | 'modify' | 'override'

interface SaveTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateName?: string
  templateId?: number
  /** Whether to show the override option */
  enableOverride?: boolean
  /** Document ID (required when enableOverride is true) */
  documentId?: string
  onSave: (action: SaveAction, newName?: string) => Promise<void>
}

export function SaveTemplateDialog({
  open,
  onOpenChange,
  templateName,
  templateId,
  enableOverride = false,
  documentId,
  onSave,
}: SaveTemplateDialogProps) {
  // Default to override if enabled, otherwise modify (if templateId) or create
  const getDefaultAction = (): SaveAction => {
    if (enableOverride && documentId) return 'override'
    if (templateId) return 'modify'
    return 'create'
  }

  const [action, setAction] = useState<SaveAction>(getDefaultAction())
  const [newTemplateName, setNewTemplateName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(action, action === 'create' ? newTemplateName : undefined)
      onOpenChange(false)
      // Reset state after successful save
      setNewTemplateName('')
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[SaveTemplateDialog] Save failed:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Template Changes</DialogTitle>
          <DialogDescription>
            You've added new variables to the template. Choose how to save your
            changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={action}
            onValueChange={(v) => setAction(v as SaveAction)}
          >
            {/* Override option - only shown when enabled */}
            {enableOverride && documentId && (
              <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="override" id="override" className="mt-1" />
                <div className="flex-1">
                  <Label
                    htmlFor="override"
                    className="flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <FileText className="h-4 w-4 text-amber-600" />
                    Override This Document
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Only affects this document, not the global template
                  </p>
                </div>
              </div>
            )}

            {/* Modify option - only shown when templateId exists */}
            {templateId && (
              <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="modify" id="modify" className="mt-1" />
                <div className="flex-1">
                  <Label
                    htmlFor="modify"
                    className="flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <FileEdit className="h-4 w-4 text-blue-600" />
                    Modify Existing Template
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Update "{templateName}" with the new variables
                  </p>
                </div>
              </div>
            )}

            {/* Create new template option - always shown */}
            <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="create" id="create" className="mt-1" />
              <div className="flex-1">
                <Label
                  htmlFor="create"
                  className="flex items-center gap-2 cursor-pointer font-medium"
                >
                  <FilePlus className="h-4 w-4 text-green-600" />
                  Create New Template
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Save as a new template with the added variables
                </p>
              </div>
            </div>
          </RadioGroup>

          {action === 'create' && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="template-name">New Template Name</Label>
              <Input
                id="template-name"
                placeholder="Enter template name..."
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                autoFocus
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              isSaving || (action === 'create' && !newTemplateName.trim())
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Template'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
