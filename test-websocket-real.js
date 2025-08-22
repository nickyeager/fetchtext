#!/usr/bin/env node

const net = require('net');
const crypto = require('crypto');

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU1MjQ0NTIzLCJleHAiOjE3ODY3ODA1MjN9.h6VsUD-W6BuvpX5giP6Q-WSKrwQa6-2PPlAPFUzvtzU';

const endpoints = [
  '/realtime/v1/socket/websocket',
  '/realtime/v1/websocket', 
  '/realtime/v1/socket',
  '/socket/websocket'
];

function generateWebSocketKey() {
  return crypto.randomBytes(16).toString('base64');
}

async function testRealWebSocket(path) {
  return new Promise((resolve) => {
    console.log(`\n🔗 Testing REAL WebSocket connection to: ws://localhost:8000${path}`);
    
    const wsKey = generateWebSocketKey();
    const query = `apikey=${ANON_KEY}&eventsPerSecond=10&vsn=1.0.0`;
    
    const socket = net.createConnection(8000, 'localhost');
    
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log(`❌ TIMEOUT: Connection timed out after 10 seconds`);
        socket.destroy();
        resolve({ success: false, error: 'Timeout' });
      }
    }, 10000);
    
    socket.on('connect', () => {
      console.log(`📡 TCP connection established, sending WebSocket handshake...`);
      
      // Send WebSocket handshake
      const request = [
        `GET ${path}?${query} HTTP/1.1`,
        `Host: localhost:8000`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Key: ${wsKey}`,
        `Sec-WebSocket-Version: 13`,
        `Sec-WebSocket-Protocol: phoenix`,
        `Origin: http://localhost:5174`,
        `User-Agent: NodeJS-WebSocket-Test`,
        ``, ``
      ].join('\r\n');
      
      socket.write(request);
    });
    
    let responseData = '';
    socket.on('data', (data) => {
      responseData += data.toString();
      
      // Check if we have complete HTTP response
      if (responseData.includes('\r\n\r\n')) {
        const lines = responseData.split('\r\n');
        const statusLine = lines[0];
        console.log(`📈 Response: ${statusLine}`);
        
        // Parse status code
        const statusMatch = statusLine.match(/HTTP\/1\.\d (\d+)/);
        const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0;
        
        // Print response headers
        console.log(`📋 Response headers:`);
        for (let i = 1; i < lines.length && lines[i] !== ''; i++) {
          console.log(`   ${lines[i]}`);
        }
        
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          
          if (statusCode === 101) {
            console.log(`✅ SUCCESS: WebSocket handshake completed!`);
            
            // Try sending a Phoenix message
            const joinMessage = JSON.stringify({
              topic: 'realtime:public:documents',
              event: 'phx_join',
              payload: {},
              ref: '1'
            });
            
            // Send as WebSocket frame (simplified - just send as text frame)
            const frame = Buffer.concat([
              Buffer.from([0x81]), // FIN=1, opcode=1 (text)
              Buffer.from([joinMessage.length]), // payload length (assuming < 126)
              Buffer.from(joinMessage)
            ]);
            
            socket.write(frame);
            
            // Wait a bit for response
            setTimeout(() => {
              socket.destroy();
              resolve({ success: true, path, statusCode });
            }, 2000);
            
          } else {
            console.log(`❌ FAILED: Expected 101, got ${statusCode}`);
            socket.destroy();
            resolve({ success: false, error: `Status ${statusCode}`, path });
          }
        }
      }
    });
    
    socket.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.log(`❌ ERROR: ${error.message}`);
        resolve({ success: false, error: error.message, path });
      }
    });
    
    socket.on('close', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.log(`❌ CLOSED: Connection closed unexpectedly`);
        resolve({ success: false, error: 'Connection closed', path });
      }
    });
  });
}

async function runRealWebSocketTests() {
  console.log('🚀 Testing REAL WebSocket Connections to Supabase Realtime...\n');
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testRealWebSocket(endpoint);
    results.push(result);
    
    if (result.success) {
      console.log(`\n🎉 WORKING WEBSOCKET FOUND: ${result.path}`);
      break;
    }
    
    // Add delay between attempts
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 WEBSOCKET TEST RESULTS:');
  console.log('===========================');
  
  const workingEndpoints = results.filter(r => r.success);
  const failedEndpoints = results.filter(r => !r.success);
  
  workingEndpoints.forEach((result) => {
    console.log(`✅ ${result.path} - WebSocket connection successful!`);
  });
  
  failedEndpoints.forEach((result) => {
    console.log(`❌ ${result.path} - Error: ${result.error}`);
  });
  
  if (workingEndpoints.length > 0) {
    const bestEndpoint = workingEndpoints[0];
    console.log(`\n✅ WEBSOCKET TEST PASSED!`);
    console.log(`🏆 WORKING WEBSOCKET ENDPOINT: ws://localhost:8000${bestEndpoint.path}`);
    console.log(`\n🔧 UPDATE SUPABASE CONFIG TO USE:`);
    console.log(`   endpoint: 'ws://localhost:8000${bestEndpoint.path}'`);
    process.exit(0);
  } else {
    console.log(`\n❌ WEBSOCKET TEST FAILED! No working WebSocket endpoints found.`);
    
    // Let's also test if the realtime service is responding at all
    console.log('\n🔍 Debugging: Testing if realtime service is accessible...');
    const debugResult = await testRealWebSocket('/realtime/v1');
    
    process.exit(1);
  }
}

// Run the test
runRealWebSocketTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});