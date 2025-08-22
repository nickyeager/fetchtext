#!/usr/bin/env node

const net = require('net');
const crypto = require('crypto');

const JWT_SECRET = '21c893e8ce534c351c99f23cb65b80ee63a4374c2c40b4d1cfefb80c5bec7173';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU1MjQ0NTIzLCJleHAiOjE3ODY3ODA1MjN9.h6VsUD-W6BuvpX5giP6Q-WSKrwQa6-2PPlAPFUzvtzU';

function generateWebSocketKey() {
  return crypto.randomBytes(16).toString('base64');
}

async function testWebSocketWithTenant(tenantId) {
  return new Promise((resolve) => {
    console.log(`🔗 Testing WebSocket with tenant: ${tenantId}`);
    
    const socket = net.createConnection(8000, 'localhost');
    const wsKey = generateWebSocketKey();
    
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log(`❌ TIMEOUT`);
        socket.destroy();
        resolve({ success: false, error: 'Timeout' });
      }
    }, 5000);
    
    socket.on('connect', () => {
      console.log(`📡 TCP connected, sending WebSocket handshake...`);
      
      // Try different parameter patterns that Supabase might expect
      const queryParams = [
        `apikey=${ANON_KEY}`,
        `vsn=1.0.0`,
        `token=${ANON_KEY}`,
        tenantId ? `tenant=${tenantId}` : null
      ].filter(Boolean).join('&');
      
      const request = [
        `GET /realtime/v1/socket/websocket?${queryParams} HTTP/1.1`,
        `Host: localhost:8000`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Key: ${wsKey}`,
        `Sec-WebSocket-Version: 13`,
        `Authorization: Bearer ${ANON_KEY}`,
        tenantId ? `X-Tenant-Id: ${tenantId}` : null,
        `Origin: http://localhost:5174`,
        ``, ``
      ].filter(Boolean).join('\r\n');
      
      socket.write(request);
    });
    
    let responseData = '';
    socket.on('data', (data) => {
      responseData += data.toString();
      
      if (responseData.includes('\r\n\r\n')) {
        const lines = responseData.split('\r\n');
        const statusLine = lines[0];
        console.log(`📈 Response: ${statusLine}`);
        
        // Show headers for debugging
        for (let i = 1; i < lines.length && lines[i] !== '' && i < 10; i++) {
          console.log(`   ${lines[i]}`);
        }
        
        const statusMatch = statusLine.match(/HTTP\/1\.\d (\d+)/);
        const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0;
        
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.destroy();
          resolve({ success: statusCode === 101, statusCode, tenantId });
        }
      }
    });
    
    socket.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.log(`❌ ERROR: ${error.message}`);
        resolve({ success: false, error: error.message, tenantId });
      }
    });
  });
}

async function main() {
  console.log('🚀 Testing WebSocket with Different Tenant Configurations...\n');
  
  const tenantsToTry = [
    null, // No tenant
    'supabase-realtime', // From database
    'aba09a41-bd53-488d-9a0d-fec27f7d72b0', // UUID from database
    'default',
    'public',
    'localhost'
  ];
  
  const results = [];
  
  for (const tenant of tenantsToTry) {
    const result = await testWebSocketWithTenant(tenant);
    results.push(result);
    
    if (result.success) {
      console.log(`\n🎉 SUCCESS! Working tenant configuration found.`);
      break;
    }
    
    console.log(''); // Add spacing between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 TENANT TEST RESULTS:');
  console.log('========================');
  
  results.forEach((result) => {
    const tenantLabel = result.tenantId || 'No tenant';
    const status = result.success ? '✅' : '❌';
    const code = result.statusCode || result.error;
    console.log(`${status} ${tenantLabel}: ${code}`);
  });
  
  const successful = results.find(r => r.success);
  
  if (successful) {
    console.log(`\n✅ WEBSOCKET TEST PASSED!`);
    console.log(`🏆 Working tenant: ${successful.tenantId || 'No tenant required'}`);
    
    const tenantParam = successful.tenantId ? `&tenant=${successful.tenantId}` : '';
    console.log(`🔗 WebSocket URL: ws://localhost:8000/realtime/v1/socket/websocket?apikey=${ANON_KEY}&vsn=1.0.0${tenantParam}`);
    process.exit(0);
  } else {
    console.log(`\n❌ WEBSOCKET TEST FAILED!`);
    console.log('None of the tenant configurations worked.');
    
    // Additional debugging: check if realtime service is healthy
    console.log('\nℹ️  The realtime service might need additional configuration or restart.');
    process.exit(1);
  }
}

main().catch(console.error);