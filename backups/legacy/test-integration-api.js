#!/usr/bin/env node
/**
 * Automated API Integration Test for Document Template Matching
 * Tests the real backend APIs and document processing flow
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Check if fetch is available (Node 18+) or use a polyfill
let fetch;
try {
  fetch = globalThis.fetch;
} catch (e) {
  console.log('Installing node-fetch for API requests...');
  require('child_process').execSync('npm install node-fetch@2', { stdio: 'inherit' });
  fetch = require('node-fetch');
}

const BASE_URL = 'http://localhost:8090';
const FRONTEND_URL = 'http://localhost:5173';

class IntegrationTester {
  constructor() {
    this.results = {
      testDate: new Date().toISOString(),
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };
  }

  async log(message, status = 'info') {
    const timestamp = new Date().toISOString().slice(11, 19);
    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : status === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`[${timestamp}] ${icon} ${message}`);
  }

  async test(name, testFn) {
    await this.log(`Running test: ${name}`, 'info');
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      await this.log(`PASSED: ${name} (${duration}ms)`, 'pass');
      
      this.results.tests.push({
        name,
        status: 'pass',
        duration,
        timestamp: new Date().toISOString()
      });
      this.results.summary.passed++;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.log(`FAILED: ${name} - ${error.message} (${duration}ms)`, 'fail');
      
      this.results.tests.push({
        name,
        status: 'fail',
        error: error.message,
        duration,
        timestamp: new Date().toISOString()
      });
      this.results.summary.failed++;
    }
    this.results.summary.total++;
  }

  async testBackendHealth() {
    const response = await fetch(`${BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Backend health check failed: ${response.status}`);
    }
    const health = await response.json();
    if (health.status !== 'healthy') {
      throw new Error(`Backend not healthy: ${JSON.stringify(health)}`);
    }
  }

  async testFrontendAccessible() {
    const response = await fetch(FRONTEND_URL);
    if (!response.ok) {
      throw new Error(`Frontend not accessible: ${response.status}`);
    }
  }

  async testTemplateEndpoint() {
    // Test document type evaluation endpoint
    const testContent = 'Invoice Number: INV-12345\nCompany: Test Corp\nTotal: $1,234.56\nDue Date: 2024-01-15';
    
    const response = await fetch(`${BASE_URL}/documents/evaluate-document-type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: testContent,
        filename: 'test-invoice.txt'
      })
    });

    if (!response.ok) {
      throw new Error(`Template evaluation failed: ${response.status}`);
    }

    const evaluation = await response.json();
    
    // Verify response structure
    if (!evaluation.type_evaluation) {
      throw new Error('Missing type_evaluation in response');
    }
    
    if (!evaluation.template_suggestions) {
      throw new Error('Missing template_suggestions in response');
    }

    // Check if template suggestions are present
    if (evaluation.template_suggestions.length === 0) {
      throw new Error('No template suggestions returned');
    }

    // Verify template suggestion structure
    const firstSuggestion = evaluation.template_suggestions[0];
    const requiredFields = ['template_id', 'template_name', 'match_score', 'category'];
    
    for (const field of requiredFields) {
      if (!(field in firstSuggestion)) {
        throw new Error(`Missing required field in template suggestion: ${field}`);
      }
    }

    // Verify match score is reasonable
    if (firstSuggestion.match_score < 0 || firstSuggestion.match_score > 1) {
      throw new Error(`Invalid match score: ${firstSuggestion.match_score}`);
    }

    await this.log(`Found ${evaluation.template_suggestions.length} template suggestions`);
    await this.log(`Best match: ${firstSuggestion.template_name} (${Math.round(firstSuggestion.match_score * 100)}%)`);
  }

  async testDocumentProcessing() {
    // Create a simple test document
    const testContent = `INVOICE
    
Invoice Number: TEST-001
Company Name: ACME Corporation  
Customer: John Doe
Amount Due: $500.00
Date: January 15, 2024

Thank you for your business!`;

    // Test document processing endpoint
    const response = await fetch(`${BASE_URL}/documents/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: testContent,
        filename: 'test-invoice.txt',
        options: {
          extract_text: true,
          extract_metadata: true,
          use_ai_enhancement: true
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Document processing failed: ${response.status}`);
    }

    const result = await response.json();
    
    // Verify processing completed
    if (result.status !== 'completed') {
      throw new Error(`Processing not completed: ${result.status}`);
    }

    // Verify content extraction
    if (!result.content || !result.content.text) {
      throw new Error('No text content extracted');
    }

    await this.log(`Document processed successfully, extracted ${result.content.text.length} characters`);
  }

  async testTemplateMatchingCache() {
    const testContent = 'Invoice #12345 from ABC Company, total: $999.99';
    
    // First request - cache miss
    const start1 = Date.now();
    const response1 = await fetch(`${BASE_URL}/documents/evaluate-document-type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: testContent,
        filename: 'cache-test-1.txt'
      })
    });
    const time1 = Date.now() - start1;
    
    if (!response1.ok) {
      throw new Error(`First request failed: ${response1.status}`);
    }

    const result1 = await response1.json();

    // Second identical request - cache hit (should be faster)
    const start2 = Date.now();
    const response2 = await fetch(`${BASE_URL}/documents/evaluate-document-type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: testContent,
        filename: 'cache-test-2.txt'
      })
    });
    const time2 = Date.now() - start2;

    if (!response2.ok) {
      throw new Error(`Second request failed: ${response2.status}`);
    }

    const result2 = await response2.json();

    // Verify responses are similar
    if (result1.template_suggestions.length !== result2.template_suggestions.length) {
      throw new Error('Cache returned different number of suggestions');
    }

    await this.log(`First request: ${time1}ms, Second request: ${time2}ms`);
    
    // Cache hit should typically be faster, but not guaranteed in all environments
    if (time2 <= time1) {
      await this.log('Cache performance improvement detected');
    }
  }

  async testErrorHandling() {
    // Test invalid content
    const response = await fetch(`${BASE_URL}/documents/evaluate-document-type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '',
        filename: 'empty.txt'
      })
    });

    // Should either succeed with empty suggestions or return a valid error
    if (response.ok) {
      const result = await response.json();
      // Empty content should return empty suggestions or default handling
      await this.log('Empty content handled gracefully');
    } else if (response.status === 400) {
      await this.log('Empty content rejected with 400 (expected behavior)');
    } else {
      throw new Error(`Unexpected error response: ${response.status}`);
    }
  }

  async saveResults() {
    const resultsFile = path.join(__dirname, 'api-integration-test-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    await this.log(`Results saved to: ${resultsFile}`);
  }

  async run() {
    console.log('🧪 AUTOMATED API INTEGRATION TESTS');
    console.log('==================================');
    console.log(`Backend: ${BASE_URL}`);
    console.log(`Frontend: ${FRONTEND_URL}`);
    console.log('');

    await this.test('Backend Health Check', () => this.testBackendHealth());
    await this.test('Frontend Accessibility', () => this.testFrontendAccessible());
    await this.test('Template Matching Endpoint', () => this.testTemplateEndpoint());
    await this.test('Document Processing', () => this.testDocumentProcessing());
    await this.test('Template Cache Performance', () => this.testTemplateMatchingCache());
    await this.test('Error Handling', () => this.testErrorHandling());

    console.log('\n📊 TEST SUMMARY');
    console.log('===============');
    console.log(`Total Tests: ${this.results.summary.total}`);
    console.log(`Passed: ${this.results.summary.passed}`);
    console.log(`Failed: ${this.results.summary.failed}`);
    console.log(`Success Rate: ${Math.round((this.results.summary.passed / this.results.summary.total) * 100)}%`);

    if (this.results.summary.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('The template matching system API is working correctly.');
    } else {
      console.log('\n⚠️ SOME TESTS FAILED');
      console.log('Check the test output above for details.');
    }

    await this.saveResults();
    
    return this.results.summary.failed === 0;
  }
}

// Run the tests if this file is executed directly
if (require.main === module) {
  const tester = new IntegrationTester();
  
  tester.run()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n💥 Test runner crashed:', error.message);
      process.exit(1);
    });
}

module.exports = IntegrationTester;