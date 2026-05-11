/**
 * Translate raw Supabase/network errors into user-friendly messages.
 *
 * The Supabase auth-js client can surface cryptic internal errors when the
 * backend is unreachable (e.g. Vite proxy returns 500 with empty body →
 * `response.json()` throws SyntaxError). These should never be shown to users.
 */
export function getUserFriendlyAuthError(rawMessage: string): string {
  const msg = rawMessage.toLowerCase()

  // Backend unreachable: proxy returns 500 with empty body → JSON parse fails
  if (msg.includes('unexpected end of json') || msg.includes('json input')) {
    return 'Authentication service is unavailable. Please ensure backend services are running.'
  }
  // Network failure: fetch itself failed (DNS, CORS, connection refused)
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('aborterror')) {
    return 'Cannot reach the authentication service. Please check your connection.'
  }

  return rawMessage
}
