// Quick test to verify 406 fix
import { templateService } from './src/services/template-service.ts';

console.log('Testing template service with invalid ID...');

// Mock the authentication
const mockAuth = {
  getUser: () => Promise.resolve({ data: { user: { id: 'test-user' } } })
};

// Test calling getTemplate with ID 0 (should return null, not throw 406)
async function test406Fix() {
  try {
    console.log('Calling getTemplate(0)...');
    // This would previously throw a 406 error, now should return null
    const result = await templateService.getTemplate(0);
    console.log('✅ Success! Got result:', result);
    console.log('✅ 406 fix is working - no error thrown');
  } catch (error) {
    console.log('❌ Error occurred:', error.message);
    console.log('❌ 406 fix may not be working');
  }
}

test406Fix();
