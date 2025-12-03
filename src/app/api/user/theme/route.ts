/**
 * User Theme Route
 * GET: Returns user's theme preference (or default for unauthenticated users)
 * PATCH: Updates theme preference (proxied to backend, requires auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { proxyToBackend } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

/**
 * Check if user has an auth token
 */
async function hasAuthToken(): Promise<boolean> {
  const cookieStore = await cookies();

  // Check for Supabase auth cookie
  const supabaseAuth = cookieStore.get('sb-zcpoepdmjhewkspfwhwn-auth-token')?.value;
  if (supabaseAuth) {
    try {
      const parsed = JSON.parse(supabaseAuth);
      return !!parsed.access_token;
    } catch {
      return false;
    }
  }

  return !!cookieStore.get('sb-access-token')?.value;
}

/**
 * GET /api/user/theme
 * For unauthenticated users, return default theme without hitting backend
 * For authenticated users, proxy to backend
 */
export async function GET(request: NextRequest) {
  const isAuthenticated = await hasAuthToken();

  // For unauthenticated users, return default immediately
  // This prevents errors when backend is down
  if (!isAuthenticated) {
    return NextResponse.json({ theme: 'system' });
  }

  // For authenticated users, try to get from backend
  // But still gracefully handle failures
  try {
    return await proxyToBackend(request);
  } catch (error) {
    console.error('Failed to fetch theme from backend:', error);
    return NextResponse.json({ theme: 'system' });
  }
}

/**
 * PATCH /api/user/theme
 * Always proxy to backend (requires authentication)
 */
export async function PATCH(request: NextRequest) {
  return proxyToBackend(request);
}
