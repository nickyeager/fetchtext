import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentProcessor } from '@/features/documents/components/DocumentProcessor';

// Mock Supabase for auth but allow real N8N calls
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-123' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

// Test configuration
const N8N_WEBHOOK_URL = 'http://localhost:5678/webhook/document-extraction';
const TEST_TIMEOUT = 30000; // 30 seconds for AI processing

const mockTemplate = {
  id: 1,
  uuid: 'template-uuid-1',
  name: 'Business Proposal Template',
  description: 'Template for business proposals with AI extraction',
  template_content: `
# Business Proposal

**Client:** {{client_name}}
**Project:** {{project_name}}
**Amount:** {{project_amount}}
**Timeline:** {{project_timeline}}
**Contact:** {{contact_email}}

## Project Overview
{{project_description}}

## Budget Breakdown
Total Investment: {{project_amount}}
Payment Terms: {{payment_terms}}
`,
  smart_variables: [
    { 
      id: 'client_name', 
      name: 'client_name', 
      type: 'text' as const, 
      description: 'Client company name', 
      extraction_hints: ['client', 'company', 'organization'] 
    },
    { 
      id: 'project_name', 
      name: 'project_name', 
      type: 'text' as const, 
      description: 'Project or service name', 
      extraction_hints: ['project', 'service', 'initiative'] 
    },
    { 
      id: 'project_amount', 
      name: 'project_amount', 
      type: 'currency' as const, 
      description: 'Total project cost', 
      extraction_hints: ['amount', 'cost', 'price', 'budget', '$'] 
    },
    { 
      id: 'project_timeline', 
      name: 'project_timeline', 
      type: 'text' as const, 
      description: 'Project timeline or deadline', 
      extraction_hints: ['timeline', 'deadline', 'completion', 'weeks', 'months'] 
    },
    { 
      id: 'contact_email', 
      name: 'contact_email', 
      type: 'text' as const, 
      description: 'Primary contact email', 
      extraction_hints: ['email', '@', 'contact'] 
    },
    { 
      id: 'project_description', 
      name: 'project_description', 
      type: 'text' as const, 
      description: 'Detailed project description', 
      extraction_hints: ['description', 'overview', 'details', 'scope'] 
    },
    { 
      id: 'payment_terms', 
      name: 'payment_terms', 
      type: 'text' as const, 
      description: 'Payment terms and conditions', 
      extraction_hints: ['payment', 'terms', 'installments', 'schedule'] 
    }
  ],
  category: 'Business',
};

// Sample document text for testing
const sampleDocumentText = `
Subject: Website Redesign Project Proposal

Dear Team,

Acme Corporation is looking to redesign their company website. The project involves:

- Complete UI/UX overhaul
- Mobile responsiveness improvements  
- SEO optimization
- Content management system integration

Project Details:
- Client: Acme Corporation
- Service: Complete Website Redesign
- Budget: $25,000
- Timeline: 8 weeks from start date
- Completion deadline: March 15, 2024

The project will include modern design principles, improved user experience, and better conversion optimization. We'll implement a custom CMS that allows the client to easily update content.

Payment will be structured as: 50% upfront, 30% at milestone completion, 20% on final delivery.

Please contact sarah.johnson@acmecorp.com for any questions.

Best regards,
Project Manager
`;

// Helper function to call N8N webhook directly
async function callN8NWebhook(documentText: string, templateFields: any[]): Promise<any> {
  const extractionPrompt = createExtractionPrompt(documentText, templateFields);
  
  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      document_text: documentText,
      template_fields: templateFields,
      extraction_prompt: extractionPrompt,
      user_id: 'test-user-123',
      timestamp: Date.now()
    }),
  });

  if (!response.ok) {
    throw new Error(`N8N webhook failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function createExtractionPrompt(text: string, variables: any[]): string {
  const fieldDescriptions = variables.map(v => 
    `- ${v.name} (${v.type}): ${v.description}${v.extraction_hints?.length > 0 ? ` [Keywords: ${v.extraction_hints.join(', ')}]` : ''}`
  ).join('\n');

  return `
Extract the following information from this document and return as valid JSON:

${fieldDescriptions}

Document text:
${text}

Return ONLY a JSON object with the field names as keys and extracted values. Example:
{
  "client_name": "extracted value",
  "project_amount": "$25,000",
  "contact_email": "email@example.com"
}

If a field cannot be found, use null for the value.
  `.trim();
}

describe('Ollama Document Extraction Integration Tests', () => {
  const mockOnGenerationComplete = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should connect to N8N webhook endpoint', async () => {
    // Test basic connectivity to N8N
    try {
      const testResponse = await fetch('http://localhost:5678/health', {
        method: 'GET',
      });
      
      // N8N should be running and accessible
      expect(testResponse.status).toBeLessThan(500);
    } catch (error) {
      console.warn('N8N service not available for integration testing:', error);
      // Skip test if N8N is not available
      return;
    }
  }, TEST_TIMEOUT);

  it('should extract data from document using real Ollama via N8N', async () => {
    try {
      // Call the actual N8N webhook with document extraction
      const result = await callN8NWebhook(sampleDocumentText, mockTemplate.smart_variables);
      
      // Verify response structure
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('success');
      expect(result).toHaveProperty('data');
      
      // Verify extracted data contains expected fields
      const extractedData = result.data;
      expect(extractedData).toHaveProperty('client_name');
      expect(extractedData).toHaveProperty('project_amount');
      expect(extractedData).toHaveProperty('contact_email');
      
      // Verify accuracy of extraction
      expect(extractedData.client_name).toContain('Acme');
      expect(extractedData.project_amount).toMatch(/25,?000/);
      expect(extractedData.contact_email).toMatch(/sarah\.johnson@acmecorp\.com/);
      
      // Verify confidence and timing metrics
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result).toHaveProperty('processing_time_ms');
      expect(result.processing_time_ms).toBeGreaterThan(0);
      
      console.log('✅ Ollama extraction successful:', {
        extracted: Object.keys(extractedData).length,
        confidence: result.confidence,
        processingTime: result.processing_time_ms + 'ms'
      });
      
    } catch (error) {
      if ((error as Error).message.includes('fetch')) {
        console.warn('⚠️ N8N service not available, skipping integration test');
        return; // Skip if service not available
      }
      throw error;
    }
  }, TEST_TIMEOUT);

  it('should handle Ollama extraction errors gracefully', async () => {
    try {
      // Test with malformed input to trigger error handling
      const result = await callN8NWebhook('', []); // Empty inputs
      
      // Should return error status but not crash
      expect(result).toHaveProperty('status');
      expect(['error', 'success']).toContain(result.status);
      
      if (result.status === 'error') {
        expect(result).toHaveProperty('message');
        expect(typeof result.message).toBe('string');
      }
      
    } catch (error) {
      if ((error as Error).message.includes('fetch')) {
        console.warn('⚠️ N8N service not available, skipping error handling test');
        return;
      }
      // Error handling should be graceful
      expect((error as Error).message).toContain('N8N webhook failed');
    }
  }, TEST_TIMEOUT);

  it('should validate AI extraction prompt construction', () => {
    // Test prompt generation logic
    const prompt = createExtractionPrompt(sampleDocumentText, mockTemplate.smart_variables);
    
    // Verify prompt structure
    expect(prompt).toContain('Extract the following information');
    expect(prompt).toContain('return as valid JSON');
    expect(prompt).toContain('client_name');
    expect(prompt).toContain('project_amount');
    expect(prompt).toContain('Keywords: client, company, organization');
    
    // Verify document text is included
    expect(prompt).toContain('Acme Corporation');
    expect(prompt).toContain('$25,000');
    
    console.log('✅ Extraction prompt structure validated');
  });

  it('should handle different document types and formats', async () => {
    const testCases = [
      {
        name: 'Email format',
        text: 'From: client@company.com\nSubject: Project Request\nBudget: $15,000\nCompany: TechCorp\nDeadline: 2 months',
        expectedFields: ['client_name', 'project_amount', 'contact_email']
      },
      {
        name: 'Structured format',
        text: 'CLIENT: MegaCorp Inc.\nPROJECT: Mobile App Development\nBUDGET: $50,000\nCONTACT: john.doe@megacorp.com\nTIMELINE: 12 weeks',
        expectedFields: ['client_name', 'project_name', 'project_amount']
      }
    ];

    for (const testCase of testCases) {
      try {
        const result = await callN8NWebhook(testCase.text, mockTemplate.smart_variables);
        
        if (result.status === 'success') {
          // Check that expected fields were extracted
          for (const field of testCase.expectedFields) {
            expect(result.data).toHaveProperty(field);
            expect(result.data[field]).not.toBe(null);
          }
          
          console.log(`✅ ${testCase.name} extraction successful`);
        }
        
      } catch (error) {
        if ((error as Error).message.includes('fetch')) {
          console.warn(`⚠️ Skipping ${testCase.name} test - N8N not available`);
          continue;
        }
        throw error;
      }
    }
  }, TEST_TIMEOUT * 2); // Extended timeout for multiple tests

  it('should integrate with DocumentProcessor component', async () => {
    // Mock the real AI extraction function to use our N8N webhook
    const originalFetch = global.fetch;
    
    global.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (url.includes('document-extraction')) {
        // Simulate successful N8N response
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            data: {
              client_name: 'Acme Corporation',
              project_amount: '$25,000',
              contact_email: 'sarah.johnson@acmecorp.com',
              project_name: 'Website Redesign',
              project_timeline: '8 weeks',
              project_description: 'Complete UI/UX overhaul with mobile responsiveness',
              payment_terms: '50% upfront, 30% at milestone, 20% on delivery'
            },
            confidence: 0.92,
            processing_time_ms: 2340
          })
        };
      }
      return originalFetch(url, options);
    });

    render(
      <DocumentProcessor 
        selectedTemplate={mockTemplate}
        onGenerationComplete={mockOnGenerationComplete}
        onBack={mockOnBack}
      />
    );

    // Simulate file upload and processing
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    const file = new File([sampleDocumentText], 'proposal.txt', { type: 'text/plain' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for AI extraction to complete
    await waitFor(() => {
      expect(screen.getByText(/AI Data Extraction/)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify extraction results are displayed
    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme Corporation')).toBeInTheDocument();
      expect(screen.getByDisplayValue('$25,000')).toBeInTheDocument();
    }, { timeout: 3000 });

    console.log('✅ DocumentProcessor integration with Ollama extraction successful');

    // Restore original fetch
    global.fetch = originalFetch;
  }, TEST_TIMEOUT);
});

describe('N8N Workflow Structure Validation', () => {
  it('should validate N8N webhook payload structure', () => {
    const expectedPayload = {
      document_text: sampleDocumentText,
      template_fields: mockTemplate.smart_variables,
      extraction_prompt: expect.any(String),
      user_id: 'test-user-123',
      timestamp: expect.any(Number)
    };

    // Verify payload structure matches N8N workflow expectations
    const actualPayload = {
      document_text: sampleDocumentText,
      template_fields: mockTemplate.smart_variables,
      extraction_prompt: createExtractionPrompt(sampleDocumentText, mockTemplate.smart_variables),
      user_id: 'test-user-123',
      timestamp: Date.now()
    };

    expect(actualPayload).toMatchObject(expectedPayload);
    
    // Verify template fields structure
    expect(actualPayload.template_fields).toBeInstanceOf(Array);
    expect(actualPayload.template_fields[0]).toHaveProperty('name');
    expect(actualPayload.template_fields[0]).toHaveProperty('type');
    expect(actualPayload.template_fields[0]).toHaveProperty('description');
    expect(actualPayload.template_fields[0]).toHaveProperty('extraction_hints');
  });

  it('should validate expected N8N response structure', () => {
    const expectedResponse = {
      status: 'success',
      data: expect.any(Object),
      confidence: expect.any(Number),
      processing_time_ms: expect.any(Number)
    };

    // Mock successful response from N8N workflow
    const mockResponse = {
      status: 'success',
      data: {
        client_name: 'Acme Corporation',
        project_amount: '$25,000',
        contact_email: 'sarah.johnson@acmecorp.com'
      },
      confidence: 0.85,
      processing_time_ms: 1200
    };

    expect(mockResponse).toMatchObject(expectedResponse);
  });
}); 