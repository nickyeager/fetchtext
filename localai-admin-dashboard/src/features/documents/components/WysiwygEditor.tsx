/**
 * WYSIWYG Editor Component using React-Quill
 * Provides rich text editing capabilities with customizable toolbar
 */

import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';

// Dynamic imports for React-Quill to handle SSR issues
import 'react-quill/dist/quill.snow.css';
const ReactQuill = React.lazy(() => import('react-quill'));

interface WysiwygEditorProps {
  value?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  height?: string;
  theme?: 'snow' | 'bubble';
  modules?: any;
  formats?: string[];
}

// Default toolbar configuration
const defaultModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['link'],
    ['blockquote'],
    ['clean']
  ],
  clipboard: {
    // toggle to add extra line breaks when pasting HTML:
    matchVisual: false,
  }
};

// Mobile-optimized toolbar configuration
const mobileModules = {
  toolbar: [
    [{ 'header': [1, 2, false] }],
    ['bold', 'italic'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link'],
    ['clean']
  ],
  clipboard: {
    matchVisual: false,
  }
};

const defaultFormats = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'list', 'bullet', 'indent',
  'align', 'link', 'image', 'blockquote', 'code-block',
  'script'
];

export function WysiwygEditor({
  value = '',
  onChange,
  placeholder = 'Enter your text here...',
  readOnly = false,
  height = '300px',
  theme = 'snow',
  modules,
  formats = defaultFormats
}: WysiwygEditorProps) {
  const [editorValue, setEditorValue] = useState(value);
  const [isMobile, setIsMobile] = useState(false);
  const quillRef = useRef<any>(null);

  // Detect mobile device
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Use mobile-optimized modules if not specified and on mobile
  const editorModules = modules || (isMobile ? mobileModules : defaultModules);

  // Sync external value changes
  useEffect(() => {
    setEditorValue(value);
  }, [value]);

  const handleChange = (content: string, delta: any, source: any, editor: any) => {
    setEditorValue(content);
    if (onChange && source !== 'silent') {
      onChange(content);
    }
  };

  return (
    <div className="wysiwyg-editor">
      <style jsx global>{`
        .ql-editor {
          min-height: ${height === '100%' ? '200px' : height};
          max-height: 600px;
          overflow-y: auto;
          font-size: 14px;
        }
        
        .ql-toolbar {
          border-top: 1px solid #ccc;
          border-left: 1px solid #ccc;
          border-right: 1px solid #ccc;
          border-bottom: none;
          background: #f8f9fa;
          padding: 8px;
        }
        
        .ql-container {
          border-bottom: 1px solid #ccc;
          border-left: 1px solid #ccc;
          border-right: 1px solid #ccc;
          border-top: none;
          font-size: 14px;
          line-height: 1.5;
        }
        
        @media (max-width: 640px) {
          .ql-toolbar {
            padding: 4px;
          }
          
          .ql-toolbar .ql-formats {
            margin-right: 8px;
          }
          
          .ql-toolbar button {
            width: 28px;
            height: 28px;
          }
          
          .ql-editor {
            padding: 12px;
            font-size: 16px;
          }
        }
        
        .ql-editor.ql-blank::before {
          color: #aaa;
          font-style: italic;
        }
        
        .ql-editor h1 {
          font-size: 2em;
          font-weight: bold;
          margin: 0.5em 0;
        }
        
        .ql-editor h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0.5em 0;
        }
        
        .ql-editor h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin: 0.5em 0;
        }
        
        .ql-editor p {
          margin: 0.5em 0;
        }
        
        .ql-editor ul, .ql-editor ol {
          margin: 0.5em 0;
          padding-left: 1.5em;
        }
        
        .ql-editor blockquote {
          border-left: 4px solid #ccc;
          margin: 1em 0;
          padding-left: 1em;
          font-style: italic;
        }
        
        .ql-editor code {
          background-color: #f4f4f4;
          border: 1px solid #ccc;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: 'Courier New', Courier, monospace;
        }
        
        .ql-editor pre {
          background-color: #f4f4f4;
          border: 1px solid #ccc;
          padding: 10px;
          border-radius: 5px;
          overflow-x: auto;
          font-family: 'Courier New', Courier, monospace;
        }

        .ql-snow .ql-tooltip {
          z-index: 1000;
        }
        
        .ql-snow.ql-toolbar button:hover .ql-stroke {
          stroke: #0066cc;
        }
        
        .ql-snow.ql-toolbar button.ql-active .ql-stroke {
          stroke: #0066cc;
        }
      `}</style>
      
      <React.Suspense fallback={
        <Card className="p-4" style={{ height }}>
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="animate-pulse">Loading editor...</div>
          </div>
        </Card>
      }>
        <ReactQuill
          ref={quillRef}
          theme={theme}
          value={editorValue}
          onChange={handleChange}
          modules={editorModules}
          formats={formats}
          placeholder={placeholder}
          readOnly={readOnly}
          style={{
            backgroundColor: 'white',
            borderRadius: '6px'
          }}
        />
      </React.Suspense>
    </div>
  );
}

// Pre-configured editor variants for specific use cases
export function DocumentEditor(props: Omit<WysiwygEditorProps, 'modules'>) {
  const documentModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link'],
      ['blockquote'],
      ['clean']
    ],
  };

  return <WysiwygEditor {...props} modules={documentModules} />;
}

export function SimpleEditor(props: Omit<WysiwygEditorProps, 'modules'>) {
  const simpleModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ],
  };

  return <WysiwygEditor {...props} modules={simpleModules} />;
}