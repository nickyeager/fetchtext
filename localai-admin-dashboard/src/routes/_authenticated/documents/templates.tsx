import React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/documents/templates')({
  component: DocumentTemplatesLayout,
});

export function DocumentTemplatesLayout() {
  // This is a layout component that renders child routes
  return <Outlet />;
}

