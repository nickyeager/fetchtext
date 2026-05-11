/**
 * TipTap Suggestion Renderer
 *
 * Creates a renderer that connects TipTap's suggestion plugin
 * with our React autocomplete popover component using tippy.js
 * for positioning.
 */

import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance, Props as TippyProps } from 'tippy.js';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import {
  VariableAutocompletePopover,
  VariableAutocompletePopoverRef,
} from '@/features/templates/components/VariableAutocompletePopover';
import type { SmartVariable } from '@/types/unified-template';

export function createSuggestionRenderer() {
  return {
    onStart: (props: SuggestionProps<SmartVariable>) => {
      const component = new ReactRenderer(VariableAutocompletePopover, {
        props,
        editor: props.editor,
      });

      const popup = tippy('body', {
        getReferenceClientRect: props.clientRect as () => DOMRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
        offset: [0, 8],
        animation: 'shift-away',
        maxWidth: 400,
        zIndex: 9999,
      });

      return {
        component,
        popup: popup[0],
      };
    },

    onUpdate: (
      props: SuggestionProps<SmartVariable>,
      state: { component: ReactRenderer; popup: TippyInstance }
    ) => {
      state.component.updateProps(props);

      if (props.clientRect) {
        state.popup.setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
      }
    },

    onKeyDown: (
      props: SuggestionKeyDownProps,
      state: { component: ReactRenderer<VariableAutocompletePopoverRef>; popup: TippyInstance }
    ) => {
      if (props.event.key === 'Escape') {
        state.popup.hide();
        return true;
      }

      return state.component.ref?.onKeyDown(props) ?? false;
    },

    onExit: (state: { component: ReactRenderer; popup: TippyInstance }) => {
      state.popup.destroy();
      state.component.destroy();
    },
  };
}

/**
 * Default suggestion options for the variable autocomplete
 */
export function getVariableSuggestionOptions() {
  let rendererState: { component: ReactRenderer; popup: TippyInstance } | null = null;

  return {
    render: () => ({
      onStart: (props: SuggestionProps<SmartVariable>) => {
        rendererState = createSuggestionRenderer().onStart(props);
      },
      onUpdate: (props: SuggestionProps<SmartVariable>) => {
        if (rendererState) {
          createSuggestionRenderer().onUpdate(props, rendererState);
        }
      },
      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (rendererState) {
          return createSuggestionRenderer().onKeyDown(props, rendererState);
        }
        return false;
      },
      onExit: () => {
        if (rendererState) {
          createSuggestionRenderer().onExit(rendererState);
          rendererState = null;
        }
      },
    }),
  };
}
