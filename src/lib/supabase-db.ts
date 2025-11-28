/**
 * Supabase Database Utilities
 *
 * Replaces Prisma with Supabase Client
 * Provides typed database access with helper functions
 */

import { createServerClient } from './supabase';
import { getSupabaseBrowser } from './supabase-browser';
import type { Database } from '@/types/database.types';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

/**
 * Create a mock Supabase client for build time
 * This avoids calling cookies() which is not available during build
 */
function createMockClient(): SupabaseClient<Database> {
  const mockHandler = () => ({
    select: () => mockHandler(),
    insert: () => mockHandler(),
    update: () => mockHandler(),
    delete: () => mockHandler(),
    eq: () => mockHandler(),
    neq: () => mockHandler(),
    gt: () => mockHandler(),
    gte: () => mockHandler(),
    lt: () => mockHandler(),
    lte: () => mockHandler(),
    like: () => mockHandler(),
    ilike: () => mockHandler(),
    is: () => mockHandler(),
    in: () => mockHandler(),
    contains: () => mockHandler(),
    containedBy: () => mockHandler(),
    range: () => mockHandler(),
    or: () => mockHandler(),
    filter: () => mockHandler(),
    match: () => mockHandler(),
    not: () => mockHandler(),
    order: () => mockHandler(),
    limit: () => mockHandler(),
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: () => Promise.resolve({ data: null, error: null }),
  });

  return {
    from: () => mockHandler(),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    },
  } as any;
}

/**
 * Get server-side Supabase client (for Server Components, API Routes)
 * Returns a mock client during build time to avoid cookies() errors
 */
export function db() {
  // Check if we're in build time (cookies() won't be available)
  const isBuildTime = typeof window === 'undefined' && (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    !process.env.NEXT_RUNTIME
  );

  if (isBuildTime) {
    // Return a mock Supabase client for build time
    return createMockClient();
  }

  return createServerClient();
}

/**
 * Get client-side Supabase client (for Client Components)
 * NOTE: Removed - use getSupabaseBrowser() directly in client components
 * Server-side code should use db() or createServerClient()
 */
// export const clientDb removed - was causing server/client boundary issues

/**
 * Helper to handle Supabase errors
 * Throws error if present, returns data if successful
 */
export function handleDbResult<T>(
  result: { data: T | null; error: PostgrestError | null }
): T {
  if (result.error) {
    console.error('Database error:', result.error);
    throw new Error(result.error.message);
  }
  if (result.data === null) {
    throw new Error('No data returned from database');
  }
  return result.data;
}

/**
 * Helper for single record queries
 * Returns null if not found instead of throwing
 */
export function handleDbOptional<T>(
  result: { data: T | null; error: PostgrestError | null }
): T | null {
  if (result.error) {
    // PGRST116 is "not found" error - return null instead of throwing
    if (result.error.code === 'PGRST116') {
      return null;
    }
    console.error('Database error:', result.error);
    throw new Error(result.error.message);
  }
  return result.data;
}

/**
 * Generate UUID for new records
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Current timestamp for createdAt/updatedAt fields
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Common query patterns
 */
export const queries = {
  /**
   * Find user by ID with profile and tenant
   */
  async getUserWithProfile(userId: string) {
    const supabase = db();
    const result = await supabase
      .from('User')
      .select(`
        *,
        Profile (*),
        Tenant (*)
      `)
      .eq('id', userId)
      .single();

    return handleDbOptional(result);
  },

  /**
   * Find user by email
   */
  async getUserByEmail(email: string) {
    const supabase = db();
    const result = await supabase
      .from('User')
      .select('*')
      .eq('email', email)
      .single();

    return handleDbOptional(result);
  },

  /**
   * Get studio by user ID
   */
  async getStudioByUserId(userId: string) {
    const supabase = db();
    const result = await supabase
      .from('Studio')
      .select('*')
      .eq('userId', userId)
      .single();

    return handleDbOptional(result);
  },

  /**
   * Get profile by user ID
   */
  async getProfileByUserId(userId: string) {
    const supabase = db();
    const result = await supabase
      .from('Profile')
      .select('*')
      .eq('userId', userId)
      .single();

    return handleDbOptional(result);
  },

  /**
   * Get casting calls for a studio
   */
  async getCastingCallsByStudio(studioId: string) {
    const supabase = db();
    const result = await supabase
      .from('CastingCall')
      .select('*')
      .eq('studioId', studioId)
      .order('createdAt', { ascending: false });

    return handleDbResult(result);
  },

  /**
   * Get applications for a casting call
   */
  async getApplicationsForCastingCall(castingCallId: string) {
    const supabase = db();
    const result = await supabase
      .from('Application')
      .select(`
        *,
        Profile (
          *,
          User (
            firstName,
            lastName,
            email
          )
        )
      `)
      .eq('castingCallId', castingCallId)
      .order('createdAt', { ascending: false });

    return handleDbResult(result);
  },

  /**
   * Get messages for a user (talent)
   */
  async getMessagesForTalent(userId: string) {
    const supabase = db();

    // Get profile ID first
    const profile = await queries.getProfileByUserId(userId);
    if (!profile) return [];

    const result = await supabase
      .from('Message')
      .select('*')
      .or(`talentReceiverId.eq.${profile.id},talentSenderId.eq.${profile.id}`)
      .order('createdAt', { ascending: false });

    return handleDbResult(result);
  },

  /**
   * Get projects for a studio with casting calls
   */
  async getProjectsWithCastingCalls(studioId: string) {
    const supabase = db();
    const result = await supabase
      .from('Project')
      .select(`
        *,
        CastingCall (*)
      `)
      .eq('studioId', studioId)
      .eq('isArchived', false)
      .order('createdAt', { ascending: false });

    return handleDbResult(result);
  },
};

/**
 * Transaction helper using Postgres functions
 *
 * For complex multi-table operations, create a Postgres function:
 *
 * CREATE OR REPLACE FUNCTION create_user_with_profile(
 *   user_data JSON,
 *   profile_data JSON
 * ) RETURNS JSON AS $$
 * DECLARE
 *   new_user JSON;
 *   new_profile JSON;
 * BEGIN
 *   -- Insert user
 *   INSERT INTO "User" (...)
 *   VALUES (...)
 *   RETURNING row_to_json("User".*) INTO new_user;
 *
 *   -- Insert profile
 *   INSERT INTO "Profile" (...)
 *   VALUES (...)
 *   RETURNING row_to_json("Profile".*) INTO new_profile;
 *
 *   RETURN json_build_object('user', new_user, 'profile', new_profile);
 * END;
 * $$ LANGUAGE plpgsql;
 */
export async function executeTransaction<T>(
  functionName: string,
  params: Record<string, any>
): Promise<T> {
  const supabase = db();
  const result = await supabase.rpc(functionName, params);
  return handleDbResult(result);
}
