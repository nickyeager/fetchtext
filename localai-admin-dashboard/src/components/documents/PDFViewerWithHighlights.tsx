/**
 * PDFViewerWithHighlights - PDF viewer using react-pdf with highlight overlay
 *
 * This component provides a full-featured PDF viewer with:
 * - Page navigation controls
 * - Zoom in/out functionality
 * - Highlight overlay for extracted field values
 * - Automatic navigation to highlighted fields
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { HighlightOverlay } from './HighlightOverlay';
import { FieldHighlight, PageDimensions } from '@/types/highlights';

// Configure PDF.js worker
// Using unpkg CDN for the worker file to avoid bundling issues
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerWithHighlightsProps {
  /** PDF file URL or blob */
  file: string | Blob;
  /** Highlights to display */
  highlights: FieldHighlight[];
  /** Active field name */
  activeHighlight: string | null;
  /** Callback when highlight is clicked */
  onHighlightClick?: (highlight: FieldHighlight) => void;
  /** Callback for page change */
  onPageChange?: (page: number) => void;
  /** Callback when PDF loads successfully */
  onLoadComplete?: () => void;
  /** Callback when PDF fails to load */
  onLoadError?: (error: Error) => void;
  /** Custom class name */
  className?: string;
}

export function PDFViewerWithHighlights({
  file,
  highlights,
  activeHighlight,
  onHighlightClick,
  onPageChange,
  onLoadComplete,
  onLoadError,
  className,
}: PDFViewerWithHighlightsProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [pageDimensions, setPageDimensions] = useState<PageDimensions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredHighlight, setHoveredHighlight] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
    onLoadComplete?.();
  }, [onLoadComplete]);

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message);
    setIsLoading(false);
    onLoadError?.(err);
  }, [onLoadError]);

  const onPageLoadSuccess = useCallback((page: { width: number; height: number }) => {
    setPageDimensions({
      width: page.width * scale,
      height: page.height * scale,
      pageNumber: currentPage,
    });
  }, [currentPage, scale]);

  const goToPage = useCallback((page: number) => {
    const newPage = Math.max(1, Math.min(page, numPages));
    setCurrentPage(newPage);
    onPageChange?.(newPage);
  }, [numPages, onPageChange]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  // Navigate to page with active highlight
  useEffect(() => {
    if (activeHighlight) {
      const highlight = highlights.find((h) => h.fieldName === activeHighlight);
      if (highlight && highlight.page !== currentPage) {
        goToPage(highlight.page);
      }
    }
  }, [activeHighlight, highlights, currentPage, goToPage]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {numPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Document container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/30 p-4"
      >
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full text-destructive">
            <p>Error loading PDF: {error}</p>
          </div>
        )}

        <div className="relative inline-block mx-auto">
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              onLoadSuccess={onPageLoadSuccess}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>

          {/* Highlight overlay */}
          <HighlightOverlay
            highlights={highlights}
            currentPage={currentPage}
            pageDimensions={pageDimensions}
            activeHighlight={activeHighlight}
            hoveredHighlight={hoveredHighlight}
            onHighlightClick={onHighlightClick}
            onHighlightHover={(h) => setHoveredHighlight(h?.fieldName ?? null)}
          />
        </div>
      </div>
    </div>
  );
}
