import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

// Only initialize in production (not localhost)
const isProduction = typeof window !== 'undefined' &&
  !window.location.hostname.includes('localhost') &&
  !window.location.hostname.includes('127.0.0.1')

export function initPostHog() {
  if (!POSTHOG_KEY || !isProduction) {
    console.log('[PostHog] Disabled - running in development or no API key')
    return
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // We'll handle manually with router
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: { password: true }
    }
  })
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!isProduction) return
  posthog.identify(userId, properties)
}

export function resetUser() {
  if (!isProduction) return
  posthog.reset()
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!isProduction) return
  posthog.capture(event, properties)
}

export function trackPageView(path: string) {
  if (!isProduction) return
  posthog.capture('$pageview', { $current_url: path })
}

export { posthog }
