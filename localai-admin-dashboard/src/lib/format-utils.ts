/**
 * Format Utilities
 *
 * Utility functions for formatting template variable values
 * according to user-selected display formats. Supports date,
 * number, currency, text, and phone number formatting.
 */

/**
 * Available format options organized by variable type
 */
export const FORMAT_OPTIONS: Record<
  string,
  { label: string; formats: { value: string; label: string; example?: string }[] }
> = {
  date: {
    label: 'Date Formats',
    formats: [
      { value: 'raw', label: 'Raw Value', example: '2025-01-15' },
      { value: 'date_short', label: 'Short Date (MM/DD/YYYY)', example: '01/15/2025' },
      { value: 'date_long', label: 'Long Date', example: 'January 15, 2025' },
      { value: 'date_iso', label: 'ISO Date', example: '2025-01-15' },
      { value: 'date_relative', label: 'Relative Date', example: '3 days ago' },
    ],
  },
  number: {
    label: 'Number Formats',
    formats: [
      { value: 'raw', label: 'Raw Value', example: '1234.5678' },
      { value: 'number_comma', label: 'With Commas', example: '1,234.57' },
      { value: 'number_rounded', label: 'Rounded', example: '1,235' },
      { value: 'number_compact', label: 'Compact', example: '1.2K' },
      { value: 'number_percent', label: 'Percentage', example: '12.35%' },
    ],
  },
  currency: {
    label: 'Currency Formats',
    formats: [
      { value: 'raw', label: 'Raw Value', example: '1234.56' },
      { value: 'currency_usd', label: 'US Dollar', example: '$1,234.56' },
      { value: 'currency_eur', label: 'Euro', example: '€1.234,56' },
      { value: 'currency_gbp', label: 'British Pound', example: '£1,234.56' },
      { value: 'currency_compact', label: 'Compact USD', example: '$1.2K' },
    ],
  },
  text: {
    label: 'Text Formats',
    formats: [
      { value: 'raw', label: 'Raw Value', example: 'Hello World' },
      { value: 'uppercase', label: 'UPPERCASE', example: 'HELLO WORLD' },
      { value: 'lowercase', label: 'lowercase', example: 'hello world' },
      { value: 'capitalize', label: 'Title Case', example: 'Hello World' },
      { value: 'sentence', label: 'Sentence case', example: 'Hello world' },
      { value: 'trim', label: 'Trimmed', example: 'Hello World' },
    ],
  },
  phone: {
    label: 'Phone Formats',
    formats: [
      { value: 'raw', label: 'Raw Value', example: '5551234567' },
      { value: 'phone_us', label: 'US Format', example: '(555) 123-4567' },
      { value: 'phone_intl', label: 'International', example: '+1 555 123 4567' },
      { value: 'phone_dashes', label: 'With Dashes', example: '555-123-4567' },
    ],
  },
  email: {
    label: 'Email Formats',
    formats: [
      { value: 'raw', label: 'Raw Value', example: 'John.Doe@example.com' },
      { value: 'email_lowercase', label: 'Lowercase', example: 'john.doe@example.com' },
      { value: 'email_masked', label: 'Masked', example: 'j***e@example.com' },
    ],
  },
  boolean: {
    label: 'Boolean Formats',
    formats: [
      { value: 'raw', label: 'Raw Value', example: 'true' },
      { value: 'boolean_yes_no', label: 'Yes/No', example: 'Yes' },
      { value: 'boolean_check', label: 'Check Mark', example: '✓' },
      { value: 'boolean_onoff', label: 'On/Off', example: 'On' },
    ],
  },
};

/**
 * Get format options for a given variable type
 * Falls back to text formats if type is not recognized
 */
export function getFormatOptionsForType(type: string): { value: string; label: string; example?: string }[] {
  const normalizedType = type?.toLowerCase() || 'text';
  return FORMAT_OPTIONS[normalizedType]?.formats || FORMAT_OPTIONS.text.formats;
}

/**
 * Format a value according to the specified format
 */
export function formatValue(value: unknown, format: string): string {
  if (value === null || value === undefined) return '';
  if (format === 'raw') return String(value);

  try {
    switch (format) {
      // Text formats
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'capitalize':
        return String(value)
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      case 'sentence':
        const str = String(value).toLowerCase();
        return str.charAt(0).toUpperCase() + str.slice(1);
      case 'trim':
        return String(value).trim();

      // Date formats
      case 'date_short':
        return new Date(String(value)).toLocaleDateString('en-US');
      case 'date_long':
        return new Date(String(value)).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      case 'date_iso':
        return new Date(String(value)).toISOString().split('T')[0];
      case 'date_relative':
        return getRelativeTimeString(new Date(String(value)));

      // Number formats
      case 'number_comma':
        return new Intl.NumberFormat('en-US').format(Number(value));
      case 'number_rounded':
        return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value));
      case 'number_compact':
        return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(Number(value));
      case 'number_percent':
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: 2,
        }).format(Number(value) / 100);

      // Currency formats
      case 'currency_usd':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
          Number(value)
        );
      case 'currency_eur':
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
          Number(value)
        );
      case 'currency_gbp':
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
          Number(value)
        );
      case 'currency_compact':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          notation: 'compact',
        }).format(Number(value));

      // Phone formats
      case 'phone_us': {
        const cleaned = String(value).replace(/\D/g, '');
        if (cleaned.length === 10) {
          return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        if (cleaned.length === 11 && cleaned.startsWith('1')) {
          return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
        }
        return String(value);
      }
      case 'phone_intl': {
        const digits = String(value).replace(/\D/g, '');
        if (digits.length === 10) {
          return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
        }
        if (digits.length === 11 && digits.startsWith('1')) {
          return `+${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
        }
        return String(value);
      }
      case 'phone_dashes': {
        const nums = String(value).replace(/\D/g, '');
        if (nums.length === 10) {
          return `${nums.slice(0, 3)}-${nums.slice(3, 6)}-${nums.slice(6)}`;
        }
        return String(value);
      }

      // Email formats
      case 'email_lowercase':
        return String(value).toLowerCase();
      case 'email_masked': {
        const email = String(value);
        const [local, domain] = email.split('@');
        if (local && domain && local.length > 2) {
          return `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`;
        }
        return email;
      }

      // Boolean formats
      case 'boolean_yes_no':
        return isTruthy(value) ? 'Yes' : 'No';
      case 'boolean_check':
        return isTruthy(value) ? '✓' : '✗';
      case 'boolean_onoff':
        return isTruthy(value) ? 'On' : 'Off';

      default:
        return String(value);
    }
  } catch {
    // If formatting fails, return raw value
    return String(value);
  }
}

/**
 * Check if a value is truthy (handles various string representations)
 */
function isTruthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'on';
  }
  return Boolean(value);
}

/**
 * Get relative time string (e.g., "3 days ago", "in 2 hours")
 */
function getRelativeTimeString(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.round(diffMs / 1000);
  const diffMins = Math.round(diffSecs / 60);
  const diffHours = Math.round(diffMins / 60);
  const diffDays = Math.round(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(diffSecs) < 60) {
    return rtf.format(-diffSecs, 'second');
  } else if (Math.abs(diffMins) < 60) {
    return rtf.format(-diffMins, 'minute');
  } else if (Math.abs(diffHours) < 24) {
    return rtf.format(-diffHours, 'hour');
  } else if (Math.abs(diffDays) < 30) {
    return rtf.format(-diffDays, 'day');
  } else if (Math.abs(diffDays) < 365) {
    return rtf.format(-Math.round(diffDays / 30), 'month');
  } else {
    return rtf.format(-Math.round(diffDays / 365), 'year');
  }
}

/**
 * Detect the best variable type from a value
 */
export function detectVariableType(value: unknown): string {
  if (value === null || value === undefined) return 'text';

  const str = String(value);

  // Check for boolean
  if (typeof value === 'boolean' || ['true', 'false', 'yes', 'no'].includes(str.toLowerCase())) {
    return 'boolean';
  }

  // Check for email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    return 'email';
  }

  // Check for phone (10 or 11 digit number, possibly with formatting)
  const digitsOnly = str.replace(/\D/g, '');
  if ((digitsOnly.length === 10 || digitsOnly.length === 11) && /^[\d\s\-\(\)\+\.]+$/.test(str)) {
    return 'phone';
  }

  // Check for date
  if (!isNaN(Date.parse(str)) && /[\-\/]/.test(str)) {
    return 'date';
  }

  // Check for currency (starts with currency symbol or ends with currency code)
  if (/^[\$€£¥]|USD|EUR|GBP|JPY$/i.test(str)) {
    return 'currency';
  }

  // Check for number
  if (!isNaN(Number(str)) && str.trim() !== '') {
    return 'number';
  }

  return 'text';
}
