const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 5679;

// Middleware
app.use(cors());
app.use(express.json());

// Mock N8N webhook endpoints
app.post('/webhook/password-reset-email', (req, res) => {
  console.log('📧 Password Reset Email Webhook Called');
  console.log('Payload:', JSON.stringify(req.body, null, 2));
  
  const { to, messageHTML, resetUrl, fromEmail, fromName } = req.body;
  
  if (!to || !messageHTML) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: to, messageHTML'
    });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email address format'
    });
  }
  
  // Save HTML to file for preview (development only)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `password-reset-${timestamp}.html`;
  const htmlPath = path.join(__dirname, 'email-previews', filename);
  
  // Ensure directory exists
  const dir = path.dirname(htmlPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Create complete HTML document
  const completeHTML = `${messageHTML}
<div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
  <p>📧 Email sent from: ${fromName} &lt;${fromEmail}&gt; to ${to}</p>
  <p>🔗 Reset URL: <a href="${resetUrl}" style="color: #007bff;">${resetUrl}</a></p>
  <p>⏰ Generated: ${new Date().toLocaleString()}</p>
</div>`;
  
  fs.writeFileSync(htmlPath, completeHTML);
  
  console.log(`✅ Email HTML preview saved: ${htmlPath}`);
  console.log(`📧 From: ${fromName} <${fromEmail}>`);
  console.log(`📧 To: ${to}`);
  console.log(`🔗 Reset URL: ${resetUrl}`);
  
  // Mock successful email sending
  res.json({
    success: true,
    message: 'Password reset email sent successfully',
    messageId: `mock-${Date.now()}`,
    timestamp: new Date().toISOString(),
    previewPath: htmlPath
  });
});

app.post('/webhook/welcome-email', (req, res) => {
  console.log('📧 Welcome Email Webhook Called');
  console.log('Payload:', JSON.stringify(req.body, null, 2));
  
  const { to, messageHTML, userName, dashboardUrl, fromEmail, fromName } = req.body;
  
  if (!to || !messageHTML) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: to, messageHTML'
    });
  }
  
  // Save HTML to file for preview
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `welcome-${timestamp}.html`;
  const htmlPath = path.join(__dirname, 'email-previews', filename);
  
  // Ensure directory exists
  const dir = path.dirname(htmlPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Create complete HTML document
  const completeHTML = `${messageHTML}
<div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
  <p>📧 Email sent from: ${fromName} &lt;${fromEmail}&gt; to ${to}</p>
  <p>👤 User: ${userName}</p>
  <p>🏠 Dashboard: <a href="${dashboardUrl}" style="color: #007bff;">${dashboardUrl}</a></p>
  <p>⏰ Generated: ${new Date().toLocaleString()}</p>
</div>`;
  
  fs.writeFileSync(htmlPath, completeHTML);
  
  console.log(`✅ Email HTML preview saved: ${htmlPath}`);
  console.log(`📧 From: ${fromName} <${fromEmail}>`);
  console.log(`📧 To: ${to}`);
  console.log(`🏠 Dashboard URL: ${dashboardUrl}`);
  
  res.json({
    success: true,
    message: 'Welcome email sent successfully',
    messageId: `mock-${Date.now()}`,
    timestamp: new Date().toISOString(),
    previewPath: htmlPath
  });
});

app.post('/webhook/two-factor-email', (req, res) => {
  console.log('📧 Two-Factor Email Webhook Called');
  console.log('Payload:', JSON.stringify(req.body, null, 2));
  
  const { to, messageHTML, code, fromEmail, fromName } = req.body;
  
  if (!to || !messageHTML) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: to, messageHTML'
    });
  }
  
  // Save HTML to file for preview
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `two-factor-${timestamp}.html`;
  const htmlPath = path.join(__dirname, 'email-previews', filename);
  
  // Ensure directory exists
  const dir = path.dirname(htmlPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Create complete HTML document
  const completeHTML = `${messageHTML}
<div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
  <p>📧 Email sent from: ${fromName} &lt;${fromEmail}&gt; to ${to}</p>
  <p>🔐 Verification Code: <strong style="color: #007bff;">${code}</strong></p>
  <p>⏰ Generated: ${new Date().toLocaleString()}</p>
</div>`;
  
  fs.writeFileSync(htmlPath, completeHTML);
  
  console.log(`✅ Email HTML preview saved: ${htmlPath}`);
  console.log(`📧 From: ${fromName} <${fromEmail}>`);
  console.log(`📧 To: ${to}`);
  console.log(`🔐 Code: ${code}`);
  
  res.json({
    success: true,
    message: 'Two-factor email sent successfully',
    messageId: `mock-${Date.now()}`,
    timestamp: new Date().toISOString(),
    previewPath: htmlPath
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Mock N8N Webhook Server',
    timestamp: new Date().toISOString()
  });
});

// List email previews endpoint
app.get('/email-previews', (req, res) => {
  const previewsDir = path.join(__dirname, 'email-previews');
  
  if (!fs.existsSync(previewsDir)) {
    return res.json({ previews: [] });
  }
  
  const files = fs.readdirSync(previewsDir)
    .filter(file => file.endsWith('.html'))
    .map(file => ({
      filename: file,
      created: fs.statSync(path.join(previewsDir, file)).birthtime,
      url: `/preview/${file}`
    }))
    .sort((a, b) => b.created - a.created);
  
  res.json({ previews: files });
});

// Serve email preview files
app.get('/preview/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'email-previews', filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Preview not found');
  }
  
  res.sendFile(filePath);
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Mock N8N Webhook Server running on http://localhost:${port}`);
  console.log(`📧 Email endpoints:`);
  console.log(`   • Password Reset: POST /webhook/password-reset-email`);
  console.log(`   • Welcome: POST /webhook/welcome-email`);
  console.log(`   • Two-Factor: POST /webhook/two-factor-email`);
  console.log(`📁 Email previews: GET /email-previews`);
  console.log(`🏥 Health check: GET /health`);
  console.log('');
  console.log('📝 All emails will be saved as HTML files in ./email-previews/');
  console.log('🌐 Access previews at: http://localhost:5679/preview/[filename]');
}); 