// Debug script to test document deletion
// Run this in browser console at http://localhost:5173/documents/gallery

console.log('🔍 Delete Debug Helper Loaded');

// Helper function to test delete functionality
window.debugDelete = {
  // Check current documents in the gallery
  checkDocuments: () => {
    const documentsText = document.body.innerText;
    console.log('📋 Page content search for documents:', {
      hasDocuments: documentsText.includes('document'),
      hasGallery: documentsText.includes('gallery') || documentsText.includes('Gallery'),
      hasDeleteButtons: document.querySelectorAll('[title*="Delete"]').length > 0,
      totalButtons: document.querySelectorAll('button').length,
      deleteButtons: Array.from(document.querySelectorAll('button')).filter(btn => 
        btn.textContent.toLowerCase().includes('delete') || 
        btn.getAttribute('title')?.toLowerCase().includes('delete')
      ).length
    });
  },

  // Look for delete buttons
  findDeleteButtons: () => {
    const deleteButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
      const text = btn.textContent.toLowerCase();
      const title = btn.getAttribute('title')?.toLowerCase() || '';
      const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
      return text.includes('delete') || title.includes('delete') || ariaLabel.includes('delete');
    });
    
    console.log('🗑️ Found delete buttons:', deleteButtons.length);
    deleteButtons.forEach((btn, index) => {
      console.log(`Button ${index + 1}:`, {
        text: btn.textContent,
        title: btn.getAttribute('title'),
        classList: Array.from(btn.classList),
        visible: btn.offsetParent !== null,
        disabled: btn.disabled
      });
    });
    
    return deleteButtons;
  },

  // Look for document cards
  findDocumentCards: () => {
    const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="Card"]'));
    console.log('📄 Found potential document cards:', cards.length);
    
    cards.forEach((card, index) => {
      const hasDeleteButton = card.querySelector('button[title*="Delete"], button[title*="delete"]');
      console.log(`Card ${index + 1}:`, {
        hasText: card.textContent.length > 0,
        hasDeleteButton: hasDeleteButton !== null,
        classList: Array.from(card.classList),
        textPreview: card.textContent.substring(0, 100)
      });
    });
    
    return cards;
  },

  // Monitor network requests
  monitorNetworkRequests: () => {
    console.log('🌐 Starting network request monitoring...');
    
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const [url, options] = args;
      if (options?.method === 'DELETE' || url.toString().includes('delete')) {
        console.log('🔥 DELETE request detected:', {
          url: url.toString(),
          method: options?.method,
          options
        });
      }
      return originalFetch.apply(this, args);
    };
    
    // Monitor console for our debug messages
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = function(...args) {
      if (args[0]?.includes('🗑️') || args[0]?.includes('Delete') || args[0]?.includes('delete')) {
        originalLog.apply(console, ['🔍 DELETE DEBUG:', ...args]);
      } else {
        originalLog.apply(console, args);
      }
    };
  },

  // Test delete on first available document
  testDelete: () => {
    const deleteButtons = debugDelete.findDeleteButtons();
    if (deleteButtons.length > 0) {
      console.log('🧪 Attempting to click first delete button...');
      deleteButtons[0].click();
    } else {
      console.log('❌ No delete buttons found to test');
    }
  },

  // Run full diagnostic
  runDiagnostic: () => {
    console.log('🚀 Running full delete functionality diagnostic...');
    console.log('='.repeat(50));
    
    debugDelete.checkDocuments();
    debugDelete.findDocumentCards();
    debugDelete.findDeleteButtons();
    debugDelete.monitorNetworkRequests();
    
    console.log('✅ Diagnostic complete. Try interacting with delete buttons.');
    console.log('🔍 Watch for network requests and console messages.');
  }
};

// Auto-run diagnostic
debugDelete.runDiagnostic();

console.log(`
🎯 Debug Helper Commands:
- debugDelete.runDiagnostic() - Run full diagnostic
- debugDelete.checkDocuments() - Check for documents on page
- debugDelete.findDeleteButtons() - Find all delete buttons
- debugDelete.findDocumentCards() - Find document cards
- debugDelete.testDelete() - Try clicking first delete button
- debugDelete.monitorNetworkRequests() - Monitor delete requests
`);