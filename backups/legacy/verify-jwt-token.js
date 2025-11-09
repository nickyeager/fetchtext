#!/usr/bin/env node

// Decode JWT without verification to see payload
const jwt = require('jsonwebtoken');

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU1MjQ0NTIzLCJleHAiOjE3ODY3ODA1MjN9.h6VsUD-W6BuvpX5giP6Q-WSKrwQa6-2PPlAPFUzvtzU';
const JWT_SECRET = '21c893e8ce534c351c99f23cb65b80ee63a4374c2c40b4d1cfefb80c5bec7173';

console.log('🧪 JWT Token Analysis');
console.log('====================\n');

// Decode without verification to see structure
try {
  const decoded = jwt.decode(ANON_KEY, { complete: true });
  console.log('📋 Token Header:', decoded.header);
  console.log('📋 Token Payload:', decoded.payload);
  
  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  const exp = decoded.payload.exp;
  const isExpired = now > exp;
  
  console.log('\n⏰ Token Timing:');
  console.log('   Current time:', new Date(now * 1000).toISOString());
  console.log('   Token expires:', new Date(exp * 1000).toISOString());
  console.log('   Is expired?', isExpired ? '❌ YES' : '✅ NO');
  
} catch (error) {
  console.log('❌ Error decoding token:', error.message);
  process.exit(1);
}

// Verify signature
try {
  const verified = jwt.verify(ANON_KEY, JWT_SECRET);
  console.log('\n✅ Token signature is VALID');
  console.log('📋 Verified payload:', verified);
} catch (error) {
  console.log('\n❌ Token signature is INVALID:', error.message);
  
  if (error.name === 'TokenExpiredError') {
    console.log('   The token has expired');
  } else if (error.name === 'JsonWebTokenError') {
    console.log('   The token signature is invalid or the secret is wrong');
  }
}

console.log('\n🔍 Diagnosis:');
console.log('   Role in token:', jwt.decode(ANON_KEY).role);
console.log('   Issuer in token:', jwt.decode(ANON_KEY).iss);
console.log('   Expected for Supabase realtime: role="anon", iss="supabase"');