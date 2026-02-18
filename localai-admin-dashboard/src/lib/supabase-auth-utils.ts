/**
 * Supabase Authentication Utilities
 * 
 * Centralized utilities to ensure all database operations use authenticated sessions
 * instead of anonymous access. This is critical for RLS (Row Level Security) to work properly.
 */

import { supabase } from '@/lib/supabase';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  access_token: string;
}

/**
 * Verify user is authenticated and return user info
 * Throws an error if user is not authenticated
 *
 * Uses getSession() (localStorage read) instead of getUser() (network call).
 * This is the Supabase-recommended approach for client-side code:
 * - getSession().session.user is decoded from the JWT, no network needed
 * - PostgREST validates the JWT server-side on every database query
 * - getUser() caused ERR_ABORTED during navigation transitions because its
 *   network request was cancelled by the browser mid-flight
 */
export async function requireAuthentication(): Promise<AuthenticatedUser> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('Session error:', sessionError);
    throw new Error(`Authentication error: ${sessionError.message}`);
  }

  if (!sessionData?.session) {
    throw new Error('User not authenticated - please sign in to continue');
  }

  const user = sessionData.session.user;

  return {
    id: user.id,
    email: user.email,
    access_token: sessionData.session.access_token,
  };
}

/**
 * Execute a Supabase query with authentication verification
 * Use this wrapper for all database operations that require authentication
 */
export async function withAuthentication<T>(
  operation: (user: AuthenticatedUser) => Promise<T>,
  context?: string
): Promise<T> {
  try {
    const user = await requireAuthentication();
    
    if (context) {
      console.log(`✅ ${context} - Authenticated user:`, user.id);
    }
    
    return await operation(user);
  } catch (error) {
    if (context) {
      console.error(`🚫 ${context} - Authentication failed:`, error);
    }
    throw error;
  }
}

/**
 * Get authenticated Supabase client
 * This ensures the client is using the user's access token
 */
export async function getAuthenticatedSupabaseClient() {
  await requireAuthentication();
  return supabase;
}

/**
 * Check if user is currently authenticated (non-throwing version)
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    return !!sessionData?.session;
  } catch {
    return false;
  }
}