// Email Service Configuration for FetchText.io

const sendgridApiKey = import.meta.env.VITE_SENDGRID_API_KEY;

if (!sendgridApiKey) {
  console.warn(
    '[Email] VITE_SENDGRID_API_KEY is not set. Email delivery will be disabled until the key is provided via environment variables.'
  );
}

export const EMAIL_CONFIG = {
  // SendGrid Configuration
  SENDGRID_API_KEY: sendgridApiKey ?? '',

  // Email Settings - Using verified sender email
  FROM_EMAIL: import.meta.env.VITE_SENDGRID_FROM_EMAIL || 'yeag123@gmail.com',
  FROM_NAME: import.meta.env.VITE_SENDGRID_FROM_NAME || 'FetchText Support',
  REPLY_TO: import.meta.env.VITE_SENDGRID_REPLY_TO || 'yeag123@gmail.com',
  
  // SendGrid Template IDs
  TEMPLATES: {
    PASSWORD_RESET: import.meta.env.VITE_SENDGRID_PASSWORD_RESET_TEMPLATE_ID || 'd-password-reset-template-id',
    WELCOME: import.meta.env.VITE_SENDGRID_WELCOME_TEMPLATE_ID || 'd-welcome-template-id',
    TWO_FACTOR: import.meta.env.VITE_SENDGRID_2FA_TEMPLATE_ID || 'd-2fa-template-id',
  },
  
  // Application URLs
  APP_URL: import.meta.env.VITE_APP_URL || 'http://localhost:5173',
  
  // Timing Configuration
  PASSWORD_RESET_EXPIRES_IN: '1 hour',
  TWO_FACTOR_EXPIRES_IN: '10 minutes',
  
  // Rate Limiting
  FORGOT_PASSWORD_COOLDOWN_SECONDS: 60,
  MAX_RESET_ATTEMPTS_PER_EMAIL: 5,
  
  // Development Configuration
  MOCK_EMAIL_SERVICE: import.meta.env.VITE_MOCK_EMAIL_SERVICE === 'true' || import.meta.env.DEV,
  ENABLE_EMAIL_LOGGING: import.meta.env.VITE_ENABLE_EMAIL_LOGGING === 'true' || import.meta.env.DEV,
} as const;

export type EmailConfig = typeof EMAIL_CONFIG; 
