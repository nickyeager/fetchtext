#!/usr/bin/env node

const http = require('http');
const https = require('https');

// Test configuration
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU1MjQ0NTIzLCJleHAiOjE3ODY3ODA1MjN9.h6VsUD-W6BuvpX5giP6Q-WSKrwQa6-2PPlAPFUzvtzU';

const endpoints = [
  'http://localhost:8000/realtime/v1/websocket',
  'http://localhost:8000/realtime/v1/socket/websocket', 
  'http://localhost:8000/realtime/v1/socket',
  'http://localhost:8000/socket/websocket',
  'http://localhost:8000/realtime/v1',
];

async function testEndpoint(url) {
  return new Promise((resolve) => {
    console.log(`\n🔗 Testing HTTP endpoint: ${url}`);
    
    const fullUrl = `${url}?apikey=${ANON_KEY}&eventsPerSecond=10&vsn=1.0.0`;
    
    // Try to upgrade to WebSocket
    const options = {
      method: 'GET',
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Protocol': 'phoenix'
      },
      timeout: 5000
    };
    
    const req = http.request(fullUrl, options, (res) => {
      console.log(`📈 Status: ${res.statusCode} ${res.statusMessage}`);
      console.log(`📋 Headers:`, res.headers);
      
      // Check if this is a successful WebSocket upgrade
      if (res.statusCode === 101 && res.headers.upgrade === 'websocket') {
        console.log(`✅ SUCCESS: WebSocket upgrade successful!`);
        resolve({ success: true, url, status: res.statusCode });
      } 
      // 400 is also acceptable for WebSocket endpoints (means the endpoint exists but HTTP request is invalid)
      else if (res.statusCode === 400) {
        console.log(`✅ PARTIAL SUCCESS: Endpoint exists (400 is expected for WebSocket endpoints via HTTP)`);
        resolve({ success: true, url, status: res.statusCode, note: 'WebSocket endpoint found (400 expected)' });
      }
      else if (res.statusCode === 200) {
        console.log(`✅ SUCCESS: HTTP endpoint responding (200 OK)`);
        resolve({ success: true, url, status: res.statusCode, note: 'HTTP endpoint working' });
      }
      else {
        console.log(`❌ FAILED: Unexpected status ${res.statusCode}`);
        resolve({ success: false, error: `Status ${res.statusCode}`, url });
      }
    });
    
    req.on('error', (error) => {
      console.log(`❌ ERROR: ${error.message}`);
      resolve({ success: false, error: error.message, url });
    });
    
    req.on('timeout', () => {
      console.log(`❌ TIMEOUT: Request timed out after 5 seconds`);
      req.destroy();
      resolve({ success: false, error: 'Timeout', url });
    });
    
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Testing Supabase Realtime Endpoints...\n');
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📊 RESULTS SUMMARY:');
  console.log('==================');
  
  const workingEndpoints = results.filter(r => r.success);
  
  workingEndpoints.forEach((result, index) => {
    console.log(`✅ ${result.url} - Status: ${result.status}${result.note ? ' (' + result.note + ')' : ''}`);
  });
  
  const failedEndpoints = results.filter(r => !r.success);
  failedEndpoints.forEach((result, index) => {
    console.log(`❌ ${result.url} - Error: ${result.error}`);
  });
  
  if (workingEndpoints.length > 0) {
    console.log(`\n✅ TEST PASSED! Found ${workingEndpoints.length} working endpoint(s)`);
    
    // Find the best endpoint (WebSocket upgrade > 400 > 200)
    const wsUpgrade = workingEndpoints.find(r => r.status === 101);
    const wsEndpoint = workingEndpoints.find(r => r.status === 400);
    const httpEndpoint = workingEndpoints.find(r => r.status === 200);
    
    const bestEndpoint = wsUpgrade || wsEndpoint || httpEndpoint;
    console.log(`🏆 RECOMMENDED ENDPOINT: ${bestEndpoint.url}`);
    
    if (wsEndpoint || wsUpgrade) {
      const wsUrl = bestEndpoint.url.replace('http://', 'ws://').replace('https://', 'wss://');
      console.log(`🔗 WebSocket URL to use: ${wsUrl}`);
    }
    
    process.exit(0);
  } else {
    console.log(`\n❌ TEST FAILED! No working endpoints found.`);
    process.exit(1);
  }
}

// Run the test
runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});