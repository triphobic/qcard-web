import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

/**
 * Supabase Client Configuration
 *
 * This file provides Supabase clients for authentication, real-time, storage, and database operations.
 *
 * Architecture:
 * - Supabase Auth handles authentication (sign up, sign in, sessions)
 * - Prisma handles application data through PostgreSQL
 * - Both work together: Supabase auth.users.id = Prisma User.id
 */

// Supabase configuration - REQUIRED for app to function
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key-for-build';

// Check if we're in build time
const isBuildTime = typeof window === 'undefined' && (
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NODE_ENV === 'production'
);

// Validate Supabase configuration
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  const errorMessage = `
❌ SUPABASE CONFIGURATION WARNING ❌

The following environment variables should be set:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY

Get these from: Supabase Dashboard → Settings → API

Missing variables:
  ${!process.env.NEXT_PUBLIC_SUPABASE_URL ? '✗ NEXT_PUBLIC_SUPABASE_URL\n' : ''}  ${!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✗ NEXT_PUBLIC_SUPABASE_ANON_KEY\n' : ''}
For Dokploy deployment: Set these in the Environment tab BEFORE deploying.
`;

  console.error(errorMessage);

  // Only throw during runtime in browser, not during build
  if (!isBuildTime && typeof window !== 'undefined') {
    throw new Error('Supabase credentials are required. See error message above for details.');
  } else if (isBuildTime) {
    console.warn('⚠️ Using placeholder Supabase credentials for build. App will not function without real credentials.');
  }
}

/**
 * Browser Supabase client (DEPRECATED - use getSupabaseBrowser from @/lib/supabase-browser instead)
 *
 * @deprecated This export creates a client at module load time with placeholder values.
 * Use `getSupabaseBrowser()` from `@/lib/supabase-browser` for client-side code.
 *
 * This export is kept temporarily for server-side backward compatibility only.
 */

/**
 * Create a Supabase client for Server Components
 * Uses cookies for session management
 *
 * IMPORTANT: This must be called inside an async Server Component or API route
 *
 * @example
 * ```tsx
 * import { createServerClient } from '@/lib/supabase';
 *
 * export default async function Page() {
 *   const supabase = createServerClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *   return <div>User: {user?.email}</div>;
 * }
 * ```
 */
export function createServerClient() {
  const cookieStore = cookies();

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: false,
    },
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          // Handle cookie setting errors (can happen during static generation)
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch (error) {
          // Handle cookie removal errors
        }
      },
    },
  });
}

/**
 * Server-side Supabase client with service role key (admin operations)
 * Bypasses Row Level Security - use with caution!
 *
 * Only use this in server-side contexts (API routes, server components) for admin operations
 *
 * @example
 * ```tsx
 * import { getServerSupabaseClient } from '@/lib/supabase';
 *
 * export async function POST(request: Request) {
 *   const supabase = getServerSupabaseClient();
 *   // Perform admin operations
 * }
 * ```
 */
export function getServerSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Get the Supabase database connection string
 * This is used by Prisma to connect to Supabase's PostgreSQL database
 */
export function getSupabaseDatabaseUrl(): string {
  // Direct connection (for migrations and local development)
  const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

  // Pooled connection (for production, uses connection pooler)
  const pooledUrl = process.env.DATABASE_URL;

  // In production, prefer pooled connection for better performance
  // In development, use direct connection
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment && directUrl) {
    return directUrl;
  }

  if (pooledUrl) {
    return pooledUrl;
  }

  throw new Error('No Supabase database URL configured. Set DATABASE_URL in your .env file');
}
