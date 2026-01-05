"""
Email Router

Handles sending emails via SendGrid from the backend.
This avoids CORS issues when calling SendGrid directly from the browser.
"""

import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

router = APIRouter(prefix="/api/email", tags=["email"])

# Configuration from environment
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "nick@fetchtext.io")
FROM_NAME = os.getenv("SENDGRID_FROM_NAME", "FetchText")
APP_URL = os.getenv("APP_URL", "http://localhost:5173")


class InvitationEmailRequest(BaseModel):
    """Request model for sending invitation emails"""
    to_email: EmailStr
    organization_name: str
    inviter_email: str
    invite_token: str
    role: str


class EmailResponse(BaseModel):
    """Response model for email operations"""
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None


@router.post("/send-invitation", response_model=EmailResponse)
async def send_invitation_email(request: InvitationEmailRequest) -> EmailResponse:
    """
    Send an organization invitation email via SendGrid.

    This endpoint is called from the frontend to send invitation emails
    without exposing the SendGrid API key to the browser.
    """
    if not SENDGRID_API_KEY:
        return EmailResponse(
            success=False,
            error="SendGrid API key not configured"
        )

    try:
        # Include email in URL so it can be prefilled in sign-up form
        import urllib.parse
        encoded_email = urllib.parse.quote(request.to_email)
        accept_url = f"{APP_URL}/invite/accept?token={request.invite_token}&email={encoded_email}"

        # Build HTML email content
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Team Invitation - FetchText</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">FetchText</h1>
            <p style="color: white; margin: 10px 0 0; opacity: 0.9;">Team Invitation</p>
          </div>

          <div style="background: white; padding: 40px; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">You're Invited!</h2>

            <p>Hi there!</p>

            <p><strong>{request.inviter_email}</strong> has invited you to join <strong>{request.organization_name}</strong> as a <strong>{request.role}</strong>.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="{accept_url}"
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 15px 30px;
                        text-decoration: none;
                        border-radius: 5px;
                        font-weight: bold;
                        display: inline-block;
                        font-size: 16px;">
                Accept Invitation
              </a>
            </div>

            <p style="color: #666; font-size: 14px;">
              <strong>This invitation expires in 7 days.</strong>
            </p>

            <p style="color: #666; font-size: 14px;">
              If you don't want to join this organization, you can safely ignore this email.
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              If the button above doesn't work, copy and paste this link into your browser:<br>
              <a href="{accept_url}" style="color: #667eea; word-break: break-all;">{accept_url}</a>
            </p>

            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
              This email was sent by FetchText
              <br>© 2024 FetchText. All rights reserved.
            </p>
          </div>
        </body>
        </html>
        """

        # Plain text version
        text_content = f"""
You're Invited to Join {request.organization_name} on FetchText!

Hi there!

{request.inviter_email} has invited you to join {request.organization_name} as a {request.role}.

To accept this invitation, click the link below or copy and paste it into your browser:
{accept_url}

This invitation expires in 7 days.

If you don't want to join this organization, you can safely ignore this email.

Best regards,
The FetchText Team
"""

        # Create SendGrid message
        message = Mail(
            from_email=Email(FROM_EMAIL, FROM_NAME),
            to_emails=To(request.to_email),
            subject=f"You've been invited to join {request.organization_name} on FetchText",
            html_content=Content("text/html", html_content),
            plain_text_content=Content("text/plain", text_content)
        )

        # Send email
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)

        # Extract message ID from headers
        message_id = response.headers.get("X-Message-Id", "")

        return EmailResponse(
            success=True,
            message_id=message_id
        )

    except Exception as e:
        error_message = str(e)
        # Try to extract more specific error from SendGrid response
        if hasattr(e, 'body'):
            error_message = f"SendGrid error: {e.body}"

        return EmailResponse(
            success=False,
            error=error_message
        )


@router.get("/health")
async def email_health():
    """Check if email service is configured"""
    return {
        "configured": bool(SENDGRID_API_KEY),
        "from_email": FROM_EMAIL,
        "app_url": APP_URL
    }
