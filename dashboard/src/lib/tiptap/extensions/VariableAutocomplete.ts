/**
 * Variable Autocomplete TipTap Extension
 *
 * Detects `{{` trigger characters and shows a suggestion dropdown
 * with available template variables. Selecting a variable inserts
 * a VariableBadge node at the cursor position.
 */

import { Extension } from '@tiptap/core';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import type { SmartVariable } from '@/types/unified-template';

// Create a proper PluginKey for the suggestion plugin
// This fixes "getState is not a function" error when editor loses focus
const variableAutocompletePluginKey = new PluginKey('variableAutocomplete');

export interface VariableAutocompleteOptions {
  variables: SmartVariable[];
  suggestion: Partial<SuggestionOptions<SmartVariable>>;
}

export const VariableAutocomplete = Extension.create<VariableAutocompleteOptions>({
  name: 'variableAutocomplete',

  addOptions() {
    return {
      variables: [],
      suggestion: {
        char: '{{',
        allowSpaces: false,
        startOfLine: false,
        pluginKey: variableAutocompletePluginKey,
        command: ({ editor, range, props }) => {
          // Delete the trigger characters and insert the badge
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'variableBadge',
              attrs: {
                variableId: props.id,
                variableName: props.name,
                format: props.post_processing?.transform || 'raw',
              },
            })
            .run();
        },
        allow: ({ state, range }) => {
          // Check if we're in a valid position for autocomplete
          const $from = state.doc.resolve(range.from);
          const isInCodeBlock = $from.parent.type.name === 'codeBlock';
          return !isInCodeBlock;
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }) => {
          const normalizedQuery = query.toLowerCase().trim();

          // Filter variables based on the query
          return this.options.variables
            .filter((variable) => {
              if (!normalizedQuery) return true;
              return (
                variable.name.toLowerCase().includes(normalizedQuery) ||
                variable.id.toLowerCase().includes(normalizedQuery) ||
                (variable.description?.toLowerCase().includes(normalizedQuery) ?? false)
              );
            })
            .slice(0, 10); // Limit to 10 results
        },
      }),
    ];
  },
});
