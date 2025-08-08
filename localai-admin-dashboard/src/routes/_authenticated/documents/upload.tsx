import { createFileRoute } from '@tanstack/react-router';
import { DocumentUploadPage } from '@/features/documents/components/DocumentUploadPage';

export const Route = createFileRoute('/_authenticated/documents/upload')({
  component: DocumentUpload,
});

function DocumentUpload() {
  return (
    <div className="container mx-auto py-6">
      <DocumentUploadPage />
    </div>
  );
}