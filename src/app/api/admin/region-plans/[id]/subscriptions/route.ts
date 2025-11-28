import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Helper function to check if user is an admin
async function requireAdmin() {
  const session = await getSession();
  
  if (!session || !session.profile) {
    return { authorized: false, status: 401, message: "Unauthorized" };
  }
  
  if (session.profile.role !== 'ADMIN' && session.profile.role !== 'SUPER_ADMIN') {
    return { authorized: false, status: 403, message: "Forbidden - Admin access required" };
  }
  
  return { authorized: true, session };
}

// GET /api/admin/region-plans/[id]/subscriptions - Get all subscriptions for a region plan
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authorization
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    
    const id = params.id;
    
    const supabase = db();

    // Check if the region plan exists
    const { data: regionPlan } = await supabase
      .from('RegionSubscriptionPlan')
      .select('id')
      .eq('id', id)
      .single();

    if (!regionPlan) {
      return NextResponse.json({ error: "Region plan not found" }, { status: 404 });
    }

    // Get all subscriptions for this region plan
    const { data: subscriptions, error } = await supabase
      .from('UserRegionSubscription')
      .select(`
        *,
        user:User (
          id,
          email,
          firstName,
          lastName
        )
      `)
      .eq('regionPlanId', id)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    return NextResponse.json(subscriptions || []);
  } catch (error) {
    console.error(`Error fetching subscriptions for region plan ${params.id}:`, error);
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
  }
}