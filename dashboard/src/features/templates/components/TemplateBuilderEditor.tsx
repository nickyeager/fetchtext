/**
 * Template Builder Editor
 *
 * Main TipTap editor wrapper for building templates with variable support.
 * Features:
 * - Rich text formatting toolbar
 * - Variable badge insertion via autocomplete
 * - Variable format configuration dialog
 * - Live preview of extracted values on hover
 */
import React, { useCallback, useState, useMemo, useEffect } from 'react'
import type { SmartVariable } from '@/types/unified-template'
import Placeholder from '@tiptap/extension-placeholder'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Quote,
  Code,
  Minus,
  Variable,
} from 'lucide-react'
import { VariableAutocomplete } from '@/lib/tiptap/extensions/VariableAutocomplete'
import { VariableBadge } from '@/lib/tiptap/extensions/VariableBadge'
import { getVariableSuggestionOptions } from '@/lib/tiptap/suggestion-renderer'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { VariableFormatDialog } from './VariableFormatDialog'

interface TemplateBuilderEditorProps {
  content: string
  onChange: (content: string) => void
  variables: SmartVariable[]
  onVariableFormatChange: (variableId: string, format: string) => void
  extractedData?: Record<string, unknown>
  readOnly?: boolean
  className?: string
  placeholder?: string
  showToolbar?: boolean
}

export function TemplateBuilderEditor({
  content,
  onChange,
  variables,
  onVariableFormatChange,
  extractedData = {},
  readOnly = false,
  className,
  placeholder = 'Type your template content here. Use {{ to insert variables...',
  showToolbar = true,
}: TemplateBuilderEditorProps) {
  const [selectedVariableId, setSelectedVariableId] = useState<string | null>(
    null
  )
  const [formatDialogOpen, setFormatDialogOpen] = useState(false)

  const handleVariableClick = useCallback((variableId: string) => {
    setSelectedVariableId(variableId)
    setFormatDialogOpen(true)
  }, [])

  // Get suggestion options with proper render function
  const suggestionOptions = useMemo(() => getVariableSuggestionOptions(), [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({ placeholder }),
      VariableBadge.configure({
        extractedData,
        onVariableClick: handleVariableClick,
      }),
      VariableAutocomplete.configure({
        variables,
        suggestion: {
          ...suggestionOptions,
          char: '{{',
        },
      }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  // Update variable badge extracted data when it changes
  useEffect(() => {
    if (editor) {
      editor.extensionManager.extensions.forEach((ext) => {
        if (ext.name === 'variableBadge') {
          ext.options.extractedData = extractedData
        }
      })
    }
  }, [extractedData, editor])

  const selectedVariable = useMemo(
    () => variables.find((v) => v.id === selectedVariableId),
    [variables, selectedVariableId]
  )

  // Insert a variable badge at current cursor position
  const insertVariable = useCallback(
    (variable: SmartVariable) => {
      if (!editor) return
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'variableBadge',
          attrs: {
            variableId: variable.id,
            variableName: variable.name,
            format: variable.post_processing?.transform || 'raw',
          },
        })
        .run()
    },
    [editor]
  )

  if (!editor) {
    return (
      <div
        className={cn('bg-muted animate-pulse rounded-lg', className)}
        style={{ height: 300 }}
      />
    )
  }

  return (
    <Card className={className}>
      <CardContent className='space-y-3'>
        {/* Toolbar */}
        {showToolbar && !readOnly && (
          <>
            <EditorToolbar editor={editor} />
            <Separator />
          </>
        )}

        {/* Editor Area */}
        <div className='template-builder-editor'>
          <style>{`
            .template-builder-editor .ProseMirror {
              min-height: 300px;
              max-height: 500px;
              overflow-y: auto;
              outline: none;
            }
            .template-builder-editor .ProseMirror p.is-editor-empty:first-child::before {
              color: #adb5bd;
              content: attr(data-placeholder);
              float: left;
              height: 0;
              pointer-events: none;
            }
            .template-builder-editor .ProseMirror h1 {
              font-size: 2em;
              font-weight: bold;
              margin: 0.5em 0;
            }
            .template-builder-editor .ProseMirror h2 {
              font-size: 1.5em;
              font-weight: bold;
              margin: 0.5em 0;
            }
            .template-builder-editor .ProseMirror h3 {
              font-size: 1.25em;
              font-weight: bold;
              margin: 0.5em 0;
            }
            .template-builder-editor .ProseMirror p {
              margin: 0.5em 0;
            }
            .template-builder-editor .ProseMirror ul,
            .template-builder-editor .ProseMirror ol {
              margin: 0.5em 0;
              padding-left: 1.5em;
            }
            .template-builder-editor .ProseMirror blockquote {
              border-left: 4px solid var(--border);
              margin: 1em 0;
              padding-left: 1em;
              font-style: italic;
              color: var(--muted-foreground);
            }
            .template-builder-editor .ProseMirror code {
              background-color: var(--muted);
              border: 1px solid var(--border);
              padding: 2px 4px;
              border-radius: 3px;
              font-family: monospace;
            }
            .template-builder-editor .ProseMirror pre {
              background-color: var(--muted);
              border: 1px solid var(--border);
              padding: 10px;
              border-radius: 5px;
              overflow-x: auto;
              font-family: monospace;
            }
            .template-builder-editor .ProseMirror hr {
              border: none;
              border-top: 2px solid var(--border);
              margin: 1em 0;
            }
          `}</style>
          <EditorContent
            editor={editor}
            className={cn(
              'prose prose-sm dark:prose-invert max-w-none',
              'rounded-lg border p-4',
              'focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2',
              readOnly && 'bg-muted/30 cursor-not-allowed'
            )}
          />
        </div>

        {/* Hint */}
        {!readOnly && (
          <p className='text-muted-foreground text-xs'>
            Tip: Type{' '}
            <code className='bg-muted rounded px-1 py-0.5 text-[10px]'>
              {'{{'}
            </code>{' '}
            to insert a variable. Click on variables to configure their display
            format.
          </p>
        )}

        {/* Format Dialog */}
        {selectedVariable && (
          <VariableFormatDialog
            open={formatDialogOpen}
            onOpenChange={setFormatDialogOpen}
            variable={selectedVariable}
            extractedValue={extractedData[selectedVariableId!]}
            onSave={onVariableFormatChange}
          />
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Editor Toolbar Component
 */
function EditorToolbar({ editor }: { editor: Editor }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className='flex flex-wrap items-center gap-1'>
        {/* Text Formatting */}
        <ToolbarButton
          icon={Bold}
          tooltip='Bold (Ctrl+B)'
          isActive={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={Italic}
          tooltip='Italic (Ctrl+I)'
          isActive={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={Code}
          tooltip='Inline Code (Ctrl+E)'
          isActive={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />

        <Separator orientation='vertical' className='mx-1 h-6' />

        {/* Headings */}
        <ToolbarButton
          icon={Heading1}
          tooltip='Heading 1'
          isActive={editor.isActive('heading', { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        />
        <ToolbarButton
          icon={Heading2}
          tooltip='Heading 2'
          isActive={editor.isActive('heading', { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolbarButton
          icon={Heading3}
          tooltip='Heading 3'
          isActive={editor.isActive('heading', { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />

        <Separator orientation='vertical' className='mx-1 h-6' />

        {/* Lists */}
        <ToolbarButton
          icon={List}
          tooltip='Bullet List'
          isActive={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={ListOrdered}
          tooltip='Numbered List'
          isActive={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />

        <Separator orientation='vertical' className='mx-1 h-6' />

        {/* Block Elements */}
        <ToolbarButton
          icon={Quote}
          tooltip='Blockquote'
          isActive={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          icon={Minus}
          tooltip='Horizontal Rule'
          isActive={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />

        <Separator orientation='vertical' className='mx-1 h-6' />

        {/* History */}
        <ToolbarButton
          icon={Undo}
          tooltip='Undo (Ctrl+Z)'
          isActive={false}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        />
        <ToolbarButton
          icon={Redo}
          tooltip='Redo (Ctrl+Y)'
          isActive={false}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        />
      </div>
    </TooltipProvider>
  )
}

/**
 * Toolbar Button Component
 */
function ToolbarButton({
  icon: Icon,
  tooltip,
  isActive,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>
  tooltip: string
  isActive: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'h-8 w-8 p-0',
            isActive && 'bg-muted',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <Icon className='h-4 w-4' />
        </Button>
      </TooltipTrigger>
      <TooltipContent side='bottom' className='text-xs'>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

// Also export a hook for programmatic access
export function useTemplateEditor() {
  return {
    insertVariable: (editor: Editor | null, variable: SmartVariable) => {
      if (!editor) return
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'variableBadge',
          attrs: {
            variableId: variable.id,
            variableName: variable.name,
            format: variable.post_processing?.transform || 'raw',
          },
        })
        .run()
    },
  }
}
