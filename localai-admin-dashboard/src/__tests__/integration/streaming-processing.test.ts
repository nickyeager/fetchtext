/**
 * Streaming Processing Integration Tests
 *
 * Tests the SSE /process-document-stream endpoint from the frontend
 * perspective. Calls the real running backend — no mocks.
 *
 * Run with:
 *   cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run src/__tests__/integration/streaming-processing.test.ts
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

const BACKEND_URL =
  process.env.VITE_DOCUMENT_PROCESSOR_URL || 'http://localhost:8090';

let backendAvailable = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const loadFixture = async (
  relativePath: string,
  mimeType = 'text/plain',
): Promise<File> => {
  const absolutePath = path.resolve(
    __dirname,
    '../../../tests/fixtures',
    relativePath,
  );
  const buffer = await fs.readFile(absolutePath);
  const arrayBuffer: ArrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mimeType });
  return new File([blob], path.basename(absolutePath), { type: mimeType });
};

interface SSEEvent {
  event: string;
  data: Record<string, any>;
}

/**
 * Make a POST request to the SSE endpoint and collect all events.
 * Uses the native fetch API (Node 18+ / undici) to stream.
 */
async function streamDocumentProcessing(
  file: File,
  params: Record<string, string> = {},
): Promise<{ status: number; events: SSEEvent[]; rawBody: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const searchParams = new URLSearchParams(params);
  const url = `${BACKEND_URL}/api/enhanced-documents/process-document-stream?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  const rawBody = await response.text();

  // Parse SSE events
  const events: SSEEvent[] = [];
  let currentEvent: string | null = null;
  const currentData: string[] = [];

  for (const line of rawBody.split('\n')) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice('event: '.length).trim();
    } else if (line.startsWith('data: ')) {
      currentData.push(line.slice('data: '.length));
    } else if (line === '' && currentEvent !== null) {
      const dataStr = currentData.join('\n');
      try {
        events.push({ event: currentEvent, data: JSON.parse(dataStr) });
      } catch {
        events.push({ event: currentEvent, data: { raw: dataStr } });
      }
      currentEvent = null;
      currentData.length = 0;
    }
  }

  return { status: response.status, events, rawBody };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(async () => {
  try {
    const resp = await fetch(`${BACKEND_URL}/health`);
    if (resp.ok) {
      backendAvailable = true;
    }
  } catch {
    // will fail in test
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SSE Streaming Processing Endpoint', () => {
  it('should return SSE events for a real text file', async () => {
    if (!backendAvailable) {
      throw new Error(`Backend not available at ${BACKEND_URL} — cannot run integration test`);
    }

    const file = await loadFixture('real-test-invoice.txt');
    const { status, events } = await streamDocumentProcessing(file, {
      quick_scan: 'true',
      allow_generation: 'true',
    });

    expect(status).toBe(200);
    expect(events.length).toBeGreaterThanOrEqual(3);

    const eventTypes = events.map((e) => e.event);
    expect(eventTypes).toContain('stage');

    // Must end with 'complete' or 'error'
    const lastEvent = events[events.length - 1];
    expect(['complete', 'error']).toContain(lastEvent.event);
  }, 180_000);

  it('should include expected stages in the stream', async () => {
    if (!backendAvailable) {
      throw new Error(`Backend not available at ${BACKEND_URL}`);
    }

    const file = await loadFixture('real-test-invoice.txt');
    const { events } = await streamDocumentProcessing(file, {
      quick_scan: 'true',
    });

    const stages = events
      .filter((e) => e.event === 'stage')
      .map((e) => e.data.stage);

    expect(stages).toContain('received');
    // Must have some form of evaluation and text extraction
    expect(
      stages.includes('evaluated') || stages.includes('evaluating'),
    ).toBe(true);
    expect(
      stages.includes('text_extracted') || stages.includes('extracting_text'),
    ).toBe(true);
  }, 180_000);

  it('should have monotonically increasing progress values', async () => {
    if (!backendAvailable) {
      throw new Error(`Backend not available at ${BACKEND_URL}`);
    }

    const file = await loadFixture('real-test-contract.txt');
    const { events } = await streamDocumentProcessing(file);

    const progressValues = events
      .filter((e) => typeof e.data.progress === 'number')
      .map((e) => e.data.progress as number);

    expect(progressValues.length).toBeGreaterThanOrEqual(2);

    for (let i = 1; i < progressValues.length; i++) {
      expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
    }
  }, 180_000);

  it('should return complete result with evaluation and content', async () => {
    if (!backendAvailable) {
      throw new Error(`Backend not available at ${BACKEND_URL}`);
    }

    const file = await loadFixture('real-test-invoice.txt');
    const { events } = await streamDocumentProcessing(file);

    const completeEvents = events.filter((e) => e.event === 'complete');
    expect(completeEvents).toHaveLength(1);

    const completeData = completeEvents[0].data;
    expect(completeData.progress).toBe(100);
    expect(completeData.result).toBeDefined();

    const result = completeData.result;
    expect(result.evaluation).toBeDefined();
    expect(result.content).toBeDefined();
    expect(typeof result.content).toBe('string');
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.action).toBeDefined();
  }, 180_000);

  it('should include elapsed_ms timing in each stage', async () => {
    if (!backendAvailable) {
      throw new Error(`Backend not available at ${BACKEND_URL}`);
    }

    const file = await loadFixture('real-test-contract.txt');
    const { events } = await streamDocumentProcessing(file);

    const stageEvents = events.filter((e) => e.event === 'stage');
    expect(stageEvents.length).toBeGreaterThanOrEqual(2);

    for (const ev of stageEvents) {
      expect(ev.data.elapsed_ms).toBeDefined();
      expect(typeof ev.data.elapsed_ms).toBe('number');
      expect(ev.data.elapsed_ms).toBeGreaterThanOrEqual(0);
    }
  }, 180_000);

  it('should return 422 when no file is provided', async () => {
    if (!backendAvailable) {
      throw new Error(`Backend not available at ${BACKEND_URL}`);
    }

    const response = await fetch(
      `${BACKEND_URL}/api/enhanced-documents/process-document-stream`,
      { method: 'POST' },
    );

    expect(response.status).toBe(422);
  }, 30_000);
});
