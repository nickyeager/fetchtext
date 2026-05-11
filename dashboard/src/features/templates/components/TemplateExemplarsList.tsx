import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/context/auth-context';

const BACKEND_URL = import.meta.env.VITE_DOCUMENT_PROCESSOR_URL || 'http://localhost:8090';

interface Exemplar {
  id: number;
  document_name: string;
  exemplar_index: number;
  char_count: number;
  vector_indexed: boolean;
  created_at: string;
}

interface TemplateExemplarsListProps {
  templateId: number;
  templateName?: string;
}

export function TemplateExemplarsList({ templateId, templateName }: TemplateExemplarsListProps) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const authHeaders: Record<string, string> = {};
  if (session?.access_token) {
    authHeaders['Authorization'] = `Bearer ${session.access_token}`;
  }

  const { data, isLoading } = useQuery({
    queryKey: ['template-exemplars', templateId],
    queryFn: async () => {
      const res = await fetch(
        `${BACKEND_URL}/api/enhanced-documents/templates/${templateId}/exemplars`,
        { headers: authHeaders }
      );
      if (!res.ok) throw new Error('Failed to fetch exemplars');
      return res.json() as Promise<{ exemplars: Exemplar[]; total: number }>;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(
        `${BACKEND_URL}/api/enhanced-documents/templates/${templateId}/exemplars`,
        { method: 'POST', body: formData, headers: authHeaders }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(err.detail || 'Upload failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-exemplars', templateId] });
      setUploading(false);
    },
    onError: () => {
      setUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (exemplarId: number) => {
      const res = await fetch(
        `${BACKEND_URL}/api/enhanced-documents/templates/${templateId}/exemplars/${exemplarId}`,
        { method: 'DELETE', headers: authHeaders }
      );
      if (!res.ok) throw new Error('Failed to delete exemplar');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-exemplars', templateId] });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    uploadMutation.mutate(file);
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const exemplars = data?.exemplars ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Example Documents</CardTitle>
            <CardDescription>
              Upload example documents to improve template matching accuracy.
              More examples help the system recognize documents that belong to this template.
            </CardDescription>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.txt,.docx,.doc,.png,.jpg,.jpeg,.tiff"
              onChange={handleFileSelect}
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploading ? 'Uploading...' : 'Add Example'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : exemplars.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No example documents yet</p>
            <p className="text-sm mt-1">
              Upload documents that represent this template to improve matching.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {exemplars.map((ex) => (
              <div
                key={ex.id}
                className="flex items-center justify-between p-3 rounded-md border bg-card"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{ex.document_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ex.char_count.toLocaleString()} chars
                      {' · '}
                      {new Date(ex.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ex.vector_indexed ? (
                    <Badge variant="outline" className="gap-1 text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      Indexed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-yellow-600">
                      <XCircle className="h-3 w-3" />
                      Not indexed
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(ex.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {uploadMutation.isError && (
          <p className="text-sm text-destructive mt-3">
            Upload failed: {uploadMutation.error?.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
