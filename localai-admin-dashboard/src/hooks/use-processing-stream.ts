/**
 * Hook for streaming document processing progress via SSE.
 *
 * Uses raw fetch() + ReadableStream instead of @microsoft/fetch-event-source
 * because that library silently drops long-lived SSE connections through
 * Azure Container Apps' Envoy proxy.  Raw fetch streaming works reliably.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { DOCUMENT_PROCESSOR_URL } from '@/lib/api-config'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessingLogEntry {
  stage: string
  message: string
  progress: number
  elapsed_ms: number
  timestamp: number // Date.now() when received
  status: 'completed' | 'active' | 'pending' | 'error'
}

export interface StreamResult {
  evaluation: any
  content: string
  metadata: any
  chosen_template: any
  decision_metadata: any
  extracted_fields: any
  generated_template: any
  alternatives: any[]
  action: string
}

export type StreamStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'complete'
  | 'error'

export interface UseProcessingStreamReturn {
  /** Start streaming processing for the given file. */
  startProcessing: (
    file: File,
    options?: {
      quickScan?: boolean
      minMatchConfidence?: number
      allowGeneration?: boolean
      organizationId?: string
      accessToken?: string
    }
  ) => void
  /** Abort the current stream. */
  abort: () => void
  /** Abort and reset all state back to idle (for "Try Again" flows). */
  reset: () => void
  /** Ordered list of log entries (newest last). */
  logs: ProcessingLogEntry[]
  /** Overall progress 0–100. */
  progress: number
  /** Current status of the stream. */
  status: StreamStatus
  /** Final result payload (available once status === 'complete'). */
  result: StreamResult | null
  /** Error message if status === 'error'. */
  error: string | null
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
]

// ---------------------------------------------------------------------------
// Minimal SSE parser for ReadableStream chunks
// ---------------------------------------------------------------------------

interface SSEEvent {
  event: string
  data: string
}

function parseSSEChunk(buffer: string): {
  events: SSEEvent[]
  remaining: string
} {
  const events: SSEEvent[] = []
  // SSE events are separated by blank lines (\n\n)
  const blocks = buffer.split('\n\n')
  // The last element is either empty (complete event) or a partial event
  const remaining = blocks.pop() ?? ''

  for (const block of blocks) {
    if (!block.trim()) continue
    let eventType = 'message'
    const dataLines: string[] = []

    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        dataLines.push(line.slice(6))
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5))
      }
    }

    if (dataLines.length > 0) {
      events.push({ event: eventType, data: dataLines.join('\n') })
    }
  }

  return { events, remaining }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProcessingStream(): UseProcessingStreamReturn {
  const [logs, setLogs] = useState<ProcessingLogEntry[]>([])
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<StreamStatus>('idle')
  const [result, setResult] = useState<StreamResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setLogs([])
    setProgress(0)
    setStatus('idle')
    setResult(null)
    setError(null)
  }, [])

  // Cleanup: abort any active stream when the component unmounts
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const startProcessing = useCallback(
    (
      file: File,
      options?: {
        quickScan?: boolean
        minMatchConfidence?: number
        allowGeneration?: boolean
        organizationId?: string
        accessToken?: string
      }
    ) => {
      // Reset state
      setLogs([])
      setProgress(0)
      setStatus('connecting')
      setResult(null)
      setError(null)

      // Abort any existing stream
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      const formData = new FormData()
      formData.append('file', file)

      const params = new URLSearchParams()
      if (options?.quickScan !== undefined)
        params.set('quick_scan', String(options.quickScan))
      if (options?.minMatchConfidence !== undefined)
        params.set('min_match_confidence', String(options.minMatchConfidence))
      if (options?.allowGeneration !== undefined)
        params.set('allow_generation', String(options.allowGeneration))
      if (options?.organizationId)
        params.set('organization_id', options.organizationId)

      const url = `${DOCUMENT_PROCESSOR_URL}/api/enhanced-documents/process-document-stream?${params.toString()}`

      const handleEvent = (ev: SSEEvent) => {
        if (!ev.data) return

        let data: any
        try {
          data = JSON.parse(ev.data)
        } catch {
          return
        }

        // Skip keepalive events — they're just for proxy idle-timeout prevention
        if (ev.event === 'keepalive') return

        if (ev.event === 'stage') {
          const entry: ProcessingLogEntry = {
            stage: data.stage,
            message: data.message,
            progress: data.progress ?? 0,
            elapsed_ms: data.elapsed_ms ?? 0,
            timestamp: Date.now(),
            status: 'completed',
          }

          setLogs((prev) => {
            const updated = prev.map((e) => ({
              ...e,
              status: 'completed' as const,
            }))
            return [...updated, { ...entry, status: 'active' as const }]
          })
          setProgress(data.progress ?? 0)
        }

        if (ev.event === 'error') {
          const entry: ProcessingLogEntry = {
            stage: data.stage,
            message: data.message,
            progress: data.progress ?? 0,
            elapsed_ms: data.elapsed_ms ?? 0,
            timestamp: Date.now(),
            status: 'error',
          }
          setLogs((prev) => [...prev, entry])
          setError(data.message)
          setStatus('error')
        }

        if (ev.event === 'complete') {
          setLogs((prev) =>
            prev.map((e) => ({ ...e, status: 'completed' as const }))
          )
          setProgress(100)
          setResult(data.result ?? null)
          setStatus('complete')
        }
      }

      ;(async () => {
        try {
          const headers: Record<string, string> = {}
          if (options?.accessToken) {
            headers['Authorization'] = `Bearer ${options.accessToken}`
          }

          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData,
            signal: ctrl.signal,
          })

          if (!response.ok) {
            const text = await response.text()
            throw new Error(`Server responded with ${response.status}: ${text}`)
          }

          if (!response.body) {
            throw new Error('Response body is null — streaming not supported')
          }

          setStatus('streaming')

          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const { events, remaining } = parseSSEChunk(buffer)
            buffer = remaining

            for (const ev of events) {
              handleEvent(ev)
            }
          }

          // Process any remaining buffer
          if (buffer.trim()) {
            const { events } = parseSSEChunk(buffer + '\n\n')
            for (const ev of events) {
              handleEvent(ev)
            }
          }
        } catch (err) {
          if (ctrl.signal.aborted) return
          console.error('[useProcessingStream] stream error:', err)
          setError(err instanceof Error ? err.message : 'Connection lost')
          setStatus('error')
        }
      })()
    },
    []
  )

  return {
    startProcessing,
    abort,
    reset,
    logs,
    progress,
    status,
    result,
    error,
  }
}
