// Email Service Configuration for FetchText.io

export const EMAIL_CONFIG = {
  // Email Settings - Using verified sender email
  FROM_EMAIL: import.meta.env.VITE_SENDGRID_FROM_EMAIL || 'nick@fetchtext.io',
  FROM_NAME: import.meta.env.VITE_SENDGRID_FROM_NAME || 'FetchText',
  REPLY_TO: import.meta.env.VITE_SENDGRID_REPLY_TO || 'nick@fetchtext.io',

  // Application URLs - use window.location.origin as fallback for production
  APP_URL:
    import.meta.env.VITE_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : ''),

  // Timing Configuration
  PASSWORD_RESET_EXPIRES_IN: '1 hour',
  TWO_FACTOR_EXPIRES_IN: '10 minutes',

  // Rate Limiting
  FORGOT_PASSWORD_COOLDOWN_SECONDS: 60,
  MAX_RESET_ATTEMPTS_PER_EMAIL: 5,

  // Development Configuration
  MOCK_EMAIL_SERVICE:
    import.meta.env.VITE_MOCK_EMAIL_SERVICE === 'true' || import.meta.env.DEV,
  ENABLE_EMAIL_LOGGING:
    import.meta.env.VITE_ENABLE_EMAIL_LOGGING === 'true' || import.meta.env.DEV,
} as const

export type EmailConfig = typeof EMAIL_CONFIG
