/**
 * Simple TipTap Editor Component
 * A basic rich text editor without variable support
 * Used for simple document content editing
 */

import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';

interface SimpleEditorProps {
  value?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  height?: string;
}

export function SimpleEditor({
  value = '',
  onChange,
  placeholder = 'Enter text...',
  readOnly = false,
  className,
  height = '300px',
}: SimpleEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  // Sync external value changes
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className={cn('bg-muted animate-pulse rounded-lg', className)}
        style={{ height }}
      />
    );
  }

  return (
    <div className="simple-editor">
      <style>{`
        .simple-editor .ProseMirror {
          min-height: ${height};
          max-height: 600px;
          overflow-y: auto;
          outline: none;
        }
        .simple-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: #adb5bd;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .simple-editor .ProseMirror h1 {
          font-size: 2em;
          font-weight: bold;
          margin: 0.5em 0;
        }
        .simple-editor .ProseMirror h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0.5em 0;
        }
        .simple-editor .ProseMirror h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin: 0.5em 0;
        }
        .simple-editor .ProseMirror p {
          margin: 0.5em 0;
        }
        .simple-editor .ProseMirror ul,
        .simple-editor .ProseMirror ol {
          margin: 0.5em 0;
          padding-left: 1.5em;
        }
        .simple-editor .ProseMirror blockquote {
          border-left: 4px solid #ccc;
          margin: 1em 0;
          padding-left: 1em;
          font-style: italic;
        }
        .simple-editor .ProseMirror code {
          background-color: #f4f4f4;
          border: 1px solid #ccc;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: 'Courier New', Courier, monospace;
        }
        .simple-editor .ProseMirror pre {
          background-color: #f4f4f4;
          border: 1px solid #ccc;
          padding: 10px;
          border-radius: 5px;
          overflow-x: auto;
          font-family: 'Courier New', Courier, monospace;
        }
      `}</style>
      <EditorContent
        editor={editor}
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none',
          'p-4 border rounded-lg',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          readOnly && 'bg-muted/30 cursor-not-allowed',
          className
        )}
      />
    </div>
  );
}
