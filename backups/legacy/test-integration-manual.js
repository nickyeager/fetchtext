#!/usr/bin/env node
/**
 * Manual Integration Test Script for Document Template Matching
 * Tests the real running application end-to-end
 */

const fs = require('fs');
const path = require('path');

console.log('📋 MANUAL INTEGRATION TEST CHECKLIST');
console.log('=====================================');
console.log('Use this checklist to test the document template matching system');
console.log('');

const testChecklist = [
  {
    category: 'Setup & Prerequisites',
    items: [
      'Services are running (start_services.py)',
      'Frontend is accessible at http://localhost:5173',
      'Backend is accessible at http://localhost:8090',
      'Supabase is running at http://localhost:8000',
      'Test documents are available (invoices, receipts, contracts)'
    ]
  },
  {
    category: 'Document Upload Flow',
    items: [
      'Navigate to http://localhost:5173/documents/gallery',
      'Click "Upload Document" or drag-drop a test PDF',
      'Verify file uploads successfully',
      'Document appears in gallery with "analyzing" status',
      'Document card shows processing indicator'
    ]
  },
  {
    category: 'Document Analysis Phase',
    items: [
      'Click on uploaded document to open detail view',
      'Verify URL is /documents/{id}',
      'See "Analyzing Document" progress indicator',
      'Wait 10-30 seconds for analysis to complete',
      'Progress indicator disappears automatically',
      'Document status changes from "analyzing" to "completed"'
    ]
  },
  {
    category: 'Template Suggestions Display',
    items: [
      'Template Selector component appears after analysis',
      'See "Recommended" template with highest match score',
      'Match scores shown as percentages (e.g., "87% match")',
      'Template categories displayed (finance, retail, legal)',
      'Field counts shown for each template',
      'All suggestions list shows multiple template options'
    ]
  },
  {
    category: 'Template Selection - Auto Select',
    items: [
      'Click "Use Best" button for recommended template',
      'Loading state shown during template application',
      'Success toast notification appears',
      'Document status updates to show selected template',
      'Template name badge appears in header',
      'Field extraction begins automatically'
    ]
  },
  {
    category: 'Template Selection - Manual',
    items: [
      'Open "Choose Manually" dropdown',
      'See all available template options',
      'Select a different template from dropdown',
      'Click "Apply Template" button',
      'Template is applied and extraction starts',
      'Verify user override is tracked'
    ]
  },
  {
    category: 'Extracted Fields Display',
    items: [
      'Extracted fields section appears',
      'Field names and values displayed',
      'Confidence scores shown for each field',
      'Template name shown in "Template Used" section',
      'Processing time displayed',
      'Success/failure status indicated'
    ]
  },
  {
    category: 'Real-time Updates',
    items: [
      'Page auto-refreshes every 1 second during processing',
      'Status updates appear without manual refresh',
      'Progress indicators update automatically',
      'Polling stops when document is completed'
    ]
  },
  {
    category: 'Error Scenarios',
    items: [
      'Upload invalid file type (should show error)',
      'Upload corrupted PDF (should handle gracefully)',
      'Test with no template matches (should show message)',
      'Test with network disconnected (should show fallback)'
    ]
  },
  {
    category: 'Performance Testing',
    items: [
      'Upload 3-5 documents simultaneously',
      'Verify all process without blocking each other',
      'Template suggestions appear within 30 seconds',
      'System remains responsive during processing',
      'Check browser network tab for API call efficiency'
    ]
  }
];

// Create test results file
const testResults = {
  testDate: new Date().toISOString(),
  checklist: testChecklist.map(category => ({
    ...category,
    items: category.items.map(item => ({
      description: item,
      status: 'pending', // pending, pass, fail
      notes: ''
    }))
  }))
};

const resultsFile = path.join(__dirname, 'integration-test-results.json');
fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));

console.log('TEST CATEGORIES:');
console.log('================');

testChecklist.forEach((category, categoryIndex) => {
  console.log(`\n${categoryIndex + 1}. ${category.category}`);
  console.log('-'.repeat(category.category.length + 3));
  
  category.items.forEach((item, itemIndex) => {
    console.log(`   ${String.fromCharCode(97 + itemIndex)}. [ ] ${item}`);
  });
});

console.log('\n');
console.log('📝 TESTING INSTRUCTIONS:');
console.log('========================');
console.log('1. Start the services: python start_services.py --profile cpu');
console.log('2. Open browser to http://localhost:5173/documents/gallery');
console.log('3. Go through each checklist item systematically');
console.log('4. Mark items as [✓] pass, [✗] fail, or [~] partial');
console.log('5. Record any issues or unexpected behavior');
console.log('');
console.log('📊 EXPECTED RESULTS:');
console.log('===================');
console.log('✓ Document uploads successfully');
console.log('✓ Analysis completes within 30 seconds');  
console.log('✓ Template suggestions appear with match scores');
console.log('✓ Template selection works (both auto and manual)');
console.log('✓ Field extraction shows results with confidence');
console.log('✓ Real-time updates work without manual refresh');
console.log('✓ Error cases handled gracefully');
console.log('');
console.log('🚨 FAILURE CRITERIA:');
console.log('====================');
console.log('✗ Document stuck in "analyzing" state > 60 seconds');
console.log('✗ Template suggestions never appear');
console.log('✗ Template selection buttons don\'t work');
console.log('✗ Status updates require manual page refresh');
console.log('✗ System crashes or becomes unresponsive');
console.log('');
console.log('📁 RESULTS FILE: integration-test-results.json');
console.log('Edit this file to record your test results.');
console.log('');

// Sample test documents info
console.log('📄 SAMPLE TEST DOCUMENTS:');
console.log('=========================');
console.log('Use these document types for comprehensive testing:');
console.log('');
console.log('Invoice Documents (should match finance templates):');
console.log('  • Business invoices with clear invoice numbers');
console.log('  • Should get 80%+ match scores');
console.log('  • Expected fields: invoice_number, company_name, total_amount');
console.log('');
console.log('Receipt Documents (should match retail templates):');
console.log('  • Store receipts with purchase details');
console.log('  • Should get 70%+ match scores');
console.log('  • Expected fields: receipt_number, store_name, total_amount');
console.log('');
console.log('Contract Documents (should match legal templates):');
console.log('  • Service agreements or contracts');
console.log('  • May get 60%+ match scores (more complex)');
console.log('  • Expected fields: contract_number, client_name, contract_date');
console.log('');

console.log('🚀 START TESTING NOW!');
console.log('Navigate to: http://localhost:5173/documents/gallery');