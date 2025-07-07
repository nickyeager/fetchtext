#!/usr/bin/env node

/**
 * Debug N8N Email Validation
 * Tests different email formats to identify validation issues
 */

const http = require('http');

console.log('🔍 Debugging N8N Email Validation');
console.log('==================================\n');

/**
 * Test N8N webhook with different email formats
 */
function testEmail(emailData, testName) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(emailData);
    
    const options = {
      hostname: 'localhost',
      port: 5678,
      path: '/webhook/password-reset-email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    console.log(`🧪 ${testName}`);
    console.log('Data sent:', emailData);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log(`Status: ${res.statusCode}`);
          console.log(`Response:`, jsonData);
          console.log('---\n');
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          console.log(`Status: ${res.statusCode}`);
          console.log(`Response:`, data);
          console.log('---\n');
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request Error:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Run validation tests
 */
async function runValidationTests() {
  const tests = [
    {
      name: 'Test 1: Valid Gmail',
      data: {
        email: 'yeag123@gmail.com',
        resetUrl: 'https://fetchtext.com/reset-password?token=test1'
      }
    },
    {
      name: 'Test 2: Valid Email with Subject',
      data: {
        email: 'yeag123@gmail.com',
        resetUrl: 'https://fetchtext.com/reset-password?token=test2',
        subject: 'Test Subject'
      }
    },
    {
      name: 'Test 3: Different Valid Email',
      data: {
        email: 'test@example.com',
        resetUrl: 'https://fetchtext.com/reset-password?token=test3'
      }
    },
    {
      name: 'Test 4: Email with Plus Sign',
      data: {
        email: 'test+tag@example.com',
        resetUrl: 'https://fetchtext.com/reset-password?token=test4'
      }
    },
    {
      name: 'Test 5: Invalid Email (should fail)',
      data: {
        email: 'invalid-email',
        resetUrl: 'https://fetchtext.com/reset-password?token=test5'
      }
    },
    {
      name: 'Test 6: Missing Email (should fail)',
      data: {
        resetUrl: 'https://fetchtext.com/reset-password?token=test6'
      }
    }
  ];

  for (const test of tests) {
    try {
      await testEmail(test.data, test.name);
      // Wait 1 second between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`❌ ${test.name} failed:`, error.message);
    }
  }

  console.log('\n🎯 Debug Summary');
  console.log('================');
  console.log('If valid emails are returning "Invalid email address":');
  console.log('');
  console.log('1. Check N8N Workflow → IF node (Email Validation)');
  console.log('2. The regex should be: ^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$');
  console.log('3. The condition should check: {{$json.body.email}}');
  console.log('4. Make sure the field name is exactly "email"');
  console.log('');
  console.log('📋 N8N Workflow Fix Instructions:');
  console.log('1. Open N8N UI: http://localhost:5678');
  console.log('2. Edit your password reset workflow');
  console.log('3. Click on the "Validate Email" IF node');
  console.log('4. Check the condition configuration:');
  console.log('   - Value 1: {{$json.body.email}}');
  console.log('   - Operation: Regex');
  console.log('   - Value 2: ^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$');
  console.log('5. Save and test again');
}

runValidationTests().catch(console.error); 