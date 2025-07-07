const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mock N8N webhook endpoints
app.post('/webhook/password-reset-email', (req, res) => {
  const { to, resetToken, resetUrl, messageHTML, fromEmail, fromName } = req.body;
  
  console.log('📧 Password Reset Email Request:');
  console.log('  To:', to);
  console.log('  Reset Token:', resetToken);
  console.log('  Reset URL:', resetUrl);
  console.log('  From:', fromName, '<' + fromEmail + '>');
  console.log('  Message HTML:', messageHTML ? 'Included' : 'Not included');
  console.log('  Timestamp:', new Date().toISOString());
  
  // Simulate N8N response
  res.json({
    success: true,
    message: 'Password reset email sent successfully',
    messageId: `n8n-${Date.now()}`,
    timestamp: new Date().toISOString()
  });
});

app.post('/webhook/welcome-email', (req, res) => {
  const { to, userName, dashboardUrl, messageHTML, fromEmail, fromName } = req.body;
  
  console.log('🎉 Welcome Email Request:');
  console.log('  To:', to);
  console.log('  User Name:', userName);
  console.log('  Dashboard URL:', dashboardUrl);
  console.log('  From:', fromName, '<' + fromEmail + '>');
  console.log('  Message HTML:', messageHTML ? 'Included' : 'Not included');
  console.log('  Timestamp:', new Date().toISOString());
  
  res.json({
    success: true,
    message: 'Welcome email sent successfully',
    messageId: `n8n-${Date.now()}`,
    timestamp: new Date().toISOString()
  });
});

app.post('/webhook/two-factor-email', (req, res) => {
  const { to, code, messageHTML, fromEmail, fromName } = req.body;
  
  console.log('🔐 Two-Factor Email Request:');
  console.log('  To:', to);
  console.log('  Code:', code);
  console.log('  From:', fromName, '<' + fromEmail + '>');
  console.log('  Message HTML:', messageHTML ? 'Included' : 'Not included');
  console.log('  Timestamp:', new Date().toISOString());
  
  res.json({
    success: true,
    message: 'Two-factor code sent successfully',
    messageId: `n8n-${Date.now()}`,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'Mock N8N Email Service',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = 5678;
app.listen(PORT, () => {
  console.log('🚀 Mock N8N Email Service running on port', PORT);
  console.log('📧 Available endpoints:');
  console.log('  - POST /webhook/password-reset-email');
  console.log('  - POST /webhook/welcome-email');
  console.log('  - POST /webhook/two-factor-email');
  console.log('  - GET /health');
  console.log('');
  console.log('🔗 Test with: curl http://localhost:5678/health');
}); 