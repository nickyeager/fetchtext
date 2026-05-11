/**
 * ImageViewerWithHighlights - Image viewer with canvas-based highlight overlay
 *
 * This component provides a full-featured image viewer with:
 * - Zoom in/out functionality
 * - Rotation controls
 * - Highlight overlay for extracted field values
 * - Responsive image scaling
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loader2, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { HighlightOverlay } from './HighlightOverlay';
import { FieldHighlight, PageDimensions } from '@/types/highlights';

interface ImageViewerWithHighlightsProps {
  /** Image URL */
  src: string;
  /** Alt text */
  alt: string;
  /** Highlights to display */
  highlights: FieldHighlight[];
  /** Active field name */
  activeHighlight: string | null;
  /** Callback when highlight is clicked */
  onHighlightClick?: (highlight: FieldHighlight) => void;
  /** Callback when image loads successfully */
  onLoadComplete?: () => void;
  /** Callback when image fails to load */
  onLoadError?: () => void;
  /** Custom class name */
  className?: string;
}

export function ImageViewerWithHighlights({
  src,
  alt,
  highlights,
  activeHighlight,
  onHighlightClick,
  onLoadComplete,
  onLoadError,
  className,
}: ImageViewerWithHighlightsProps) {
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<PageDimensions | null>(null);
  const [hoveredHighlight, setHoveredHighlight] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    if (imageRef.current) {
      setDimensions({
        width: imageRef.current.naturalWidth * scale,
        height: imageRef.current.naturalHeight * scale,
        pageNumber: 1,
      });
    }
    onLoadComplete?.();
  }, [scale, onLoadComplete]);

  const handleImageError = useCallback(() => {
    setError('Failed to load image');
    setIsLoading(false);
    onLoadError?.();
  }, [onLoadError]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  // Update dimensions when scale changes
  useEffect(() => {
    if (imageRef.current && !isLoading) {
      setDimensions({
        width: imageRef.current.naturalWidth * scale,
        height: imageRef.current.naturalHeight * scale,
        pageNumber: 1,
      });
    }
  }, [scale, isLoading]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50">
        <span className="text-sm text-muted-foreground truncate max-w-[200px]">{alt}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleRotate}>
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/30 p-4 flex items-center justify-center"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full text-destructive">
            <p>{error}</p>
          </div>
        )}

        <div
          className="relative inline-block"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 0.3s ease',
          }}
        >
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{
              width: dimensions?.width ?? 'auto',
              height: dimensions?.height ?? 'auto',
              maxWidth: 'none',
            }}
            className="block"
          />

          {/* Highlight overlay */}
          {dimensions && (
            <HighlightOverlay
              highlights={highlights}
              currentPage={1}
              pageDimensions={dimensions}
              activeHighlight={activeHighlight}
              hoveredHighlight={hoveredHighlight}
              onHighlightClick={onHighlightClick}
              onHighlightHover={(h) => setHoveredHighlight(h?.fieldName ?? null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
