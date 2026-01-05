/**
 * Variable Badge TipTap Extension
 *
 * Custom TipTap node that renders template variables ({{variable_name}})
 * as interactive styled badges with hover tooltips and click handlers.
 *
 * When enableValueEditing is true, badges transform to inline inputs
 * allowing users to edit extracted field values directly.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { VariableBadgeNodeView } from '@/features/templates/components/VariableBadgeNodeView';
import type { FieldOverride } from '@/services/document-override-service';

export interface VariableBadgeOptions {
  HTMLAttributes: Record<string, any>;
  /** Extracted data values for each variable */
  extractedData?: Record<string, any>;
  /** Click handler for variable badges (format configuration) */
  onVariableClick?: (variableId: string) => void;
  /** Enable inline value editing mode */
  enableValueEditing?: boolean;
  /** Field override data */
  fieldOverrides?: Record<string, FieldOverride>;
  /** Callback when a field value is changed */
  onValueChange?: (
    variableId: string,
    newValue: string,
    originalValue: string | null
  ) => Promise<void>;
  /** Callback to reset a field override */
  onResetOverride?: (variableId: string) => Promise<void>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variableBadge: {
      /**
       * Insert a variable badge
       */
      insertVariableBadge: (attrs: {
        variableId: string;
        variableName: string;
        format?: string;
      }) => ReturnType;
    };
  }
}

export const VariableBadge = Node.create<VariableBadgeOptions>({
  name: 'variableBadge',
  group: 'inline',
  inline: true,
  atom: true, // Cannot be edited directly, treated as single unit

  addOptions() {
    return {
      HTMLAttributes: {},
      extractedData: {},
      onVariableClick: undefined,
      enableValueEditing: false,
      fieldOverrides: {},
      onValueChange: undefined,
      onResetOverride: undefined,
    };
  },

  addAttributes() {
    return {
      variableId: {
        default: null,
        parseHTML: element => element.getAttribute('data-variable-id'),
        renderHTML: attributes => ({
          'data-variable-id': attributes.variableId,
        }),
      },
      variableName: {
        default: null,
        parseHTML: element => element.getAttribute('data-variable-name'),
        renderHTML: attributes => ({
          'data-variable-name': attributes.variableName,
        }),
      },
      format: {
        default: 'raw',
        parseHTML: element => element.getAttribute('data-format') || 'raw',
        renderHTML: attributes => ({
          'data-format': attributes.format,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-variable-badge]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-variable-badge': '' },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      `{{${HTMLAttributes['data-variable-name'] || ''}}}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableBadgeNodeView);
  },

  addCommands() {
    return {
      insertVariableBadge:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
