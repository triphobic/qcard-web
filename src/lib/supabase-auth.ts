/**
 * Supabase Auth Helpers
 *
 * Server-side authentication utilities for Supabase Auth
 */

import { createServerClient } from './supabase';
import { redirect } from 'next/navigation';
import { db, handleDbOptional } from './supabase-db';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';
export type TenantType = 'TALENT' | 'STUDIO';

/**
 * Extended user session with application data
 */
export interface AppSession {
  user: User;
  profile: {
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
  } | null;
}

/**
 * Get the current authenticated user from Supabase
 * Returns null if not authenticated
 */
export async function getUser(): Promise<User | null> {
  const supabase = createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Get the current session with application profile data
 * Returns null if not authenticated
 */
export async function getSession(): Promise<AppSession | null> {
  const user = await getUser();

  if (!user) {
    return null;
  }

  // Get application-specific user data from our database
  const supabase = db();
  const result = await supabase
    .from('User')
    .select(`
      *,
      Tenant (*)
    `)
    .eq('id', user.id)
    .single();

  const appUser = handleDbOptional(result);

  if (!appUser) {
    console.warn(`User ${user.id} authenticated but not found in database`);
    return {
      user,
      profile: null,
    };
  }

  return {
    user,
    profile: {
      id: appUser.id,
      email: appUser.email,
      firstName: appUser.firstName,
      lastName: appUser.lastName,
      phoneNumber: appUser.phoneNumber,
      role: appUser.role as UserRole,
      tenantType: appUser.Tenant?.tenantType as TenantType | null,
      tenantId: appUser.tenantId,
      isAdmin: appUser.role === 'ADMIN' || appUser.role === 'SUPER_ADMIN',
      isSuperAdmin: appUser.role === 'SUPER_ADMIN',
    },
  };
}

/**
 * Require authentication - redirects to sign-in if not authenticated
 * @param redirectTo - URL to redirect to after sign-in (defaults to current path)
 */
export async function requireAuth(redirectTo?: string): Promise<AppSession> {
  const session = await getSession();

  if (!session) {
    const callbackUrl = redirectTo || '/sign-in';
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return session;
}

/**
 * Require admin role - redirects to unauthorized if not admin
 */
export async function requireAdmin(): Promise<AppSession> {
  const session = await requireAuth();

  if (!session.profile || !session.profile.isAdmin) {
    redirect('/unauthorized');
  }

  return session;
}

/**
 * Require super admin role - redirects to unauthorized if not super admin
 */
export async function requireSuperAdmin(): Promise<AppSession> {
  const session = await requireAuth();

  if (!session.profile || !session.profile.isSuperAdmin) {
    redirect('/unauthorized');
  }

  return session;
}

/**
 * Get studio ID from session
 */
export async function getStudioIdFromSession(): Promise<string | null> {
  const session = await getSession();

  if (!session?.profile) {
    return null;
  }

  // If user is a studio tenant, return their tenantId
  if (session.profile.tenantType === 'STUDIO' && session.profile.tenantId) {
    return session.profile.tenantId;
  }

  // Otherwise try to find their studio from database
  const supabase = db();
  const result = await supabase
    .from('Studio')
    .select('id')
    .eq('userId', session.profile.id)
    .single();

  const studio = handleDbOptional(result);
  return studio?.id || null;
}

/**
 * Check if user is authenticated (without redirecting)
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getUser();
  return user !== null;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = createServerClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}
