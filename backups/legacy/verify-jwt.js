#!/usr/bin/env node

const crypto = require('crypto');

const JWT_SECRET = '21c893e8ce534c351c99f23cb65b80ee63a4374c2c40b4d1cfefb80c5bec7173';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU1MjQ0NTIzLCJleHAiOjE3ODY3ODA1MjN9.h6VsUD-W6BuvpX5giP6Q-WSKrwQa6-2PPlAPFUzvtzU';

function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid JWT format' };
  }
  
  const [header, payload, signature] = parts;
  
  // Decode header and payload
  const decodedHeader = JSON.parse(Buffer.from(header, 'base64url').toString());
  const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
  
  // Verify signature
  const data = `${header}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64url');
  
  const isValid = signature === expectedSignature;
  
  return {
    valid: isValid,
    header: decodedHeader,
    payload: decodedPayload,
    signature: signature,
    expectedSignature: expectedSignature,
    match: signature === expectedSignature
  };
}

console.log('🔐 Verifying JWT Token...\n');

const result = verifyJWT(ANON_KEY, JWT_SECRET);

console.log('📋 JWT Verification Result:');
console.log('============================');
console.log(`Valid: ${result.valid ? '✅' : '❌'}`);
console.log(`Algorithm: ${result.header?.alg}`);
console.log(`Type: ${result.header?.typ}`);
console.log(`Role: ${result.payload?.role}`);
console.log(`Issuer: ${result.payload?.iss}`);
console.log(`Issued At: ${new Date(result.payload?.iat * 1000).toISOString()}`);
console.log(`Expires At: ${new Date(result.payload?.exp * 1000).toISOString()}`);
console.log(`Signature Match: ${result.match ? '✅' : '❌'}`);

if (!result.valid) {
  console.log('\n❌ JWT SIGNATURE VERIFICATION FAILED!');
  console.log('This explains why realtime service returns 403 Forbidden.');
  console.log(`Expected signature: ${result.expectedSignature}`);
  console.log(`Actual signature:   ${result.signature}`);
  process.exit(1);
} else {
  console.log('\n✅ JWT SIGNATURE VERIFICATION PASSED!');
  console.log('The issue is likely with tenant configuration or WebSocket endpoint.');
  process.exit(0);
}