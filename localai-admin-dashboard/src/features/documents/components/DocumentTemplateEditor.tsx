/**
 * Document Template Editor
 *
 * WYSIWYG editor for editing documents with inline variable value editing.
 * Built on TipTap with rich text formatting and variable badge support.
 *
 * Key differences from TemplateBuilderEditor:
 * - Enables value editing mode (click variable to edit its value)
 * - Displays extracted values instead of {{variable}} syntax
 * - Supports field overrides with visual indicators
 */
import React, { useCallback, useMemo, useEffect } from 'react'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
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
} from 'lucide-react'
import { VariableBadge } from '@/lib/tiptap/extensions/VariableBadge'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { FieldOverride } from '@/services/document-override-service'

interface DocumentTemplateEditorProps {
  /** HTML content with variable badges */
  content: string
  /** Callback when content changes */
  onChange?: (content: string) => void
  /** Extracted field values */
  extractedData?: Record<string, any>
  /** Field overrides */
  fieldOverrides?: Record<string, FieldOverride>
  /** Callback when a field value is changed */
  onValueChange?: (
    variableId: string,
    newValue: string,
    originalValue: string | null
  ) => Promise<void>
  /** Callback to reset a field override */
  onResetOverride?: (variableId: string) => Promise<void>
  /** Whether the editor is read-only */
  readOnly?: boolean
  /** Whether to show the toolbar */
  showToolbar?: boolean
  /** Editor height */
  height?: string
  /** Placeholder text */
  placeholder?: string
  /** Additional CSS classes */
  className?: string
}

export function DocumentTemplateEditor({
  content,
  onChange,
  extractedData = {},
  fieldOverrides = {},
  onValueChange,
  onResetOverride,
  readOnly = false,
  showToolbar = true,
  height = '300px',
  placeholder = 'Document content will appear here...',
  className,
}: DocumentTemplateEditorProps) {
  // Memoize callbacks to prevent unnecessary re-renders
  const handleValueChange = useCallback(
    async (variableId: string, newValue: string, originalValue: string | null) => {
      if (onValueChange) {
        await onValueChange(variableId, newValue, originalValue)
      }
    },
    [onValueChange]
  )

  const handleResetOverride = useCallback(
    async (variableId: string) => {
      if (onResetOverride) {
        await onResetOverride(variableId)
      }
    },
    [onResetOverride]
  )

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
        enableValueEditing: true,
        fieldOverrides,
        onValueChange: handleValueChange,
        onResetOverride: handleResetOverride,
      }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
  })

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  // Update variable badge options when they change
  useEffect(() => {
    if (editor) {
      editor.extensionManager.extensions.forEach((ext) => {
        if (ext.name === 'variableBadge') {
          ext.options.extractedData = extractedData
          ext.options.fieldOverrides = fieldOverrides
          ext.options.onValueChange = handleValueChange
          ext.options.onResetOverride = handleResetOverride
        }
      })
      // Force re-render of node views
      editor.view.dispatch(editor.state.tr)
    }
  }, [extractedData, fieldOverrides, handleValueChange, handleResetOverride, editor])

  if (!editor) {
    return (
      <div
        className={cn('bg-muted animate-pulse rounded-lg', className)}
        style={{ height }}
      />
    )
  }

  return (
    <div className={cn('document-template-editor space-y-2', className)}>
      {/* Toolbar */}
      {showToolbar && !readOnly && (
        <>
          <EditorToolbar editor={editor} />
          <Separator />
        </>
      )}

      {/* Editor Area */}
      <div className="document-editor-content">
        <style>{`
          .document-editor-content .ProseMirror {
            min-height: ${height};
            max-height: 600px;
            overflow-y: auto;
            outline: none;
          }
          .document-editor-content .ProseMirror p.is-editor-empty:first-child::before {
            color: #adb5bd;
            content: attr(data-placeholder);
            float: left;
            height: 0;
            pointer-events: none;
          }
          .document-editor-content .ProseMirror h1 {
            font-size: 2em;
            font-weight: bold;
            margin: 0.5em 0;
          }
          .document-editor-content .ProseMirror h2 {
            font-size: 1.5em;
            font-weight: bold;
            margin: 0.5em 0;
          }
          .document-editor-content .ProseMirror h3 {
            font-size: 1.25em;
            font-weight: bold;
            margin: 0.5em 0;
          }
          .document-editor-content .ProseMirror p {
            margin: 0.5em 0;
          }
          .document-editor-content .ProseMirror ul,
          .document-editor-content .ProseMirror ol {
            margin: 0.5em 0;
            padding-left: 1.5em;
          }
          .document-editor-content .ProseMirror blockquote {
            border-left: 4px solid var(--border);
            margin: 1em 0;
            padding-left: 1em;
            font-style: italic;
            color: var(--muted-foreground);
          }
          .document-editor-content .ProseMirror code {
            background-color: var(--muted);
            border: 1px solid var(--border);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: monospace;
          }
          .document-editor-content .ProseMirror pre {
            background-color: var(--muted);
            border: 1px solid var(--border);
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
            font-family: monospace;
          }
          .document-editor-content .ProseMirror hr {
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
    </div>
  )
}

/**
 * Editor Toolbar Component
 */
function EditorToolbar({ editor }: { editor: Editor }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-1">
        {/* Text Formatting */}
        <ToolbarButton
          icon={Bold}
          tooltip="Bold (Ctrl+B)"
          isActive={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={Italic}
          tooltip="Italic (Ctrl+I)"
          isActive={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={Code}
          tooltip="Inline Code (Ctrl+E)"
          isActive={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Headings */}
        <ToolbarButton
          icon={Heading1}
          tooltip="Heading 1"
          isActive={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          icon={Heading2}
          tooltip="Heading 2"
          isActive={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          icon={Heading3}
          tooltip="Heading 3"
          isActive={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Lists */}
        <ToolbarButton
          icon={List}
          tooltip="Bullet List"
          isActive={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={ListOrdered}
          tooltip="Numbered List"
          isActive={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Block Elements */}
        <ToolbarButton
          icon={Quote}
          tooltip="Blockquote"
          isActive={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          icon={Minus}
          tooltip="Horizontal Rule"
          isActive={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* History */}
        <ToolbarButton
          icon={Undo}
          tooltip="Undo (Ctrl+Z)"
          isActive={false}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        />
        <ToolbarButton
          icon={Redo}
          tooltip="Redo (Ctrl+Y)"
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
          variant="ghost"
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'h-8 w-8 p-0',
            isActive && 'bg-muted',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
