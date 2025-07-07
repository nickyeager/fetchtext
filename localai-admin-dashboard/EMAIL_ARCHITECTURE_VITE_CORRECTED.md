# Email Service Architecture: Supabase Edge Functions vs Express.js API Server

## 🏗️ Architecture Options Comparison (Corrected for Vite + React)

### **Option A: Supabase Edge Functions** (Current Approach)
```
Vite React App → Supabase Edge Function → SendGrid API
```

### **Option B: Express.js API Server** (Recommended Alternative)
```
Vite React App → Express.js API → SendGrid API
```

### **Option C: Vite Backend Integration** (Alternative)
```
Vite React App → Vite Plugin API → SendGrid API
```

## ⚖️ Detailed Comparison for Your Stack

### **🚀 Supabase Edge Functions**

#### ✅ **Pros:**
- **Serverless & Auto-scaling**: No infrastructure management
- **Global Distribution**: Edge computing with low latency
- **Integrated with Supabase**: Works well with your existing Supabase setup
- **Cost Efficient**: Pay-per-request model

#### ❌ **Cons:**
- **Deployment Friction**: Must redeploy to Supabase for changes
- **Local Development**: Harder to test locally with Vite dev server
- **Debugging Difficulty**: Less control over the execution environment

---

### **🖥️ Express.js API Server** (RECOMMENDED)

#### ✅ **Pros:**
- **Already Available**: Express is in your dependencies
- **Fast Development**: Instant local testing with Vite proxy
- **Familiar Environment**: Standard Node.js development
- **Easy Debugging**: Full control and logging
- **Vite Integration**: Can run alongside Vite dev server
- **Hot Reload**: Changes instantly reflected

#### ❌ **Cons:**
- **Additional Server**: Need to run both Vite and Express in development
- **Deployment Complexity**: Need to deploy both frontend and backend
- **Scaling**: Manual scaling considerations

---

### **🔧 Vite Backend Integration**

#### ✅ **Pros:**
- **Single Server**: Everything runs in Vite dev server
- **Seamless Development**: No additional setup needed
- **Hot Reload**: Instant changes

#### ❌ **Cons:**
- **Limited Functionality**: Vite isn't designed for backend APIs
- **Production Deployment**: Complex production setup
- **Less Mature**: Fewer examples and best practices

## 🎯 Recommendation: **Express.js API Server**

**Perfect for your Vite + React setup because:**

1. **You already have Express**: It's in your package.json
2. **Vite Proxy Support**: Seamless development experience
3. **Familiar Stack**: Standard Node.js development
4. **Easy Testing**: Local API endpoints for development

## 🛠️ Implementation: Express.js API Server

### **1. Project Structure**
```
localai-admin-dashboard/
├── src/                          # Vite React app
├── server/                       # Express API server
│   ├── index.js                 # Express server entry
│   ├── routes/
│   │   └── email.js             # Email API routes
│   ├── middleware/
│   │   ├── auth.js              # Authentication middleware
│   │   └── rateLimit.js         # Rate limiting
│   └── services/
│       └── emailService.js      # SendGrid integration
├── package.json
└── vite.config.ts               # With proxy configuration
```

### **2. Express Server Setup** (`server/index.js`)
```javascript
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import emailRoutes from './routes/email.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/email', emailRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🚀 Email API server running on http://localhost:${PORT}`)
})
```

### **3. Email Service** (`server/services/emailService.js`)
```javascript
import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export const emailTemplates = {
  'password-reset': (resetUrl) => `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Reset Your FetchText Password</title>
        <!-- Your existing template from src/lib/email-client.ts -->
    </head>
    <body>
        <!-- Professional FetchText email template -->
    </body>
    </html>
  `,
  
  'welcome': (userName) => `
    <!-- Welcome email template -->
  `,
  
  'two-factor': (code) => `
    <!-- 2FA email template -->
  `
}

export async function sendEmail({ to, subject, template, data }) {
  try {
    const html = emailTemplates[template]?.(data) || data.html
    
    const msg = {
      to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'yeag123@gmail.com',
        name: process.env.SENDGRID_FROM_NAME || 'FetchText'
      },
      subject,
      html
    }

    const response = await sgMail.send(msg)
    
    return {
      success: true,
      messageId: response[0].headers['x-message-id'] || `sg-${Date.now()}`,
      template
    }
  } catch (error) {
    console.error('SendGrid error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
```

### **4. Email API Routes** (`server/routes/email.js`)
```javascript
import express from 'express'
import { sendEmail } from '../services/emailService.js'
import { validateEmail, checkRateLimit } from '../middleware/rateLimit.js'

const router = express.Router()

// Password reset endpoint
router.post('/send-password-reset', async (req, res) => {
  try {
    const { email, resetToken } = req.body

    // Validation
    if (!email || !resetToken) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: email, resetToken' 
      })
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email format' 
      })
    }

    // Rate limiting
    if (!checkRateLimit(req, email)) {
      return res.status(429).json({ 
        success: false,
        error: 'Rate limit exceeded' 
      })
    }

    // Generate reset URL
    const resetUrl = `${process.env.VITE_APP_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`

    // Send email
    const result = await sendEmail({
      to: email,
      subject: 'Reset Your FetchText Password',
      template: 'password-reset',
      data: resetUrl
    })

    res.json(result)
  } catch (error) {
    console.error('Password reset error:', error)
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    })
  }
})

// Welcome email endpoint
router.post('/send-welcome', async (req, res) => {
  const { email, userName } = req.body
  
  const result = await sendEmail({
    to: email,
    subject: 'Welcome to FetchText!',
    template: 'welcome',
    data: userName
  })
  
  res.json(result)
})

export default router
```

### **5. Vite Proxy Configuration** (`vite.config.ts`)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [react(), TanStackRouterVite()],
  server: {
    proxy: {
      // Proxy API requests to Express server
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
```

### **6. Updated Frontend Email Client** (`src/lib/email-client.ts`)
```typescript
// Update your existing email client to use local API
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
): Promise<EmailResult> {
  // In development, use local API
  if (import.meta.env.DEV) {
    try {
      const response = await fetch('/api/email/send-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, resetToken }),
      })

      const result = await response.json()
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      }
    }
  }

  // In production, fall back to Supabase Edge Functions or keep local API
  // ... existing Supabase logic
}
```

### **7. Development Scripts** (Update `package.json`)
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "node server/index.js",
    "dev:client": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

## 🚀 Quick Start Guide

### **1. Install Dependencies**
```bash
npm install concurrently
```

### **2. Create Environment Variables** (`.env`)
```env
SENDGRID_API_KEY=SG.your-api-key
SENDGRID_FROM_EMAIL=yeag123@gmail.com
SENDGRID_FROM_NAME=FetchText
VITE_APP_URL=http://localhost:5173
```

### **3. Run Development Servers**
```bash
npm run dev
```

This starts both:
- Express API server on `http://localhost:3001`
- Vite React app on `http://localhost:5173`

### **4. Test the Integration**
- Visit `http://localhost:5173/forgot-password`
- Enter an email and submit
- Check server logs for email sending confirmation

## 📊 Benefits of This Approach

| Benefit | Description |
|---------|-------------|
| **🔥 Hot Reload** | Both frontend and backend changes instantly reflected |
| **🐛 Easy Debugging** | Full access to server logs and breakpoints |
| **⚡ Fast Iteration** | No deployment friction during development |
| **🔧 Familiar Stack** | Standard Express.js + Vite development |
| **📦 Single Codebase** | Everything in one repository |
| **🚀 Production Ready** | Easy to deploy to any Node.js hosting |

## 🎯 Production Deployment

For production, you can:
1. **Keep Express API**: Deploy both Vite build + Express to same server
2. **Migrate to Edge Functions**: Move to Supabase when ready for scale
3. **Hybrid Approach**: Use Express for development, Edge Functions for production

**Recommendation**: Start with Express for development velocity, then evaluate migration needs based on scale requirements. 