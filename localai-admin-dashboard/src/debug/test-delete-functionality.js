/**
 * Debug script to test document delete functionality
 * Run this in the browser console on the document gallery page
 */

console.log('=== Document Delete Functionality Debug ===');

// Check if we're on the document gallery page
if (!window.location.pathname.includes('/documents')) {
  console.error('Please navigate to the document gallery page first');
} else {
  console.log('✅ On document gallery page');
}

// Check if React DevTools are available
if (typeof window.React === 'undefined') {
  console.warn('React DevTools not available - checking for React in other ways');
}

// Test delete button presence
const deleteButtons = document.querySelectorAll('[title="Delete document"], button[aria-label*="delete" i]');
console.log(`Found ${deleteButtons.length} delete buttons on page`);

if (deleteButtons.length === 0) {
  console.warn('No delete buttons found. Documents might not be loaded yet.');
  
  // Check for document cards
  const documentCards = document.querySelectorAll('[class*="group hover:shadow-lg"]');
  console.log(`Found ${documentCards.length} document cards`);
  
  if (documentCards.length === 0) {
    console.error('No document cards found - data might not be loaded');
  }
}

// Check Supabase client
if (typeof window.supabase !== 'undefined') {
  console.log('✅ Supabase client is available');
} else {
  console.log('ℹ️ Supabase client not available globally (normal for production)');
}

// Check for error notifications
const errorElements = document.querySelectorAll('[role="alert"], .sonner-toast');
console.log(`Found ${errorElements.length} notification elements`);

// Instructions for manual testing
console.log('\n=== Manual Testing Instructions ===');
console.log('1. Hover over a document card to see delete buttons');
console.log('2. Click the trash icon to trigger delete');
console.log('3. Confirm deletion in the dialog');
console.log('4. Check browser network tab for API calls');
console.log('5. Watch console for debug messages from our fixes');
console.log('\n=== Expected Debug Messages ===');
console.log('- "DocumentCard action triggered for document: [id] [name]"');
console.log('- "Starting delete operation for document: [object]"');
console.log('- "Document realtime change received: [payload]"');
console.log('- "Delete operation completed successfully"');