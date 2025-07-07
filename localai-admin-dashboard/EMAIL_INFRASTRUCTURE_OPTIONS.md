# Email Handling with Existing Infrastructure

## 🎯 **Available Options (No New Server Required!)**

Your `local-ai-packaged` setup already has **4 excellent options** for email handling:

### **Option 1: N8N Workflows** ⭐ **RECOMMENDED**
### **Option 2: Document Processor Extension** ⭐ **FASTEST TO IMPLEMENT**
### **Option 3: Supabase Edge Functions** 
### **Option 4: Direct Frontend Integration**

---

## 🚀 **Option 1: N8N Email Workflows** (RECOMMENDED)

**Why Perfect for You:**
- ✅ **Already Running**: N8N is in your docker-compose.yml
- ✅ **Visual Workflow**: No coding required for email logic
- ✅ **Built-in SendGrid**: Native SendGrid integration
- ✅ **Webhook Triggers**: Easy frontend integration
- ✅ **Error Handling**: Built-in retry and error handling
- ✅ **No Server Setup**: Uses existing N8N container

### **Architecture:**
```
Vite React App → HTTP Request → N8N Webhook → SendGrid → Email Sent
```

### **Implementation Steps:**

#### **1. Create N8N Email Workflow**
Access N8N at `http://localhost:5678` and create:

```json
{
  "name": "FetchText Email Service",
  "nodes": [
    {
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "position": [240, 300],
      "parameters": {
        "path": "send-email",
        "httpMethod": "POST"
      }
    },
    {
      "name": "Email Template Logic",
      "type": "n8n-nodes-base.function",
      "position": [460, 300],
      "parameters": {
        "functionCode": "// Extract email data\nconst { to, template, data } = $json.body;\n\n// Generate HTML based on template\nlet html = '';\nlet subject = '';\n\nswitch(template) {\n  case 'password-reset':\n    subject = 'Reset Your FetchText Password';\n    html = `\n      <!DOCTYPE html>\n      <html>\n      <head><title>Reset Password</title></head>\n      <body>\n        <h1>Reset Your FetchText Password</h1>\n        <p>Click the link below to reset your password:</p>\n        <a href=\"${data.resetUrl}\">Reset Password</a>\n        <p>This link expires in 24 hours.</p>\n      </body>\n      </html>\n    `;\n    break;\n    \n  case 'welcome':\n    subject = 'Welcome to FetchText!';\n    html = `\n      <!DOCTYPE html>\n      <html>\n      <head><title>Welcome</title></head>\n      <body>\n        <h1>Welcome to FetchText, ${data.userName}!</h1>\n        <p>Thank you for joining us!</p>\n      </body>\n      </html>\n    `;\n    break;\n}\n\nreturn {\n  to,\n  subject,\n  html\n};"
      }
    },
    {
      "name": "SendGrid",
      "type": "n8n-nodes-base.sendGrid",
      "position": [680, 300],
      "parameters": {
        "apiKey": "={{$env.SENDGRID_API_KEY}}",
        "fromEmail": "yeag123@gmail.com",
        "fromName": "FetchText",
        "toEmail": "={{$json.to}}",
        "subject": "={{$json.subject}}",
        "html": "={{$json.html}}"
      }
    }
  ],
  "connections": {
    "Webhook Trigger": {
      "main": [
        [
          {
            "node": "Email Template Logic",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Email Template Logic": {
      "main": [
        [
          {
            "node": "SendGrid",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

#### **2. Frontend Integration**
Update your `src/lib/email-client.ts`:

```typescript
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
): Promise<EmailResult> {
  try {
    const response = await fetch('http://localhost:5678/webhook/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email,
        template: 'password-reset',
        data: {
          resetUrl: `${window.location.origin}/reset-password?token=${resetToken}`
        }
      }),
    })

    if (response.ok) {
      return { success: true, messageId: `n8n-${Date.now()}` }
    } else {
      return { success: false, error: 'Email service unavailable' }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    }
  }
}

export async function sendWelcomeEmail(
  email: string,
  userName: string
): Promise<EmailResult> {
  try {
    const response = await fetch('http://localhost:5678/webhook/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email,
        template: 'welcome',
        data: { userName }
      }),
    })

    if (response.ok) {
      return { success: true, messageId: `n8n-${Date.now()}` }
    } else {
      return { success: false, error: 'Email service unavailable' }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    }
  }
}
```

#### **3. Environment Configuration**
Add to your `.env` file:
```env
SENDGRID_API_KEY=***REMOVED-SENDGRID-PREFIX***...
```

---

## ⚡ **Option 2: Document Processor Extension** (FASTEST)

**Why Great for You:**
- ✅ **Already Running**: FastAPI service at port 8090
- ✅ **Python/FastAPI**: Easy to add email endpoints
- ✅ **Same Technology**: Consistent with existing services
- ✅ **Quick Implementation**: Add one new router

### **Architecture:**
```
Vite React App → Document Processor API → SendGrid → Email Sent
```

### **Implementation:**

#### **1. Add Email Router** (`document-processor/app/routers/email.py`)
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
import sendgrid
from sendgrid.helpers.mail import Mail
import os

router = APIRouter(prefix="/api/email", tags=["email"])

class EmailRequest(BaseModel):
    to: EmailStr
    template: str
    data: dict

@router.post("/send-password-reset")
async def send_password_reset(request: EmailRequest):
    try:
        sg = sendgrid.SendGridAPIClient(api_key=os.environ.get('SENDGRID_API_KEY'))
        
        # Generate HTML template
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head><title>Reset Your FetchText Password</title></head>
        <body>
            <h1>Reset Your Password</h1>
            <p>Click the link below to reset your password:</p>
            <a href="{request.data.get('resetUrl')}">Reset Password</a>
            <p>This link expires in 24 hours.</p>
        </body>
        </html>
        """
        
        message = Mail(
            from_email=('yeag123@gmail.com', 'FetchText'),
            to_emails=request.to,
            subject='Reset Your FetchText Password',
            html_content=html_content
        )
        
        response = sg.send(message)
        
        return {
            "success": True,
            "messageId": response.headers.get('X-Message-Id', f"doc-{int(time.time())}")
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send-welcome")
async def send_welcome(request: EmailRequest):
    try:
        sg = sendgrid.SendGridAPIClient(api_key=os.environ.get('SENDGRID_API_KEY'))
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head><title>Welcome to FetchText!</title></head>
        <body>
            <h1>Welcome to FetchText, {request.data.get('userName', 'User')}!</h1>
            <p>Thank you for joining us!</p>
        </body>
        </html>
        """
        
        message = Mail(
            from_email=('yeag123@gmail.com', 'FetchText'),
            to_emails=request.to,
            subject='Welcome to FetchText!',
            html_content=html_content
        )
        
        response = sg.send(message)
        
        return {
            "success": True,
            "messageId": response.headers.get('X-Message-Id', f"doc-{int(time.time())}")
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

#### **2. Update Main App** (`document-processor/app/main.py`)
```python
# Add this import
from app.routers import documents, health, email

# Add this line after existing routers
app.include_router(email.router)
```

#### **3. Frontend Integration**
```typescript
// Update src/lib/email-client.ts
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
): Promise<EmailResult> {
  try {
    const response = await fetch('http://localhost:8090/api/email/send-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email,
        template: 'password-reset',
        data: {
          resetUrl: `${window.location.origin}/reset-password?token=${resetToken}`
        }
      }),
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
```

---

## 📊 **Comparison Matrix**

| Option | Setup Time | Complexity | Debugging | Visual Interface | Scalability |
|--------|------------|------------|-----------|------------------|-------------|
| **N8N Workflows** | 30 min | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Document Processor** | 15 min | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Supabase Edge Functions** | 60 min | ⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| **Direct Frontend** | 10 min | ⭐ | ⭐⭐⭐ | ⭐ | ⭐⭐ |

---

## 🎯 **Recommendation: N8N Workflows**

**Choose N8N because:**

1. **Visual Interface**: Easy to modify email templates without code
2. **Built-in Error Handling**: Automatic retries, logging, and monitoring
3. **No Code Changes**: Email logic lives in visual workflows
4. **Already Running**: Zero infrastructure setup required
5. **Future Flexibility**: Easy to add complex email logic (delays, conditions, etc.)

### **Quick Start with N8N:**

1. **Access N8N**: Go to `http://localhost:5678`
2. **Import Workflow**: Copy the JSON workflow above
3. **Add SendGrid Credentials**: Configure your API key
4. **Test Webhook**: Use the webhook URL in your frontend
5. **Deploy**: It's already running!

### **Testing the Integration:**
```bash
# Test the N8N webhook directly
curl -X POST http://localhost:5678/webhook/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "template": "password-reset",
    "data": {
      "resetUrl": "https://fetchtext.com/reset?token=abc123"
    }
  }'
```

**Result**: Your forgot password flow will work immediately with zero server setup! 🎉

---

## 🚀 **Next Steps**

1. **Try N8N Approach**: 30-minute setup, zero infrastructure
2. **Fallback to Document Processor**: If you prefer Python/FastAPI
3. **Keep Current Architecture**: Your existing code can easily integrate with either option

**No need for Express.js or additional servers!** Your Docker Compose setup already has everything you need. 🔥 