#!/usr/bin/env node

const net = require('net');
const crypto = require('crypto');

function generateWebSocketKey() {
  return crypto.randomBytes(16).toString('base64');
}

async function testSimpleWebSocket() {
  return new Promise((resolve) => {
    console.log(`🔗 Testing simple WebSocket connection without authentication...`);
    
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
      
      const request = [
        `GET /realtime/v1/socket/websocket HTTP/1.1`,
        `Host: localhost:8000`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Key: ${wsKey}`,
        `Sec-WebSocket-Version: 13`,
        ``, ``
      ].join('\r\n');
      
      socket.write(request);
    });
    
    let responseData = '';
    socket.on('data', (data) => {
      responseData += data.toString();
      
      if (responseData.includes('\r\n\r\n')) {
        const lines = responseData.split('\r\n');
        const statusLine = lines[0];
        console.log(`📈 Response: ${statusLine}`);
        
        // Print all response headers
        for (let i = 1; i < lines.length && lines[i] !== ''; i++) {
          console.log(`   ${lines[i]}`);
        }
        
        const statusMatch = statusLine.match(/HTTP\/1\.\d (\d+)/);
        const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0;
        
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.destroy();
          resolve({ success: statusCode === 101, statusCode, response: statusLine });
        }
      }
    });
    
    socket.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.log(`❌ ERROR: ${error.message}`);
        resolve({ success: false, error: error.message });
      }
    });
  });
}

async function testWithQueryParams() {
  return new Promise((resolve) => {
    console.log(`\n🔗 Testing WebSocket with query parameters...`);
    
    const socket = net.createConnection(8000, 'localhost');
    const wsKey = generateWebSocketKey();
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU1MjQ0NTIzLCJleHAiOjE3ODY3ODA1MjN9.h6VsUD-W6BuvpX5giP6Q-WSKrwQa6-2PPlAPFUzvtzU';
    
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
      console.log(`📡 TCP connected, sending WebSocket handshake with auth...`);
      
      const query = `apikey=${ANON_KEY}&vsn=1.0.0`;
      const request = [
        `GET /realtime/v1/socket/websocket?${query} HTTP/1.1`,
        `Host: localhost:8000`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Key: ${wsKey}`,
        `Sec-WebSocket-Version: 13`,
        `Authorization: Bearer ${ANON_KEY}`,
        ``, ``
      ].join('\r\n');
      
      socket.write(request);
    });
    
    let responseData = '';
    socket.on('data', (data) => {
      responseData += data.toString();
      
      if (responseData.includes('\r\n\r\n')) {
        const lines = responseData.split('\r\n');
        const statusLine = lines[0];
        console.log(`📈 Response: ${statusLine}`);
        
        for (let i = 1; i < lines.length && lines[i] !== ''; i++) {
          console.log(`   ${lines[i]}`);
        }
        
        const statusMatch = statusLine.match(/HTTP\/1\.\d (\d+)/);
        const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0;
        
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.destroy();
          resolve({ success: statusCode === 101, statusCode, response: statusLine });
        }
      }
    });
    
    socket.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.log(`❌ ERROR: ${error.message}`);
        resolve({ success: false, error: error.message });
      }
    });
  });
}

async function main() {
  console.log('🚀 Testing WebSocket Authentication Patterns...\n');
  
  const result1 = await testSimpleWebSocket();
  const result2 = await testWithQueryParams();
  
  console.log('\n📊 RESULTS:');
  console.log('===========');
  console.log(`No auth: ${result1.success ? '✅' : '❌'} (${result1.statusCode || result1.error})`);
  console.log(`With auth: ${result2.success ? '✅' : '❌'} (${result2.statusCode || result2.error})`);
  
  if (result1.success || result2.success) {
    console.log('\n✅ Found working WebSocket endpoint!');
    const working = result1.success ? result1 : result2;
    console.log(`🎉 Status: ${working.statusCode} - ${working.response}`);
    process.exit(0);
  } else {
    console.log('\n❌ No working WebSocket configurations found.');
    console.log('The realtime service may not be properly configured for WebSocket connections.');
    process.exit(1);
  }
}

main().catch(console.error);