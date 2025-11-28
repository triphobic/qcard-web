import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Helper function to check if user is a super admin
async function requireSuperAdmin() {
  const session = await getSession();
  
  if (!session || !session.profile) {
    return { authorized: false, status: 401, message: "Unauthorized" };
  }
  
  if (session.profile.role !== 'SUPER_ADMIN') {
    return { authorized: false, status: 403, message: "Forbidden - Super Admin access required" };
  }
  
  return { authorized: true, session };
}

// GET /api/locations/[id] - Get a specific location
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = db();
  try {
    console.log(`Fetching location ${params.id} with Supabase SDK`);
    const locationResult = await supabase
      .from('Location')
      .select('*')
      .eq('id', params.id)
      .single();

    const location = handleDbOptional(locationResult);

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    return NextResponse.json(location);
  } catch (error) {
    console.error(`Error fetching location ${params.id}:`, error);
    return NextResponse.json({ error: "Failed to fetch location" }, { status: 500 });
  }
}

// PATCH /api/locations/[id] - Update a location (super admin only for region assignment)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = db();
  try {
    const data = await request.json();
    
    // Check if this update includes a region change
    if (data.regionId !== undefined) {
      // Only super admins can change region assignments
      const authCheck = await requireSuperAdmin();
      if (!authCheck.authorized) {
        return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
      }
      
      // Validate that the region exists if not null
      if (data.regionId) {
        try {

          console.log(`Validating region ${data.regionId} existence with Supabase SDK`);
          const regionCountResult = await supabase
            .from('Region')
            .select('id', { count: 'exact', head: true })
            .eq('id', data.regionId);
          const regionCount = regionCountResult.count || 0;

          if (regionCount === 0) {
            return NextResponse.json({ error: "Region not found" }, { status: 404 });
          }
        } catch (err) {
          console.error('Error validating region:', err);
          return NextResponse.json({ error: "Failed to validate region" }, { status: 500 });
        }
      }
    }
    
    // Update location using Supabase
    const now = new Date(); // Use a Date object, not a string

    console.log(`Updating location ${params.id} with Supabase SDK`);
    const updateData: any = {
      name: data.name,
      updatedAt: now
    };

    // Only include regionId in update if it's provided
    if (data.regionId !== undefined) {
      updateData.regionId = data.regionId;
    }

    const locationResult = await supabase
      .from('Location')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    const location = handleDbResult(locationResult);

    return NextResponse.json(location);
  } catch (error) {
    console.error(`Error updating location ${params.id}:`, error);
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}

// DELETE /api/locations/[id] - Delete a location (super admin only)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = db();
  try {
    // Check authorization
    const authCheck = await requireSuperAdmin();
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
    }
    

    console.log(`Checking dependencies for location ${params.id} with Supabase SDK`);
    // Query each related table to count dependencies
    const [castingCallsResult, scenesResult, profilesResult, studiosResult] = await Promise.all([
      supabase.from('CastingCall').select('id', { count: 'exact', head: true }).eq('locationId', params.id),
      supabase.from('Scene').select('id', { count: 'exact', head: true }).eq('locationId', params.id),
      supabase.from('Profile').select('id', { count: 'exact', head: true }).eq('locationId', params.id),
      supabase.from('Studio').select('id', { count: 'exact', head: true }).eq('locationId', params.id),
    ]);

    const dependencyCounts = {
      _count: {
        CastingCall: castingCallsResult.count || 0,
        Scene: scenesResult.count || 0,
        Profile: profilesResult.count || 0,
        Studio: studiosResult.count || 0,
      }
    };
    
    // Prevent deletion if there are dependencies
    if (dependencyCounts && (
      dependencyCounts._count.CastingCall > 0 ||
      dependencyCounts._count.Scene > 0 ||
      dependencyCounts._count.Profile > 0 ||
      dependencyCounts._count.Studio > 0
    )) {
      return NextResponse.json({ 
        error: "Cannot delete location with dependencies", 
        dependencies: {
          castingCalls: dependencyCounts._count.CastingCall,
          scenes: dependencyCounts._count.Scene,
          profiles: dependencyCounts._count.Profile,
          studios: dependencyCounts._count.Studio
        }
      }, { status: 400 });
    }
    

    console.log(`Deleting location ${params.id} with Supabase SDK`);
    await supabase
      .from('Location')
      .delete()
      .eq('id', params.id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error deleting location ${params.id}:`, error);
    return NextResponse.json({ error: "Failed to delete location" }, { status: 500 });
  }
}