#!/usr/bin/env tsx

/**
 * Ollama Integration Test Runner
 * 
 * This utility helps run the Ollama integration tests with proper setup:
 * 1. Checks if N8N is running
 * 2. Validates the Document_Template_AI_Extraction workflow is deployed
 * 3. Runs the integration tests
 * 4. Provides detailed reporting
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface TestConfig {
  n8nUrl: string;
  webhookPath: string;
  timeout: number;
  workflowFile: string;
}

const config: TestConfig = {
  n8nUrl: 'http://localhost:5678',
  webhookPath: '/webhook/document-extraction',
  timeout: 30000,
  workflowFile: '../../../n8n-tool-workflows/Document_Template_AI_Extraction.json'
};

async function checkN8NStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${config.n8nUrl}/health`);
    return response.ok;
  } catch (_error) {
    return false;
  }
}

async function checkWorkflowDeployment(): Promise<boolean> {
  try {
    // Try to ping the webhook endpoint
    const response = await fetch(`${config.n8nUrl}${config.webhookPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true })
    });
    
    // Should get a response (even if it's an error, it means the endpoint exists)
    return response.status !== 404;
  } catch (_error) {
    return false;
  }
}

function validateWorkflowFile(): boolean {
  const workflowPath = path.resolve(__dirname, config.workflowFile);
  
  if (!fs.existsSync(workflowPath)) {
    console.error('❌ Workflow file not found:', workflowPath); // eslint-disable-line no-console
    return false;
  }

  try {
    const workflowContent = fs.readFileSync(workflowPath, 'utf8');
    const workflow = JSON.parse(workflowContent);
    
    // Validate workflow structure
    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      console.error('❌ Invalid workflow structure: missing nodes array'); // eslint-disable-line no-console
      return false;
    }

    // Check for required nodes
    const nodeTypes = workflow.nodes.map((node: { type: string }) => node.type);
    
    const hasWebhook = nodeTypes.some((type: string) => type.includes('webhook'));
    const hasOllama = nodeTypes.some((type: string) => type.includes('ollama'));
    const hasCode = nodeTypes.some((type: string) => type.includes('code'));
    
    if (!hasWebhook || !hasOllama || !hasCode) {
      console.error('❌ Workflow missing required nodes:', { // eslint-disable-line no-console
        webhook: hasWebhook,
        ollama: hasOllama,
        code: hasCode
      });
      return false;
    }

    console.log('✅ Workflow file structure validated'); // eslint-disable-line no-console
    return true;
  } catch (error) {
    console.error('❌ Error parsing workflow file:', error); // eslint-disable-line no-console
    return false;
  }
}

async function runIntegrationTests(): Promise<void> {
  console.log('🧪 Running Ollama Integration Tests...\n'); // eslint-disable-line no-console

  try {
    // Run the specific test file
    const testCommand = 'npm run test -- src/__tests__/integration/ollama-document-extraction.test.tsx --reporter=verbose';
    
    console.log('Executing:', testCommand); // eslint-disable-line no-console
    
    const output = execSync(testCommand, {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
      stdio: 'pipe'
    });

    console.log(output); // eslint-disable-line no-console
    console.log('✅ Integration tests completed successfully'); // eslint-disable-line no-console
    
  } catch (error) {
    console.error('❌ Integration tests failed:'); // eslint-disable-line no-console
    if (error instanceof Error && 'stdout' in error) {
      console.error(error.stdout); // eslint-disable-line no-console
    }
    console.error(error); // eslint-disable-line no-console
    process.exit(1);
  }
}

async function main(): Promise<void> {
  console.log('🚀 Ollama Integration Test Setup\n'); // eslint-disable-line no-console
  
  // Step 1: Validate workflow file
  console.log('1. Validating N8N workflow file...'); // eslint-disable-line no-console
  if (!validateWorkflowFile()) {
    console.error('\n❌ Setup failed: Invalid workflow file'); // eslint-disable-line no-console
    process.exit(1);
  }
  
  // Step 2: Check N8N service
  console.log('\n2. Checking N8N service status...'); // eslint-disable-line no-console
  const n8nRunning = await checkN8NStatus();
  
  if (!n8nRunning) {
    console.warn('⚠️  N8N service not detected at', config.n8nUrl); // eslint-disable-line no-console
    console.warn('   Integration tests will run in mock mode'); // eslint-disable-line no-console
    console.warn('   To run full integration tests:'); // eslint-disable-line no-console
    console.warn('   1. Start Docker services: docker compose up -d'); // eslint-disable-line no-console
    console.warn('   2. Import workflow to N8N'); // eslint-disable-line no-console
    console.warn('   3. Re-run this script\n'); // eslint-disable-line no-console
  } else {
    console.log('✅ N8N service is running'); // eslint-disable-line no-console
    
    // Step 3: Check workflow deployment
    console.log('\n3. Checking workflow deployment...'); // eslint-disable-line no-console
    const workflowDeployed = await checkWorkflowDeployment();
    
    if (!workflowDeployed) {
      console.warn('⚠️  Document extraction webhook not found'); // eslint-disable-line no-console
      console.warn('   Please import the workflow:'); // eslint-disable-line no-console
      console.warn(`   - Open ${config.n8nUrl}`); // eslint-disable-line no-console
      console.warn(`   - Import: ${config.workflowFile}`); // eslint-disable-line no-console
      console.warn('   - Activate the workflow\n'); // eslint-disable-line no-console
    } else {
      console.log('✅ Document extraction workflow is deployed'); // eslint-disable-line no-console
    }
  }
  
  // Step 4: Run tests
  console.log('\n4. Running integration tests...'); // eslint-disable-line no-console
  await runIntegrationTests();
  
  console.log('\n🎉 All checks completed!'); // eslint-disable-line no-console
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error); // eslint-disable-line no-console
  process.exit(1);
});

// Run the main function
main().catch((error) => {
  console.error('❌ Setup failed:', error); // eslint-disable-line no-console
  process.exit(1);
}); 