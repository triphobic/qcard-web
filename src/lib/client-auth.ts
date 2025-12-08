'use client';

/**
 * Client-side authentication utilities for Supabase
 * This replaces the previous NextAuth implementation
 */

import { getSupabaseBrowser } from '@/lib/supabase-browser';

export type SignInOptions = {
  email: string;
  password: string;
  redirect?: boolean;
  callbackUrl?: string;
};

export interface SignInResponse {
  error?: string;
  status?: number;
  ok?: boolean;
  url?: string;
}

/**
 * Sign in with email and password using Supabase
 * Supports two calling patterns:
 * 1. signIn({ email, password, ...options })
 * 2. signIn(email, password)
 */
export async function signIn(
  emailOrOptions: string | SignInOptions,
  password?: string
): Promise<SignInResponse> {
  // Handle both calling patterns
  let email: string;
  let pwd: string;
  let callbackUrl = '/role-redirect';

  if (typeof emailOrOptions === 'string') {
    // Called with separate email and password arguments
    email = emailOrOptions;
    pwd = password || '';
  } else {
    // Called with options object
    email = emailOrOptions.email;
    pwd = emailOrOptions.password;
    callbackUrl = emailOrOptions.callbackUrl || callbackUrl;
  }

  try {
    console.log('[Client Auth] Starting sign-in process');
    console.log('[Client Auth] Email:', email);
    console.log('[Client Auth] Callback URL:', callbackUrl);

    // Get Supabase client (will wait for config to load)
    console.log('[Client Auth] Getting Supabase client...');
    const supabase = await getSupabaseBrowser();
    console.log('[Client Auth] Supabase client ready');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pwd,
    });

    console.log('[Client Auth] Sign-in response received');
    console.log('[Client Auth] Has error:', !!error);
    console.log('[Client Auth] Has user:', !!data?.user);

    if (error) {
      console.error('[Client Auth] Sign-in error:', error);
      console.error('[Client Auth] Error message:', error.message);
      console.error('[Client Auth] Error code:', error.status);
      return {
        error: error.message,
        status: 401,
        ok: false,
      };
    }

    if (data?.user) {
      console.log('[Client Auth] Sign-in successful for user:', data.user.id);
      console.log('[Client Auth] User email:', data.user.email);
      return {
        ok: true,
        status: 200,
        url: callbackUrl,
      };
    }

    console.error('[Client Auth] Sign-in failed - no user data returned');
    return {
      error: 'Sign in failed',
      status: 401,
      ok: false,
    };
  } catch (error) {
    console.error('[Client Auth] Exception during sign-in:', error);
    console.error('[Client Auth] Exception type:', error instanceof Error ? 'Error' : typeof error);
    console.error('[Client Auth] Exception message:', error instanceof Error ? error.message : String(error));
    return {
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      status: 500,
      ok: false,
    };
  }
}

/**
 * Sign out using Supabase
 */
export async function signOut() {
  try {
    console.log('[Supabase] Signing out');
    const supabase = await getSupabaseBrowser();

    // Sign out from Supabase (this should clear the auth cookies)
    await supabase.auth.signOut();

    // Also manually clear any remaining Supabase cookies
    // This ensures cookies are cleared even if Supabase signOut doesn't work properly
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const cookieName = cookie.split('=')[0].trim();
      if (cookieName.startsWith('sb-') && cookieName.includes('-auth-token')) {
        // Clear the cookie by setting it to expire in the past
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        console.log('[Supabase] Cleared cookie:', cookieName);
      }
    }

    // Also call the server-side clear cookies endpoint
    try {
      await fetch('/api/auth/clear-cookies', { method: 'POST' });
    } catch (e) {
      // Ignore errors from this endpoint
    }

    // Redirect to home page
    window.location.href = '/';
  } catch (error) {
    console.error('[Supabase] Sign-out error:', error);
    // Even if there's an error, try to redirect
    window.location.href = '/';
  }
}

/**
 * Create a new account with Supabase
 */
export async function signUp(options: {
  email: string;
  password: string;
  metadata?: Record<string, any>;
}): Promise<SignInResponse> {
  const { email, password, metadata } = options;

  try {
    console.log('[Supabase] Starting sign-up process');

    const supabase = await getSupabaseBrowser();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) {
      console.error('[Supabase] Sign-up error:', error);
      return {
        error: error.message,
        status: 400,
        ok: false,
      };
    }

    if (data?.user) {
      console.log('[Supabase] Sign-up successful');
      // Auto sign in after sign up
      return signIn({ email, password });
    }

    return {
      error: 'Sign up failed',
      status: 400,
      ok: false,
    };
  } catch (error) {
    console.error('[Supabase] Sign-up error:', error);
    return {
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      status: 500,
      ok: false,
    };
  }
}

/**
 * Get CSRF token (compatibility function - Supabase doesn't use CSRF tokens)
 */
export async function getCsrfToken(): Promise<string | null> {
  // Supabase handles security differently, return a dummy token for compatibility
  return 'supabase-no-csrf-required';
}

/**
 * Ensure CSRF token (compatibility function)
 */
export async function ensureCSRFToken(): Promise<void> {
  // No-op for Supabase
  return;
}