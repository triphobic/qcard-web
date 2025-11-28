import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = db();

    // Check if the user is authorized (admin only)
    const session = await getSession();
    if (!session?.profile?.isAdmin && session?.profile?.role !== 'ADMIN' && session?.profile?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    // Get users with their associated tenant data
    const { data: usersFromSupabase, count } = await supabase
      .from('User')
      .select(`
        id,
        email,
        firstName,
        lastName,
        role,
        tenantId,
        Tenant (
          id,
          name,
          type
        ),
        createdAt,
        updatedAt
      `, { count: 'exact' })
      .order('createdAt', { ascending: false })
      .limit(10);

    return NextResponse.json({
      usersFromSupabase: usersFromSupabase || [],
      counts: {
        supabase: count || 0
      },
      message: 'Successfully migrated from Prisma to Supabase SDK'
    });
  } catch (error) {
    console.error('Error in debug users route:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}