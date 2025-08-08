import { createFileRoute } from '@tanstack/react-router';
import { DocumentGallery } from '@/components/documents/DocumentGallery';

export const Route = createFileRoute('/_authenticated/documents/gallery')({
  component: DocumentGalleryPage,
  meta: () => [
    {
      title: 'Document Gallery - FetchText',
      description: 'Browse and manage your uploaded documents with search, filtering, and quick actions.',
    },
  ],
});

function DocumentGalleryPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <DocumentGallery />
    </div>
  );
}