/**
 * Client-Side Supabase Auth Hooks and Utilities
 *
 * Use these hooks in Client Components for authentication
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { User, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// Runtime configuration - will be fetched from server
let runtimeConfig: { supabaseUrl?: string; supabaseAnonKey?: string } | null = null;
let configPromise: Promise<void> | null = null;

// Function to load runtime configuration from server
async function loadRuntimeConfig() {
  if (runtimeConfig) {
    console.log('[Supabase Config] Already loaded');
    return;
  }
  if (configPromise) {
    console.log('[Supabase Config] Loading in progress...');
    return configPromise;
  }

  console.log('[Supabase Config] Fetching from /api/config...');

  configPromise = fetch('/api/config')
    .then(res => {
      console.log('[Supabase Config] Response status:', res.status);
      return res.json();
    })
    .then(config => {
      console.log('[Supabase Config] Received config:', {
        hasUrl: !!config.supabaseUrl,
        hasKey: !!config.supabaseAnonKey,
        urlPreview: config.supabaseUrl?.substring(0, 30) + '...',
      });
      runtimeConfig = {
        supabaseUrl: config.supabaseUrl,
        supabaseAnonKey: config.supabaseAnonKey,
      };
      console.log('✅ Loaded runtime Supabase config successfully');
    })
    .catch(err => {
      console.error('❌ Failed to load runtime config:', err);
      // Fallback to build-time env vars if available
      const fallbackUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const fallbackKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      console.log('[Supabase Config] Using fallback:', {
        hasUrl: !!fallbackUrl,
        hasKey: !!fallbackKey,
      });
      runtimeConfig = {
        supabaseUrl: fallbackUrl,
        supabaseAnonKey: fallbackKey,
      };
    });

  return configPromise;
}

// Get Supabase URL and key (with runtime fallback)
function getSupabaseConfig() {
  return {
    url: runtimeConfig?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    key: runtimeConfig?.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
  };
}

// Create Supabase client lazily - only after config is loaded
let supabaseInstance: SupabaseClient | null = null;
let isCreatingClient = false;

async function getSupabaseClient(): Promise<SupabaseClient> {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Prevent multiple simultaneous client creations
  if (isCreatingClient) {
    // Wait a bit and try again
    await new Promise(resolve => setTimeout(resolve, 100));
    return getSupabaseClient();
  }

  isCreatingClient = true;

  try {
    // Always ensure config is loaded first
    await loadRuntimeConfig();

    const config = getSupabaseConfig();
    console.log('[Supabase Client] Creating client with config:', {
      url: config.url?.substring(0, 30) + '...',
      hasKey: !!config.key,
      keyPreview: config.key?.substring(0, 15) + '...',
    });

    supabaseInstance = createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });

    console.log('[Supabase Client] Client created successfully');
    return supabaseInstance;
  } finally {
    isCreatingClient = false;
  }
}

// Export supabase as a Proxy that lazily initializes the client
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    // For auth operations, we need to return a promise-based wrapper
    if (prop === 'auth') {
      return new Proxy({} as SupabaseClient['auth'], {
        get(_authTarget, authProp) {
          return (...args: any[]) => {
            // Return a promise that waits for the client to be ready
            return getSupabaseClient().then(client => {
              const authMethod = (client.auth as any)[authProp];
              if (typeof authMethod === 'function') {
                return authMethod.apply(client.auth, args);
              }
              return authMethod;
            });
          };
        },
      });
    }

    // For other properties, also ensure client is ready
    const value = new Proxy(() => {}, {
      apply: async (_target, _thisArg, args) => {
        const client = await getSupabaseClient();
        const method = (client as any)[prop];
        if (typeof method === 'function') {
          return method.apply(client, args);
        }
        return method;
      },
      get: async (_target, subProp) => {
        const client = await getSupabaseClient();
        return (client as any)[prop][subProp];
      },
    });

    return value;
  },
});

// Initialize config on client load
if (typeof window !== 'undefined') {
  loadRuntimeConfig();
}

/**
 * Ensure runtime configuration is loaded before using Supabase
 * Call this before any auth operations
 */
export async function ensureSupabaseReady(): Promise<void> {
  console.log('[Supabase] Ensuring client is ready...');
  await getSupabaseClient();
  console.log('[Supabase] Client ready!');
}

export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';
export type TenantType = 'TALENT' | 'STUDIO';

/**
 * Extended session with application profile data
 */
export interface AppProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  role: UserRole;
  tenantType: TenantType | null;
  tenantId: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface UseSessionResult {
  session: Session | null;
  user: User | null;
  profile: AppProfile | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to get current auth session
 * Similar to NextAuth's useSession()
 */
export function useSession(): UseSessionResult {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setError(error);
      }
      setSession(session);

      // Fetch profile data if we have a session
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const response = await fetch(`/api/auth/profile?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
    } finally {
      setLoading(false);
    }
  };

  return {
    session,
    user: session?.user || null,
    profile,
    loading,
    error,
  };
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, metadata?: {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  tenantType?: TenantType;
}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

/**
 * Request password reset email
 */
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });

  if (error) {
    throw error;
  }
}

/**
 * Update password (requires current session)
 */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }
}

/**
 * Hook to protect routes - redirects to sign-in if not authenticated
 */
export function useRequireAuth(redirectUrl = '/sign-in') {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push(`${redirectUrl}?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [user, loading, router, redirectUrl]);

  return { user, loading };
}

/**
 * Hook to check if user is admin
 */
export function useIsAdmin() {
  const { profile } = useSession();
  return profile?.isAdmin || false;
}

/**
 * Hook to check if user is super admin
 */
export function useIsSuperAdmin() {
  const { profile } = useSession();
  return profile?.isSuperAdmin || false;
}

/**
 * Get user role from profile
 */
export function getUserRole(profile: AppProfile | null): UserRole {
  return profile?.role || 'USER';
}

/**
 * Get tenant type from profile
 */
export function getTenantType(profile: AppProfile | null): TenantType | null {
  return profile?.tenantType || null;
}
