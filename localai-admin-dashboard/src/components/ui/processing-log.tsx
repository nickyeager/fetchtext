/**
 * ProcessingLog — real-time log panel that shows SSE streaming progress
 * during document processing.
 *
 * Displays a progress bar at the top and a scrolling list of stage entries
 * with checkmarks (completed), spinner (active), or X (error).
 */

import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CheckCircle2, Loader2, XCircle, FileText } from 'lucide-react';
import type { ProcessingLogEntry, StreamStatus } from '@/hooks/use-processing-stream';

interface ProcessingLogProps {
  logs: ProcessingLogEntry[];
  progress: number;
  status: StreamStatus;
  error?: string | null;
  className?: string;
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StageIcon({ entryStatus }: { entryStatus: ProcessingLogEntry['status'] }) {
  switch (entryStatus) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />;
    case 'active':
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 shrink-0 text-red-500" />;
    default:
      return <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted" />;
  }
}

export function ProcessingLog({
  logs,
  progress,
  status,
  error,
  className,
}: ProcessingLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  const headerText =
    status === 'complete'
      ? 'Processing Complete'
      : status === 'error'
        ? 'Processing Error'
        : 'Processing Document';

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            {headerText}
          </CardTitle>
          <span className="text-sm font-medium text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="mt-2" />
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea className="h-[220px]" ref={scrollRef}>
          <div className="space-y-2 pr-4">
            {logs.map((entry, idx) => (
              <div
                key={`${entry.stage}-${idx}`}
                className={cn(
                  'flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                  entry.status === 'active' && 'bg-blue-50 dark:bg-blue-950/40',
                  entry.status === 'error' && 'bg-red-50 dark:bg-red-950/40',
                )}
              >
                <StageIcon entryStatus={entry.status} />
                <span className="flex-1 leading-tight">{entry.message}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatElapsed(entry.elapsed_ms)}
                </span>
              </div>
            ))}

            {/* Show connecting state when no logs yet */}
            {logs.length === 0 && status === 'connecting' && (
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting to processing service...
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Error banner */}
        {error && status === 'error' && (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
