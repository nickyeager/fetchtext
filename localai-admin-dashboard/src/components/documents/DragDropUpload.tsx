import React, { useCallback, useState, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { useOrganization } from '@/context/organization-context';
import { useDocumentManager } from '@/hooks/use-document-manager';
import { UploadSource, DocumentStatus } from '@/services/unified-document-service';
import { toast } from 'sonner';

interface DragDropUploadProps {
  className?: string;
  onUploadStart?: () => void;
  onUploadComplete?: (documentId: string) => void;
}

const ACCEPTED_FORMATS = ['.pdf', '.docx', '.html', '.htm', '.jpg', '.jpeg', '.png', '.txt', '.md', '.pptx', '.xlsx', '.csv', '.gif', '.webp', '.bmp', '.tiff'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function DragDropUpload({ 
  className,
  onUploadStart,
  onUploadComplete 
}: DragDropUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { activeOrganization } = useOrganization();
  const documentManager = useDocumentManager({ enableRealTimeUpdates: true });

  // Dev-safe logger to avoid lint errors in production builds
  const isDev = (() => {
    // Prefer Vite env if present, otherwise fall back to NODE_ENV
    try { return (import.meta as unknown as { env?: { DEV?: boolean } })?.env?.DEV === true; } catch { /* noop */ }
    try { return typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'; } catch { /* noop */ }
    return false;
  })();
  // eslint-disable-next-line no-console
  const devLog = React.useCallback((...args: unknown[]) => { if (isDev) { console.log(...args); } }, [isDev]);
  // eslint-disable-next-line no-console
  const devError = React.useCallback((...args: unknown[]) => { if (isDev) { console.error(...args); } }, [isDev]);

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > MAX_SIZE) {
      return `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size (${(MAX_SIZE / 1024 / 1024).toFixed(1)}MB)`;
    }

    // Check file format
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_FORMATS.includes(fileExtension)) {
      return `File format "${fileExtension}" is not supported. Accepted formats: ${ACCEPTED_FORMATS.join(', ')}`;
    }

    return null;
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    devLog('🔵 UPLOAD: Starting file upload process', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      timestamp: new Date().toISOString()
    });

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      devLog('🔴 UPLOAD ERROR: File validation failed', { error: validationError });
      toast.error(validationError);
      return;
    }
    devLog('🔵 UPLOAD: File validation passed');

    // Check authentication
    if (!user || !session) {
      devLog('🔴 UPLOAD ERROR: User not authenticated');
  toast.error('Please sign in to upload documents');
      navigate({ to: '/sign-in' });
      return;
    }
    devLog('🔵 UPLOAD: Authentication verified', { userId: user.id });

    setIsUploading(true);
    onUploadStart?.();

    try {
      devLog('🔵 UPLOAD: Creating document record...');
      
      // Verify organization is selected
      if (!activeOrganization) {
        toast.error('Please select an organization first');
        return;
      }

      // Create document record
      const documentRecord = await documentManager.createDocument({
        file,
        uploadSource: UploadSource.SMART_UPLOAD,
        organizationId: activeOrganization.id,
      });
      
      devLog('🔵 UPLOAD: Document record created', {
        documentId: documentRecord.id,
        documentName: documentRecord.name,
        processingStatus: documentRecord.processing_status,
        filePath: documentRecord.file_path
      });

      devLog('🟡 ANALYSIS: Triggering AI analysis...');
      
      // Update status to analyzing
      await documentManager.updateDocumentStatus(documentRecord.id, {
        status: DocumentStatus.ANALYZING,
      });
      
      devLog('🟡 ANALYSIS: Status updated to analyzing');

      toast.success('Document uploaded successfully!');
      
      devLog('🔵 UPLOAD: Navigating to document detail page', { 
        documentId: documentRecord.id,
        route: `/documents/${documentRecord.id}` 
      });
      
      // Navigate to document detail page for AI evaluation
  navigate({ to: `/documents/${documentRecord.id}` });
      
      onUploadComplete?.(documentRecord.id);

    } catch (err) {
      devError('🔴 UPLOAD ERROR: Document upload failed:', err);
      devLog('🔴 UPLOAD ERROR: Error details', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString()
      });
      toast.error(err instanceof Error ? err.message : 'Document upload failed');
    } finally {
      setIsUploading(false);
      devLog('🔵 UPLOAD: Upload process completed, isUploading set to false');
    }
  }, [user, session, navigate, documentManager, validateFile, onUploadStart, onUploadComplete, devError, devLog]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDragging(true);
    }
  }, [isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [isUploading, handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const openFileDialog = useCallback(() => {
    if (!isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [isUploading]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FORMATS.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={isUploading}
        aria-hidden="true"
        tabIndex={-1}
        title="Select file to upload"
      />

      {/* Drag Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
        className={cn(
          "relative p-8 transition-all duration-200 cursor-pointer",
          "border-2 border-dashed rounded-lg",
          "hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/50",
          isDragging && "border-blue-500 bg-blue-50 dark:bg-blue-950",
          isUploading && "cursor-not-allowed opacity-50",
          !isDragging && "border-gray-300 dark:border-gray-600"
        )}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          {isUploading ? (
            <>
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900 dark:text-white">Uploading document...</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Please wait while we process your file</p>
              </div>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500" />
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  Drag & drop your document here
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">or click to browse files</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Supported formats: PDF, Word, Excel, PowerPoint, HTML, Images, Text
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Maximum size: 10MB
                </p>
              </div>
              
              {/* Upload Button Alternative */}
              <Button 
                variant="outline" 
                size="sm"
                className="mt-2"
                onClick={(e) => {
                  e.stopPropagation();
                  openFileDialog();
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Select File
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}