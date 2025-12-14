import { createFileRoute } from '@tanstack/react-router';
import { DocumentGallery } from '@/components/documents/DocumentGallery';

export const Route = createFileRoute('/_authenticated/documents/gallery')({
  component: DocumentGalleryPage,
});

function DocumentGalleryPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <DocumentGallery />
    </div>
  );
}