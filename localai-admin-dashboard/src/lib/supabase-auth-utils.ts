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
 */
export async function requireAuthentication(): Promise<AuthenticatedUser> {
  // Check if we have an active session
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.error('Session error:', sessionError);
    throw new Error(`Authentication error: ${sessionError.message}`);
  }
  
  if (!sessionData?.session) {
    throw new Error('User not authenticated - please sign in to continue');
  }
  
  // Verify the user is still valid
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData?.user) {
    console.error('User verification failed:', userError);
    throw new Error('User authentication expired - please sign in again');
  }
  
  return {
    id: userData.user.id,
    email: userData.user.email,
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