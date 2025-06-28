#!/usr/bin/env node

const https = require('https');
const http = require('http');

console.log('🔍 Testing Authentication Layer - Step by Step\n');

// Test 1: Check if Supabase Kong is accessible
function testSupabaseKong() {
  return new Promise((resolve) => {
    console.log('1️⃣ Testing Supabase Kong accessibility...');
    
    const req = http.request({
      hostname: 'localhost',
      port: 8000,
      path: '/health',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      console.log(`   ✅ Kong responding with status: ${res.statusCode}`);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`   📄 Response: ${data.slice(0, 100)}...`);
        resolve(true);
      });
    });
    
    req.on('error', (err) => {
      console.log(`   ❌ Kong not accessible: ${err.message}`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log('   ⏰ Kong request timed out');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Test 2: Check Supabase Auth endpoint
function testSupabaseAuth() {
  return new Promise((resolve) => {
    console.log('\n2️⃣ Testing Supabase Auth endpoint...');
    
    const req = http.request({
      hostname: 'localhost',
      port: 8000,
      path: '/auth/v1/health',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      console.log(`   ✅ Auth endpoint responding with status: ${res.statusCode}`);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`   📄 Response: ${data.slice(0, 200)}...`);
        resolve(true);
      });
    });
    
    req.on('error', (err) => {
      console.log(`   ❌ Auth endpoint not accessible: ${err.message}`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log('   ⏰ Auth request timed out');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Test 3: Check admin dashboard accessibility
function testAdminDashboard() {
  return new Promise((resolve) => {
    console.log('\n3️⃣ Testing Admin Dashboard accessibility...');
    
    const req = http.request({
      hostname: 'localhost',
      port: 5174,
      path: '/health',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      console.log(`   ✅ Dashboard responding with status: ${res.statusCode}`);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`   📄 Response: ${data.slice(0, 100)}...`);
        resolve(true);
      });
    });
    
    req.on('error', (err) => {
      console.log(`   ❌ Dashboard not accessible: ${err.message}`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log('   ⏰ Dashboard request timed out');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Test 4: Check Docker containers
function testDockerContainers() {
  return new Promise((resolve) => {
    console.log('\n4️⃣ Checking Docker containers...');
    
    const { exec } = require('child_process');
    exec('docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', (error, stdout, stderr) => {
      if (error) {
        console.log(`   ❌ Docker command failed: ${error.message}`);
        resolve(false);
        return;
      }
      
      console.log('   🐳 Running containers:');
      console.log(stdout);
      
      // Check for key containers
      const containers = stdout.toLowerCase();
      const keyContainers = ['supabase-kong', 'supabase-auth', 'localai-admin-dashboard'];
      const missingContainers = keyContainers.filter(name => !containers.includes(name));
      
      if (missingContainers.length > 0) {
        console.log(`   ⚠️  Missing containers: ${missingContainers.join(', ')}`);
      } else {
        console.log('   ✅ All key containers are running');
      }
      
      resolve(true);
    });
  });
}

// Test 5: Check environment variable configuration
function testEnvironmentConfig() {
  console.log('\n5️⃣ Checking environment configuration...');
  
  // Since we can't access .env directly, we'll check the docker-compose.yml build args
  const fs = require('fs');
  try {
    const dockerCompose = fs.readFileSync('../docker-compose.yml', 'utf8');
    
    console.log('   📋 Docker Compose build args for admin dashboard:');
    const dashboardSection = dockerCompose.match(/localai-admin-dashboard:[\s\S]*?(?=\n  [a-z]|\n[a-z]|$)/);
    if (dashboardSection) {
      const buildArgs = dashboardSection[0].match(/args:[\s\S]*?(?=\n    [a-z]|\n  [a-z]|$)/);
      if (buildArgs) {
        console.log(buildArgs[0]);
      }
    }
    
    // Check if ANON_KEY is referenced
    if (dockerCompose.includes('${ANON_KEY}')) {
      console.log('   ✅ ANON_KEY environment variable is referenced');
    } else {
      console.log('   ❌ ANON_KEY environment variable not found');
    }
    
    return true;
  } catch (err) {
    console.log(`   ❌ Could not read docker-compose.yml: ${err.message}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('Starting authentication layer tests...\n');
  
  const results = {
    kong: await testSupabaseKong(),
    auth: await testSupabaseAuth(),
    dashboard: await testAdminDashboard(),
    containers: await testDockerContainers(),
    config: testEnvironmentConfig()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('='.repeat(40));
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test.toUpperCase()}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests < totalTests) {
    console.log('\n🔧 Next Steps:');
    if (!results.containers) {
      console.log('   • Start Docker containers: docker compose up -d');
    }
    if (!results.kong) {
      console.log('   • Check Supabase Kong container logs: docker logs supabase-kong');
    }
    if (!results.auth) {
      console.log('   • Check Supabase Auth container logs: docker logs supabase-auth');
    }
    if (!results.dashboard) {
      console.log('   • Check Admin Dashboard container logs: docker logs localai-admin-dashboard');
    }
    if (!results.config) {
      console.log('   • Verify environment variables are properly set');
    }
  }
}

// Run the tests
runTests().catch(console.error); 