import { createClient } from '@supabase/supabase-js';

/**
 * ADMIN SUPABASE CLIENT - SERVER SIDE ONLY
 *
 * This client uses the service role key which bypasses Row Level Security (RLS).
 * NEVER use this in client-side code or expose the service role key to the browser.
 *
 * Use this for:
 * - User registration (creating users, tenants, profiles)
 * - Admin operations that need to bypass RLS
 * - Server-side API routes only
 */

// Supabase configuration with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Check if we're in build time (where we shouldn't connect to Supabase)
const isBuildTime = process.env.NEXT_BUILD_SKIP_DB === 'true' ||
                    (!supabaseUrl || !supabaseServiceRoleKey);

if (isBuildTime && typeof window === 'undefined') {
  console.log('⚠️ Build time or missing Supabase service role key - using placeholder');
  console.log('Environment check:', {
    hasUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceRoleKey,
    urlPreview: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING',
    serviceKeyPreview: supabaseServiceRoleKey ? supabaseServiceRoleKey.substring(0, 15) + '...' : 'MISSING',
  });
}

// Validate Supabase configuration at runtime
if (!isBuildTime && (!supabaseUrl || !supabaseServiceRoleKey)) {
  console.error(`
❌ SUPABASE ADMIN CONFIGURATION WARNING ❌

The following environment variables should be set:
  - NEXT_PUBLIC_SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY (server-side only, never expose to client!)

Get these from: Supabase Dashboard → Settings → API

Missing variables:
  ${!supabaseUrl ? '✗ NEXT_PUBLIC_SUPABASE_URL' : ''}
  ${!supabaseServiceRoleKey ? '✗ SUPABASE_SERVICE_ROLE_KEY' : ''}

IMPORTANT: SUPABASE_SERVICE_ROLE_KEY should NEVER be prefixed with NEXT_PUBLIC_
  `);
}

// Create admin Supabase client with service role key
// This bypasses Row Level Security (RLS) policies
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceRoleKey || 'placeholder-service-role-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        'X-Client-Info': 'qcard-app-admin'
      }
    }
  }
);

// Check if Supabase admin is properly configured
export function isSupabaseAdminConfigured(): boolean {
  return !!(supabaseUrl && supabaseServiceRoleKey &&
            supabaseUrl !== 'https://placeholder.supabase.co' &&
            supabaseServiceRoleKey !== 'placeholder-service-role-key');
}

// Helper to ensure we're not in build mode before making requests
export function ensureNotBuildTime() {
  if (isBuildTime) {
    throw new Error('Cannot access Supabase during build time');
  }
}

// Helper to ensure this is only used server-side
export function ensureServerSide() {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin should only be used server-side! Never expose service role key to the browser.');
  }
}

export default supabaseAdmin;
