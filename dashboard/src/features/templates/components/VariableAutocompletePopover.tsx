/**
 * Variable Autocomplete Popover
 *
 * React component for rendering the autocomplete dropdown when
 * users type `{{` in the TipTap editor. Shows filtered list of
 * available variables with keyboard navigation support.
 */

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import type { SmartVariable } from '@/types/unified-template';

export interface VariableAutocompletePopoverRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface VariableAutocompletePopoverProps {
  items: SmartVariable[];
  command: (item: SmartVariable) => void;
}

export const VariableAutocompletePopover = forwardRef<
  VariableAutocompletePopoverRef,
  VariableAutocompletePopoverProps
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div className="z-50 min-w-[200px] overflow-hidden rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
        <p className="text-sm text-muted-foreground">No variables found</p>
      </div>
    );
  }

  return (
    <div className="z-50 min-w-[280px] max-w-[400px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
      <div className="px-3 py-2 border-b">
        <p className="text-xs font-medium text-muted-foreground">
          Available Variables
        </p>
      </div>
      <div className="max-h-[300px] overflow-y-auto p-1">
        {props.items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectItem(index)}
            className={cn(
              'w-full flex flex-col items-start gap-0.5 px-3 py-2 rounded-sm text-left',
              'transition-colors cursor-pointer',
              'hover:bg-accent hover:text-accent-foreground',
              'focus:bg-accent focus:text-accent-foreground focus:outline-none',
              index === selectedIndex && 'bg-accent text-accent-foreground'
            )}
          >
            <div className="flex items-center gap-2 w-full">
              <span className="font-mono text-sm font-medium">
                {item.name}
              </span>
              <span className="ml-auto px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">
                {item.type || 'text'}
              </span>
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {item.description}
              </p>
            )}
          </button>
        ))}
      </div>
      <div className="px-3 py-2 border-t text-xs text-muted-foreground">
        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd> Navigate
        <span className="mx-2">·</span>
        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> Select
        <span className="mx-2">·</span>
        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> Cancel
      </div>
    </div>
  );
});

VariableAutocompletePopover.displayName = 'VariableAutocompletePopover';
