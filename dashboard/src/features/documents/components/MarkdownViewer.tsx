/**
 * Markdown Viewer/Editor Component
 * Displays markdown content with syntax highlighting and optional editing
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

interface MarkdownViewerProps {
  content: string;
  isEditing?: boolean;
  onChange?: (value: string) => void;
  height?: string;
  className?: string;
}

export function MarkdownViewer({
  content,
  isEditing = false,
  onChange,
  height = 'h-64 sm:h-96',
  className = ''
}: MarkdownViewerProps) {
  if (isEditing) {
    return (
      <Textarea
        value={content}
        onChange={(e) => onChange?.(e.target.value)}
        className={`font-mono text-sm ${height} ${className}`}
        placeholder="Enter markdown content..."
      />
    );
  }

  return (
    <ScrollArea className={`${height} w-full border rounded-md p-4 ${className}`}>
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
          // Custom renderers for better styling
          h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-bold mb-2 mt-4">{children}</h3>,
          p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4 text-gray-700 dark:text-gray-300">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            
            if (isInline) {
              return (
                <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-sm font-mono" {...props}>
                  {children}
                </code>
              );
            }
            
            return (
              <pre className="bg-gray-100 dark:bg-gray-800 rounded-md p-4 overflow-x-auto my-4">
                <code className={`text-sm font-mono ${className}`} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
              {children}
            </td>
          ),
          hr: () => <hr className="my-6 border-gray-200 dark:border-gray-700" />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {children}
            </a>
          ),
        }}
        >
          {content || '*No content available*'}
        </ReactMarkdown>
      </div>
    </ScrollArea>
  );
}