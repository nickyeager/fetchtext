import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Image, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

export function DocumentPreviewPanel({
  fileUrl,
  fileName,
  fileType,
  fileSize,
  className,
}: DocumentPreviewPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

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
            ) : isImage ? (
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
