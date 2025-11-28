
// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
/**
 * Auth Profile API Route
 *
 * Fetches application-specific user profile data
 * Used by client-side auth hooks to get full user profile
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { db, handleDbOptional } from '@/lib/supabase-db';

export async function GET(request: Request) {
  try {
    // Verify authentication
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get userId from query params (optional, defaults to current user)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || user.id;

    const dbClient = db();

    // Only allow users to fetch their own profile (unless admin)
    if (userId !== user.id) {
      // Check if current user is admin
      const currentUserResult = await dbClient
        .from('User')
        .select('role')
        .eq('id', user.id)
        .single();

      const currentUser = handleDbOptional(currentUserResult);

      if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPER_ADMIN')) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    // Fetch user profile from database
    const appUserResult = await dbClient
      .from('User')
      .select(`
        *,
        Tenant (*)
      `)
      .eq('id', userId)
      .single();

    const appUser = handleDbOptional(appUserResult);

    if (!appUser) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Return profile data
    const profile = {
      id: appUser.id,
      email: appUser.email,
      firstName: appUser.firstName,
      lastName: appUser.lastName,
      phoneNumber: appUser.phoneNumber,
      role: appUser.role,
      tenantType: appUser.Tenant?.tenantType || null,
      tenantId: appUser.tenantId,
      isAdmin: appUser.role === 'ADMIN' || appUser.role === 'SUPER_ADMIN',
      isSuperAdmin: appUser.role === 'SUPER_ADMIN',
    };

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
