import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Upload, Loader2 } from 'lucide-react';

interface WorkflowFileUploadProps {
  file: File | null;
  isProcessing: boolean;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function WorkflowFileUpload({ file, isProcessing, onFileUpload }: WorkflowFileUploadProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload Document
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          type="file"
          accept=".pdf,.docx,.txt,.md,.pptx,.xlsx,.html,.csv,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tiff"
          onChange={onFileUpload}
          disabled={isProcessing}
          aria-label="Upload document"
          data-testid="document-file-input"
        />
        {file && (
          <div className="mt-2 text-sm text-gray-600" data-testid="document-uploaded">
            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </div>
        )}
        {isProcessing && (
          <div className="mt-4 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing document...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}