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

// GET /api/admin/region-plans/[id] - Get a specific region plan
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

    // Fetch the region plan with the given ID
    const { data: regionPlan, error } = await supabase
      .from('RegionSubscriptionPlan')
      .select('*, region:Region(*)')
      .eq('id', id)
      .single();

    if (error || !regionPlan) {
      return NextResponse.json({ error: "Region plan not found" }, { status: 404 });
    }

    return NextResponse.json(regionPlan);
  } catch (error) {
    console.error("Error fetching region plan:", error);
    return NextResponse.json({ error: "Failed to fetch region plan" }, { status: 500 });
  }
}

// PUT /api/admin/region-plans/[id] - Update a region plan
export async function PUT(
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
    const data = await request.json();
    
    const supabase = db();

    // Check if the region plan exists
    const { data: existingPlan } = await supabase
      .from('RegionSubscriptionPlan')
      .select('id')
      .eq('id', id)
      .single();

    if (!existingPlan) {
      return NextResponse.json({ error: "Region plan not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.price !== undefined) updateData.price = parseFloat(data.price);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.stripePriceId !== undefined) updateData.stripePriceId = data.stripePriceId;

    // Update the region plan
    const { data: updatedPlan, error } = await supabase
      .from('RegionSubscriptionPlan')
      .update(updateData)
      .eq('id', id)
      .select('*, region:Region(*)')
      .single();

    if (error) throw error;

    return NextResponse.json(updatedPlan);
  } catch (error) {
    console.error("Error updating region plan:", error);
    return NextResponse.json({ error: "Failed to update region plan" }, { status: 500 });
  }
}

// DELETE /api/admin/region-plans/[id] - Delete a region plan
export async function DELETE(
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
    const { data: existingPlan } = await supabase
      .from('RegionSubscriptionPlan')
      .select('id')
      .eq('id', id)
      .single();

    if (!existingPlan) {
      return NextResponse.json({ error: "Region plan not found" }, { status: 404 });
    }

    // Check if the plan has active subscriptions
    const { data: activeSubscriptions, count } = await supabase
      .from('UserRegionSubscription')
      .select('id', { count: 'exact' })
      .eq('regionPlanId', id)
      .eq('status', 'ACTIVE');

    if (count && count > 0) {
      return NextResponse.json({
        error: "Cannot delete a plan with active subscriptions",
        activeSubscriptionsCount: count
      }, { status: 400 });
    }

    // Delete the region plan
    const { error } = await supabase
      .from('RegionSubscriptionPlan')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Region plan deleted successfully" });
  } catch (error) {
    console.error("Error deleting region plan:", error);
    return NextResponse.json({ error: "Failed to delete region plan" }, { status: 500 });
  }
}