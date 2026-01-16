import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Image, Loader2, ExternalLink, AlertCircle, Highlighter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PDFViewerWithHighlights } from '@/components/documents/PDFViewerWithHighlights';
import { ImageViewerWithHighlights } from '@/components/documents/ImageViewerWithHighlights';
import { FieldHighlight, createFieldHighlight } from '@/types/highlights';

/**
 * Extracted field structure from document processing
 */
interface ExtractedFieldData {
  value: unknown;
  confidence?: number;
  sourceText?: string;
  location?: {
    page?: number;
    position?: number;
    bbox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

interface DocumentPreviewPanelProps {
  /** Document file URL (signed URL from Supabase storage) */
  fileUrl: string | null;
  /** Document file name */
  fileName: string;
  /** Document file type (mime type) */
  fileType: string;
  /** Document file size in bytes */
  fileSize?: number;
  /** Custom class name */
  className?: string;
  /** Extracted fields for highlighting (optional) */
  extractedFields?: Record<string, ExtractedFieldData | string | null>;
  /** Currently active/selected field name (optional) */
  activeField?: string | null;
  /** Callback when a highlight is clicked (optional) */
  onHighlightClick?: (fieldName: string, value: string) => void;
  /** Whether to show highlights by default (optional, defaults to true if extractedFields provided) */
  showHighlights?: boolean;
}

export function DocumentPreviewPanel({
  fileUrl,
  fileName,
  fileType,
  fileSize,
  className,
  extractedFields,
  activeField = null,
  onHighlightClick,
  showHighlights: showHighlightsProp,
}: DocumentPreviewPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Reset loading state when fileUrl changes
  React.useEffect(() => {
    if (fileUrl) {
      setIsLoading(true);
      setHasError(false);
    } else {
      // No file URL means nothing to load
      setIsLoading(false);
    }
  }, [fileUrl]);

  // Fallback timeout to prevent infinite loading
  React.useEffect(() => {
    if (!isLoading || !fileUrl) return;

    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading, fileUrl]);

  // Determine if we have highlights available and if they should be shown
  const hasExtractedFields = extractedFields && Object.keys(extractedFields).length > 0;
  const [highlightsEnabled, setHighlightsEnabled] = useState(
    showHighlightsProp ?? hasExtractedFields ?? false
  );

  /**
   * Convert extracted fields to FieldHighlight array for the viewers
   */
  const highlights = useMemo((): FieldHighlight[] => {
    if (!extractedFields || !highlightsEnabled) return [];

    return Object.entries(extractedFields)
      .filter(([, field]) => field !== null)
      .map(([fieldName, field]) => {
        // Handle both structured fields and simple string values
        if (typeof field === 'string') {
          return createFieldHighlight(fieldName, field, 0.5, 1, null);
        }

        const extractedField = field as ExtractedFieldData;
        const value = String(extractedField.value ?? '');
        const confidence = extractedField.confidence ?? 0.5;
        const page = extractedField.location?.page ?? 1;

        // Convert bbox to BoundingBox format if available
        const rawBbox = extractedField.location?.bbox;
        const bbox = rawBbox ? {
          x: rawBbox.x,
          y: rawBbox.y,
          width: rawBbox.width,
          height: rawBbox.height,
          coordinateType: 'pixel' as const, // Backend returns pixel coordinates
        } : null;

        return createFieldHighlight(fieldName, value, confidence, page, bbox);
      });
  }, [extractedFields, highlightsEnabled]);

  /**
   * Handle highlight click from the viewers
   */
  const handleHighlightClick = (highlight: FieldHighlight) => {
    onHighlightClick?.(highlight.fieldName, highlight.value);
  };

  const isPdf = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isImage = fileType.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|tiff?)$/i.test(fileName);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async () => {
    if (!fileUrl) return;

    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Ensure .pdf extension for PDF download
      const downloadName = isPdf && !fileName.toLowerCase().endsWith('.pdf')
        ? `${fileName}.pdf`
        : fileName;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleOpenInNewTab = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {isPdf ? <FileText className="h-5 w-5" /> : <Image className="h-5 w-5" />}
            Original Document
          </CardTitle>
          <div className="flex gap-2">
            {/* Highlights toggle - only show if we have extracted fields */}
            {hasExtractedFields && (
              <Button
                variant={highlightsEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setHighlightsEnabled(!highlightsEnabled)}
                title={highlightsEnabled ? "Hide highlights" : "Show highlights"}
              >
                <Highlighter className="h-4 w-4 mr-1" />
                {highlightsEnabled ? "Highlights On" : "Highlights Off"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInNewTab}
              disabled={!fileUrl}
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Open
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleDownload}
              disabled={!fileUrl}
              title="Download document"
            >
              <Download className="h-4 w-4 mr-1" />
              Download PDF
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {fileName}
          {fileSize && ` • ${formatFileSize(fileSize)}`}
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-[400px]">
        {!fileUrl ? (
          <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
            <div className="text-center p-8">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No document file available</p>
              <p className="text-sm mt-1">The document file could not be loaded</p>
            </div>
          </div>
        ) : hasError ? (
          <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
            <div className="text-center p-8">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-30 text-destructive" />
              <p className="font-medium">Unable to preview document</p>
              <p className="text-sm mt-1 mb-4">The preview could not be loaded</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInNewTab}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open in new tab
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative h-full w-full rounded-lg overflow-hidden border bg-muted/10">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading preview...</p>
                </div>
              </div>
            )}

            {isPdf ? (
              highlightsEnabled && highlights.length > 0 ? (
                // Use the highlight-enabled PDF viewer
                <PDFViewerWithHighlights
                  file={fileUrl}
                  highlights={highlights}
                  activeHighlight={activeField}
                  onHighlightClick={handleHighlightClick}
                  onLoadComplete={() => setIsLoading(false)}
                  onLoadError={() => {
                    setIsLoading(false);
                    setHasError(true);
                  }}
                  className="w-full h-full min-h-[500px]"
                />
              ) : (
                // Fallback to simple iframe viewer
                <iframe
                  src={`${fileUrl}#view=FitH&toolbar=1`}
                  className="w-full h-full min-h-[500px]"
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    setHasError(true);
                  }}
                  title={`Preview of ${fileName}`}
                  style={{ border: 'none' }}
                />
              )
            ) : isImage ? (
              highlightsEnabled && highlights.length > 0 ? (
                // Use the highlight-enabled image viewer
                <ImageViewerWithHighlights
                  src={fileUrl}
                  alt={fileName}
                  highlights={highlights}
                  activeHighlight={activeField}
                  onHighlightClick={handleHighlightClick}
                  onLoadComplete={() => setIsLoading(false)}
                  onLoadError={() => {
                    setIsLoading(false);
                    setHasError(true);
                  }}
                  className="w-full h-full min-h-[500px]"
                />
              ) : (
                // Fallback to simple image viewer
                <div className="w-full h-full min-h-[500px] flex items-center justify-center p-4">
                  <img
                    src={fileUrl}
                    alt={fileName}
                    className="max-w-full max-h-full object-contain rounded shadow-sm"
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                      setIsLoading(false);
                      setHasError(true);
                    }}
                  />
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center p-8">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">Preview not available</p>
                  <p className="text-sm mt-1 mb-4">This file type cannot be previewed</p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleDownload}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download to view
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
