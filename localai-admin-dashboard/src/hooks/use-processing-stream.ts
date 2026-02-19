/**
 * Hook for streaming document processing progress via SSE.
 *
 * Uses @microsoft/fetch-event-source (supports POST + FormData, unlike the
 * browser-native EventSource which is GET-only).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { DOCUMENT_PROCESSOR_URL } from '@/lib/api-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessingLogEntry {
  stage: string;
  message: string;
  progress: number;
  elapsed_ms: number;
  timestamp: number; // Date.now() when received
  status: 'completed' | 'active' | 'pending' | 'error';
}

export interface StreamResult {
  evaluation: any;
  content: string;
  metadata: any;
  chosen_template: any;
  decision_metadata: any;
  extracted_fields: any;
  generated_template: any;
  alternatives: any[];
  action: string;
}

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';

export interface UseProcessingStreamReturn {
  /** Start streaming processing for the given file. */
  startProcessing: (
    file: File,
    options?: {
      quickScan?: boolean;
      minMatchConfidence?: number;
      allowGeneration?: boolean;
      organizationId?: string;
    },
  ) => void;
  /** Abort the current stream. */
  abort: () => void;
  /** Abort and reset all state back to idle (for "Try Again" flows). */
  reset: () => void;
  /** Ordered list of log entries (newest last). */
  logs: ProcessingLogEntry[];
  /** Overall progress 0–100. */
  progress: number;
  /** Current status of the stream. */
  status: StreamStatus;
  /** Final result payload (available once status === 'complete'). */
  result: StreamResult | null;
  /** Error message if status === 'error'. */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Stages in display order
// ---------------------------------------------------------------------------

const STAGE_ORDER = [
  'received',
  'extracting_text',
  'text_extracted',
  'evaluating',
  'evaluated',
  'matching_template',
  'template_matched',
  'generating_template',
  'template_generated',
  'extracting_fields',
  'fields_extracted',
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProcessingStream(): UseProcessingStreamReturn {
  const [logs, setLogs] = useState<ProcessingLogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [result, setResult] = useState<StreamResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLogs([]);
    setProgress(0);
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  // Cleanup: abort any active stream when the component unmounts
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const startProcessing = useCallback(
    (
      file: File,
      options?: {
        quickScan?: boolean;
        minMatchConfidence?: number;
        allowGeneration?: boolean;
        organizationId?: string;
      },
    ) => {
      // Reset state
      setLogs([]);
      setProgress(0);
      setStatus('connecting');
      setResult(null);
      setError(null);

      // Abort any existing stream
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const formData = new FormData();
      formData.append('file', file);

      const params = new URLSearchParams();
      if (options?.quickScan !== undefined) params.set('quick_scan', String(options.quickScan));
      if (options?.minMatchConfidence !== undefined)
        params.set('min_match_confidence', String(options.minMatchConfidence));
      if (options?.allowGeneration !== undefined)
        params.set('allow_generation', String(options.allowGeneration));
      if (options?.organizationId) params.set('organization_id', options.organizationId);

      const url = `${DOCUMENT_PROCESSOR_URL}/api/enhanced-documents/process-document-stream?${params.toString()}`;

      fetchEventSource(url, {
        method: 'POST',
        body: formData,
        signal: ctrl.signal,

        onopen: async (response) => {
          if (response.ok) {
            setStatus('streaming');
          } else {
            const text = await response.text();
            throw new Error(`Server responded with ${response.status}: ${text}`);
          }
        },

        onmessage: (ev) => {
          if (!ev.data) return;

          let data: any;
          try {
            data = JSON.parse(ev.data);
          } catch {
            return;
          }

          if (ev.event === 'stage') {
            const entry: ProcessingLogEntry = {
              stage: data.stage,
              message: data.message,
              progress: data.progress ?? 0,
              elapsed_ms: data.elapsed_ms ?? 0,
              timestamp: Date.now(),
              status: 'completed',
            };

            setLogs((prev) => {
              // Mark all previous entries as completed, add new one as active
              const updated = prev.map((e) => ({
                ...e,
                status: 'completed' as const,
              }));
              return [...updated, { ...entry, status: 'active' as const }];
            });
            setProgress(data.progress ?? 0);
          }

          if (ev.event === 'error') {
            const entry: ProcessingLogEntry = {
              stage: data.stage,
              message: data.message,
              progress: data.progress ?? 0,
              elapsed_ms: data.elapsed_ms ?? 0,
              timestamp: Date.now(),
              status: 'error',
            };
            setLogs((prev) => [...prev, entry]);
            setError(data.message);
            setStatus('error');
          }

          if (ev.event === 'complete') {
            // Mark last log entry as completed
            setLogs((prev) =>
              prev.map((e) => ({ ...e, status: 'completed' as const })),
            );
            setProgress(100);
            setResult(data.result ?? null);
            setStatus('complete');
          }
        },

        onerror: (err) => {
          // If we aborted intentionally, don't treat as error
          if (ctrl.signal.aborted) return;

          console.error('[useProcessingStream] SSE error:', err);
          setError(err instanceof Error ? err.message : 'Connection lost');
          setStatus('error');

          // Don't retry — the library retries by default; throw to stop
          throw err;
        },

        // Don't let the library auto-open on close
        openWhenHidden: true,
      }).catch((err) => {
        if (ctrl.signal.aborted) return;
        console.error('[useProcessingStream] fetch failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect');
        setStatus('error');
      });
    },
    [],
  );

  return { startProcessing, abort, reset, logs, progress, status, result, error };
}
