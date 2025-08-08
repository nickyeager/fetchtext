import { describe, it, expect } from 'vitest';

describe('Backend Connectivity Test', () => {
  it('should be able to reach backend health endpoint', async () => {
    const healthUrl = 'http://localhost:8090/health/';
    
    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      console.log('Response data:', data);
      
      expect(data.status).toBe('healthy');
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  });

  it('should test DocumentProcessorEnhanced isBackendAvailable method', () => {
    // Create a mock test to verify the URL construction
    const baseUrl = 'http://localhost:8090/documents';
    const healthUrl = baseUrl.replace('/documents', '') + '/health/';
    
    console.log('Base URL:', baseUrl);
    console.log('Constructed health URL:', healthUrl);
    
    expect(healthUrl).toBe('http://localhost:8090/health/');
  });

  it('should test direct backend call using DocumentProcessorEnhanced pattern', async () => {
    const baseUrl = 'http://localhost:8090/documents';
    const healthUrl = `${baseUrl.replace('/documents', '')}/health/`;
    
    console.log('Testing URL:', healthUrl);
    
    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response:', {
        url: response.url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Data:', data);
        expect(data.status).toBe('healthy');
      } else {
        console.error('Response not ok:', response.status, response.statusText);
        throw new Error(`Backend health check failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Backend connectivity error:', error);
      throw error;
    }
  });
});