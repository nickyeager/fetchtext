import { useCallback, useEffect, useRef, useState } from 'react';

export interface TextSelectionState {
  /** The currently selected text (empty string when nothing is selected) */
  selectedText: string;
  /** Position relative to the container, for popover placement */
  position: { x: number; y: number } | null;
  /** Whether the user is actively selecting */
  isSelecting: boolean;
  /** Clear the current selection */
  clearSelection: () => void;
}

/**
 * Hook that detects text selection within a container element.
 * Returns selected text and position for anchoring a popover/dialog.
 */
export function useTextSelection(
  containerRef: React.RefObject<HTMLElement | null>,
): TextSelectionState {
  const [selectedText, setSelectedText] = useState('');
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isSelecting, setIsSelecting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedText('');
    setPosition(null);
    setIsSelecting(false);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = () => {
      setIsSelecting(true);
    };

    const handleMouseUp = () => {
      // Debounce to let the browser finalize the selection
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim() ?? '';

        if (text.length < 2) {
          setSelectedText('');
          setPosition(null);
          setIsSelecting(false);
          return;
        }

        // Verify the selection is within the container
        if (
          selection?.rangeCount &&
          container.contains(selection.getRangeAt(0).commonAncestorContainer)
        ) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          setSelectedText(text);
          setPosition({
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top,
          });
        } else {
          setSelectedText('');
          setPosition(null);
        }

        setIsSelecting(false);
      }, 150);
    };

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseup', handleMouseUp);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [containerRef]);

  return { selectedText, position, isSelecting, clearSelection };
}
