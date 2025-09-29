#!/usr/bin/env node

const net = require('net');
const crypto = require('crypto');

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU1MjQ0NTIzLCJleHAiOjE3ODY3ODA1MjN9.h6VsUD-W6BuvpX5giP6Q-WSKrwQa6-2PPlAPFUzvtzU';

function generateWebSocketKey() {
  return crypto.randomBytes(16).toString('base64');
}

async function testWebSocketConnection() {
  return new Promise((resolve) => {
    console.log(`🔗 Testing WebSocket connection to realtime service...`);
    
    const socket = net.createConnection(8000, 'localhost');
    const wsKey = generateWebSocketKey();
    
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log(`❌ TIMEOUT after 10 seconds`);
        socket.destroy();
        resolve({ success: false, error: 'Timeout' });
      }
    }, 10000);
    
    socket.on('connect', () => {
      console.log(`📡 TCP connected successfully`);
      console.log(`🔑 Using JWT: ${ANON_KEY.substring(0, 50)}...`);
      console.log(`🔐 WebSocket Key: ${wsKey}`);
      
      const query = `apikey=${ANON_KEY}&vsn=1.0.0`;
      const request = [
        `GET /realtime/v1/socket/websocket?${query} HTTP/1.1`,
        `Host: localhost:8000`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Key: ${wsKey}`,
        `Sec-WebSocket-Version: 13`,
        `Sec-WebSocket-Protocol: phoenix`,
        `Origin: http://localhost:5174`,
        `User-Agent: Supabase-JS-Test`,
        ``, ``
      ].join('\r\n');
      
      console.log(`📤 Sending WebSocket handshake request...`);
      socket.write(request);
    });
    
    let responseData = '';
    socket.on('data', (data) => {
      responseData += data.toString();
      
      // Check if we have the complete HTTP response
      if (responseData.includes('\r\n\r\n')) {
        const lines = responseData.split('\r\n');
        const statusLine = lines[0];
        
        console.log(`📥 Response received:`);
        console.log(`📈 Status: ${statusLine}`);
        
        // Show relevant headers
        console.log(`📋 Headers:`);
        for (let i = 1; i < lines.length && lines[i] !== '' && i < 15; i++) {
          console.log(`   ${lines[i]}`);
        }
        
        const statusMatch = statusLine.match(/HTTP\/1\.\d (\d+)/);
        const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0;
        
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          
          if (statusCode === 101) {
            console.log(`\n✅ SUCCESS! WebSocket handshake completed (HTTP 101 Switching Protocols)`);
            console.log(`🎉 WebSocket connection established!`);
            
            // Send a simple ping to test the connection
            setTimeout(() => {
              console.log(`📨 Sending test message...`);
              const testMessage = JSON.stringify({
                topic: 'realtime:public:test',
                event: 'phx_join',
                payload: {},
                ref: '1'
              });
              
              // Create a simple text frame (opcode 1)
              const frame = Buffer.concat([
                Buffer.from([0x81]), // FIN=1, opcode=1 (text frame)
                Buffer.from([testMessage.length]), // payload length
                Buffer.from(testMessage)
              ]);
              
              socket.write(frame);
              
              setTimeout(() => {
                socket.destroy();
                resolve({ success: true, statusCode: 101 });
              }, 2000);
            }, 1000);
            
          } else {
            console.log(`\n❌ FAILED: Expected HTTP 101, got ${statusCode}`);
            socket.destroy();
            resolve({ success: false, statusCode, error: `HTTP ${statusCode}` });
          }
        }
      }
    });
    
    socket.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.log(`❌ Socket Error: ${error.message}`);
        resolve({ success: false, error: error.message });
      }
    });
    
    socket.on('close', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.log(`❌ Connection closed unexpectedly`);
        resolve({ success: false, error: 'Connection closed' });
      }
    });
  });
}

async function main() {
  console.log('🚀 FINAL WEBSOCKET TEST\n');
  console.log('=======================\n');
  
  const result = await testWebSocketConnection();
  
  console.log('\n📊 FINAL RESULT:');
  console.log('=================');
  
  if (result.success) {
    console.log('✅ WEBSOCKET CONNECTION TEST PASSED!');
    console.log('🎯 The WebSocket endpoint is working correctly.');
    console.log('🔗 Working WebSocket URL: ws://localhost:8000/realtime/v1/socket/websocket');
    console.log('\n🔧 UPDATE YOUR SUPABASE CLIENT CONFIGURATION:');
    console.log('   Remove the custom endpoint configuration or set it to:');
    console.log(`   endpoint: 'ws://localhost:8000/realtime/v1/socket/websocket'`);
    console.log('\n✅ WEBSOCKET TEST COMPLETED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.log('❌ WEBSOCKET CONNECTION TEST FAILED!');
    console.log(`🚫 Error: ${result.error || result.statusCode}`);
    console.log('\n🔍 The realtime service is running but WebSocket connections are not working.');
    console.log('💡 This may require additional Supabase realtime service configuration.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Test error:', error);
  process.exit(1);
});