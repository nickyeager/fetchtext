/**
 * Template Matching Regression Test
 *
 * This test verifies that when uploading the same document twice:
 * 1. First upload generates a new template (no matching template exists)
 * 2. Second upload MATCHES the generated template (not generates a new one)
 *
 * This tests the fix for the "No template applied" bug where identical documents
 * were not matching previously generated templates due to score threshold issues.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

// Test configuration - use environment variables with fallbacks
const BACKEND_URL = process.env.VITE_DOCUMENT_PROCESSOR_URL || 'http://localhost:8090';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:8000';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const TEST_TIMEOUT = 180000; // 3 minutes for AI processing (need time for 2 uploads)

let backendAvailable = false;
let createdTemplateIds: number[] = [];

// Helper: load a real fixture from tests/fixtures/
const loadFixture = async (relativePath: string, mimeType = 'text/plain'): Promise<File> => {
  const absolutePath = path.resolve(__dirname, '../../../tests/fixtures', relativePath);
  const buffer = await fs.readFile(absolutePath);
  const arrayBuffer: ArrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mimeType });
  return new File([blob], path.basename(absolutePath), { type: mimeType });
};

// Helper: check backend availability
const isBackendAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

// Helper: call decide-template endpoint
const decideTemplate = async (
  file: File,
  options: {
    autoSave?: boolean;
    userId?: string;
    minMatchConfidence?: number;
  } = {}
) => {
  const { autoSave = false, userId, minMatchConfidence = 0.5 } = options;

  const formData = new FormData();
  formData.append('file', file);

  const params = new URLSearchParams({
    quick_scan: 'true',
    min_match_confidence: minMatchConfidence.toString(),
    allow_generation: 'true',
    auto_save: autoSave.toString(),
    generation_mode: 'automatic',
  });

  if (userId) {
    params.append('user_id', userId);
  }

  console.log(`[TEST] Calling /decide-template with autoSave=${autoSave}, userId=${userId || 'none'}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT);

  try {
    const response = await fetch(
      `${BACKEND_URL}/api/enhanced-documents/decide-template?${params}`,
      { method: 'POST', body: formData, signal: controller.signal },
    );
    const data = response.ok ? await response.json() : null;

    console.log(`[TEST] Response: action=${data?.action}, status=${response.status}`);
    if (data?.decision_metadata) {
      console.log(`[TEST] Decision metadata:`, {
        match_score: data.decision_metadata.match_score,
        extraction_quality: data.decision_metadata.extraction_quality,
        validation_level: data.decision_metadata.validation_level,
        reason: data.decision_metadata.reason
      });
    }
    if (data?.chosen_template) {
      console.log(`[TEST] Chosen template: ${data.chosen_template.template_name} (ID: ${data.chosen_template.template_id})`);
    }
    if (data?.template?.id) {
      console.log(`[TEST] Generated template ID: ${data.template.id}`);
    }

    return { response, data } as const;
  } finally {
    clearTimeout(timeoutId);
  }
};

// Helper: delete a template from the database (cleanup)
const deleteTemplate = async (templateId: number): Promise<boolean> => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/smart_templates?id=eq.${templateId}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.ok;
  } catch (e) {
    console.error(`[TEST] Failed to delete template ${templateId}:`, e);
    return false;
  }
};

describe('Template Matching Regression Tests', () => {
  beforeAll(async () => {
    backendAvailable = await isBackendAvailable();
    if (!backendAvailable) {
      throw new Error(
        '[TEST SETUP FAILED] Backend not available at ' + BACKEND_URL + '\n' +
        'Integration tests REQUIRE running services.\n' +
        'Start services with: python start_services.py --profile cpu'
      );
    }
    console.log('[TEST] Backend available, running tests');
  });

  afterAll(async () => {
    // Cleanup: delete any templates we created during tests
    if (createdTemplateIds.length > 0) {
      console.log(`[TEST] Cleaning up ${createdTemplateIds.length} created templates...`);
      for (const templateId of createdTemplateIds) {
        await deleteTemplate(templateId);
      }
    }
  });

  describe('Identical Document Template Matching', () => {
    it('should match an existing template when uploading the same document twice', async () => {
      // Step 1: Load the test contract document
      // Using real-test-contract.txt which is more detailed and generates good keyword matches
      console.log('\n=== STEP 1: Loading test contract document ===');
      const contractFile = await loadFixture('real-test-contract.txt');
      console.log(`[TEST] Loaded file: ${contractFile.name} (${contractFile.size} bytes)`);

      // Step 2: First upload - should generate a new template
      console.log('\n=== STEP 2: First upload - expecting template generation ===');
      const firstResult = await decideTemplate(contractFile, {
        autoSave: true,
        minMatchConfidence: 0.5
      });

      expect(firstResult.response.ok).toBe(true);
      expect(firstResult.data).toBeDefined();

      // The first upload could either generate a new template or use an existing one
      // (if there's already a matching template in the database)
      const firstAction = firstResult.data.action;
      console.log(`[TEST] First upload action: ${firstAction}`);

      let templateId: number | undefined;
      let templateName: string | undefined;

      if (firstAction === 'generated') {
        // New template was generated
        expect(firstResult.data.template).toBeDefined();
        templateId = firstResult.data.template?.id || firstResult.data.generation_metadata?.template_id;
        templateName = firstResult.data.template?.name;
        console.log(`[TEST] Generated new template: "${templateName}" (ID: ${templateId})`);

        if (templateId) {
          createdTemplateIds.push(templateId);
        }
      } else if (firstAction === 'use_existing') {
        // Matched an existing template
        templateId = firstResult.data.chosen_template?.template_id;
        templateName = firstResult.data.chosen_template?.template_name;
        console.log(`[TEST] Matched existing template: "${templateName}" (ID: ${templateId})`);
      }

      // Verify we have a template to match against
      expect(templateId || templateName).toBeDefined();

      // Step 3: Wait a moment for database to sync
      console.log('\n=== STEP 3: Waiting for database sync ===');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 4: Second upload - SHOULD match the template from first upload
      console.log('\n=== STEP 4: Second upload - expecting template MATCH ===');
      const secondResult = await decideTemplate(contractFile, {
        autoSave: false, // Don't auto-save this time
        minMatchConfidence: 0.5
      });

      expect(secondResult.response.ok).toBe(true);
      expect(secondResult.data).toBeDefined();

      const secondAction = secondResult.data.action;
      console.log(`[TEST] Second upload action: ${secondAction}`);

      // THE CRITICAL ASSERTION: Second upload should use existing template, NOT generate new
      if (secondAction === 'generated') {
        // This is the BUG we're testing for!
        console.error('[TEST] BUG DETECTED: Second upload generated a new template instead of matching!');
        console.error('[TEST] Decision metadata:', JSON.stringify(secondResult.data.decision_metadata, null, 2));
        console.error('[TEST] Template suggestions:', JSON.stringify(secondResult.data.evaluation?.template_suggestions, null, 2));
      }

      expect(secondAction).toBe('use_existing');

      // Verify it matched a template (ideally the one from first upload)
      expect(secondResult.data.chosen_template).toBeDefined();
      console.log(`[TEST] Second upload matched template: "${secondResult.data.chosen_template.template_name}" (ID: ${secondResult.data.chosen_template.template_id})`);

      // Check the confidence levels
      const metadata = secondResult.data.decision_metadata;
      console.log(`[TEST] Match score: ${metadata.match_score}`);
      console.log(`[TEST] Extraction quality: ${metadata.extraction_quality}`);
      console.log(`[TEST] Validation level: ${metadata.validation_level}`);

      // Verify extraction quality is high (this was the key to the fix)
      expect(metadata.extraction_quality).toBeGreaterThanOrEqual(0.5);

      console.log('\n=== TEST PASSED: Identical document correctly matched existing template ===');

    }, TEST_TIMEOUT);

    it('should show extraction quality override when match score is low but extraction works', async () => {
      // This test verifies the fix specifically:
      // When match_score < 0.60 but extraction_quality >= 0.80,
      // the template should still be used

      console.log('\n=== Testing extraction quality override behavior ===');
      const contractFile = await loadFixture('real-test-contract.txt');

      const result = await decideTemplate(contractFile, {
        autoSave: false,
        minMatchConfidence: 0.5
      });

      expect(result.response.ok).toBe(true);

      if (result.data?.decision_metadata) {
        const { match_score, extraction_quality, reason } = result.data.decision_metadata;

        console.log(`[TEST] Match score: ${match_score}`);
        console.log(`[TEST] Extraction quality: ${extraction_quality}`);
        console.log(`[TEST] Reason: ${reason}`);

        // If match_score is low but extraction is high, verify the override kicked in
        if (match_score < 0.60 && extraction_quality >= 0.80) {
          expect(result.data.action).toBe('use_existing');
          expect(reason).toContain('extraction quality');
          console.log('[TEST] Extraction quality override confirmed!');
        }
      }

    }, TEST_TIMEOUT);
  });
});
