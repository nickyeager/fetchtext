import { createFileRoute, Link } from '@tanstack/react-router';

function DebugPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold">Debug Route</h1>
      <p>Current URL: {window.location.href}</p>
      <p>This is a debug route to test routing</p>
      
      <div className="mt-4 space-y-2">
        <Link to="/documents" className="block text-blue-600 hover:underline">
          → Go to /documents
        </Link>
        <Link 
          to="/documents/process" 
          search={{ templateId: "1" }}
          className="block text-blue-600 hover:underline"
        >
          → Go to /documents/process?templateId=1
        </Link>
        <Link 
          to="/documents/process-document" 
          search={{ templateId: "1" }}
          className="block text-blue-600 hover:underline"
        >
          → Go to /documents/process-document?templateId=1
        </Link>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/debug')({
  component: DebugPage,
});
