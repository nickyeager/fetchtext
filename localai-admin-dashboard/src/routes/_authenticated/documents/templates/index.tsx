import React, { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/documents/templates/')({
  component: DocumentTemplatesRedirectPage,
});

// Redirect component to main templates route
export function DocumentTemplatesRedirectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the main templates route
    navigate({ to: '/templates', replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-muted-foreground">Redirecting to templates...</div>
    </div>
  );
}