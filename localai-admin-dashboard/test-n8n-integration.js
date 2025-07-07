const { emailClient } = require('./src/lib/email-client.ts');

async function testN8NIntegration() {
  console.log('🧪 Testing N8N Email Integration...\n');

  try {
    // Test 1: Password Reset Email
    console.log('1. Testing Password Reset Email...');
    const resetResult = await emailClient.sendPasswordResetEmail('test@example.com', 'test-token-123');
    console.log('Result:', resetResult);
    console.log('');

    // Test 2: Welcome Email
    console.log('2. Testing Welcome Email...');
    const welcomeResult = await emailClient.sendWelcomeEmail('newuser@example.com', 'John Doe');
    console.log('Result:', welcomeResult);
    console.log('');

    // Test 3: Two-Factor Email
    console.log('3. Testing Two-Factor Email...');
    const twoFactorResult = await emailClient.sendTwoFactorEmail('user@example.com', '123456');
    console.log('Result:', twoFactorResult);
    console.log('');

    // Test 4: Generic Email
    console.log('4. Testing Generic Email...');
    const genericResult = await emailClient.sendGenericEmail({
      to: 'generic@example.com',
      subject: 'Test Subject',
      html: '<h1>Test HTML Email</h1>',
      templateType: 'password-reset',
      variables: {
        customVar: 'test-value'
      }
    });
    console.log('Result:', genericResult);
    console.log('');

    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testN8NIntegration(); 