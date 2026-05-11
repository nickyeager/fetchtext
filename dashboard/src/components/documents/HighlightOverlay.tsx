/**
 * HighlightOverlay - Renders highlight rectangles over document content
 */
import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  FieldHighlight,
  PageDimensions,
  getHighlightColor,
} from '@/types/highlights';

interface HighlightOverlayProps {
  highlights: FieldHighlight[];
  currentPage: number;
  pageDimensions: PageDimensions | null;
  activeHighlight: string | null;
  hoveredHighlight: string | null;
  onHighlightClick?: (highlight: FieldHighlight) => void;
  onHighlightHover?: (highlight: FieldHighlight | null) => void;
  className?: string;
}

export function HighlightOverlay({
  highlights,
  currentPage,
  pageDimensions,
  activeHighlight,
  hoveredHighlight,
  onHighlightClick,
  onHighlightHover,
  className,
}: HighlightOverlayProps) {
  // Filter highlights for current page
  const pageHighlights = useMemo(
    () => highlights.filter((h) => h.page === currentPage && h.bbox),
    [highlights, currentPage]
  );

  if (!pageDimensions || pageHighlights.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none',
        className
      )}
      style={{
        width: pageDimensions.width,
        height: pageDimensions.height,
      }}
    >
      {pageHighlights.map((highlight, index) => {
        if (!highlight.bbox) return null;

        const isActive = activeHighlight === highlight.fieldName;
        const isHovered = hoveredHighlight === highlight.fieldName;
        const color = getHighlightColor(highlight, isHovered, isActive);

        // Convert normalized coordinates to pixels if needed
        const { x, y, width, height, coordinateType } = highlight.bbox;
        const pixelX = coordinateType === 'normalized'
          ? x * pageDimensions.width
          : x;
        const pixelY = coordinateType === 'normalized'
          ? y * pageDimensions.height
          : y;
        const pixelWidth = coordinateType === 'normalized'
          ? width * pageDimensions.width
          : width;
        const pixelHeight = coordinateType === 'normalized'
          ? height * pageDimensions.height
          : height;

        return (
          <div
            key={`${highlight.fieldName}-${index}`}
            className={cn(
              'absolute rounded-sm transition-all duration-150',
              'pointer-events-auto cursor-pointer',
              isActive && 'ring-2 ring-blue-500 ring-offset-1',
              isHovered && 'ring-1 ring-orange-400'
            )}
            style={{
              left: pixelX,
              top: pixelY,
              width: pixelWidth,
              height: pixelHeight,
              backgroundColor: color,
              zIndex: isActive ? 20 : isHovered ? 15 : 10,
            }}
            onClick={() => onHighlightClick?.(highlight)}
            onMouseEnter={() => onHighlightHover?.(highlight)}
            onMouseLeave={() => onHighlightHover?.(null)}
            title={`${highlight.fieldName}: ${highlight.value} (${Math.round(highlight.confidence * 100)}%)`}
          />
        );
      })}
    </div>
  );
}
