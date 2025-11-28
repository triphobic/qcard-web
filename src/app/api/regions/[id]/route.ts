import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
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

// GET /api/regions/[id]
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = db();
  try {
    const id = params.id;
    console.log(`GET /api/regions/${id} request received`);

    // Fetch the region
    const regionResult = await supabase
      .from('Region')
      .select('*')
      .eq('id', id)
      .single();

    const region = handleDbOptional(regionResult);

    if (!region) {
      return NextResponse.json({ error: "Region not found" }, { status: 404 });
    }

    // Query counts for related tables
    const [locationsResult, castingCallsResult, profileRegionsResult, studioRegionsResult] = await Promise.all([
      supabase.from('Location').select('id', { count: 'exact', head: true }).eq('regionId', id),
      supabase.from('CastingCall').select('id', { count: 'exact', head: true }).eq('regionId', id),
      supabase.from('ProfileRegion').select('id', { count: 'exact', head: true }).eq('regionId', id),
      supabase.from('StudioRegion').select('id', { count: 'exact', head: true }).eq('regionId', id),
    ]);

    // Format response to match the expected structure
    const formattedRegion = {
      ...region,
      _count: {
        locations: locationsResult.count || 0,
        castingCalls: castingCallsResult.count || 0,
        profiles: profileRegionsResult.count || 0,
        studios: studioRegionsResult.count || 0
      }
    };

    return NextResponse.json(formattedRegion);
  } catch (error) {
    console.error(`Error fetching region ${params.id}:`, error);
    return NextResponse.json({ error: "Failed to fetch region" }, { status: 500 });
  }
}

// PUT /api/regions/[id]
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = db();
  try {
    const id = params.id;
    console.log(`PUT /api/regions/${id} request received`);
    
    // Check authorization
    const auth = await requireSuperAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    
    // Parse and validate data
    const data = await request.json();
    
    if (!data.name) {
      return NextResponse.json({ error: "Region name is required" }, { status: 400 });
    }
    
    // Check if region exists
    const existingRegionResult = await supabase
      .from('Region')
      .select('*')
      .eq('id', id)
      .single();

    const existingRegion = handleDbOptional(existingRegionResult);

    if (!existingRegion) {
      return NextResponse.json({ error: "Region not found" }, { status: 404 });
    }
    
    // Update region using Supabase
    console.log('Updating region using Supabase SDK:', { id, name: data.name });
    const updatedRegionResult = await supabase
      .from('Region')
      .update({
        name: data.name,
        description: data.description || null,
        updatedAt: new Date()
      })
      .eq('id', id)
      .select()
      .single();

    const updatedRegion = handleDbResult(updatedRegionResult);
    
    return NextResponse.json(updatedRegion);
  } catch (error) {
    console.error(`Error updating region ${params.id}:`, error);
    return NextResponse.json({ error: "Failed to update region" }, { status: 500 });
  }
}

// DELETE /api/regions/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = db();
  try {
    const id = params.id;
    console.log(`DELETE /api/regions/${id} request received`);
    
    // Check authorization
    const authResult = await requireSuperAdmin();
    console.log('SuperAdmin check result:', { authorized: authResult.authorized, userId: authResult.session?.profile?.id });
    
    if (!authResult.authorized) {
      console.log('Not authorized to delete region:', authResult.message);
      return NextResponse.json({ error: authResult.message }, { status: authResult.status });
    }
    
    // Check if region exists
    console.log(`Checking if region ${id} exists`);
    const existingRegionResult = await supabase
      .from('Region')
      .select('*')
      .eq('id', id)
      .single();

    const existingRegion = handleDbOptional(existingRegionResult);

    if (!existingRegion) {
      console.log(`Region with ID ${id} not found`);
      return NextResponse.json({ error: "Region not found" }, { status: 404 });
    }

    // Query counts for dependencies
    const [locationsResult, castingCallsResult, profileRegionsResult, studioRegionsResult] = await Promise.all([
      supabase.from('Location').select('id', { count: 'exact', head: true }).eq('regionId', id),
      supabase.from('CastingCall').select('id', { count: 'exact', head: true }).eq('regionId', id),
      supabase.from('ProfileRegion').select('id', { count: 'exact', head: true }).eq('regionId', id),
      supabase.from('StudioRegion').select('id', { count: 'exact', head: true }).eq('regionId', id),
    ]);

    // Add count info to existingRegion
    (existingRegion as any)._count = {
      locations: locationsResult.count || 0,
      castingCalls: castingCallsResult.count || 0,
      ProfileRegion: profileRegionsResult.count || 0,
      StudioRegion: studioRegionsResult.count || 0,
    };

    console.log(`Found region: ${existingRegion.name} (${existingRegion.id})`);
    
    // Check for dependencies
    const totalDependencies = 
      existingRegion._count.locations + 
      existingRegion._count.castingCalls + 
      existingRegion._count.ProfileRegion + 
      existingRegion._count.StudioRegion;
    
    console.log(`Region dependencies:`, {
      locations: existingRegion._count.locations,
      castingCalls: existingRegion._count.castingCalls,
      profiles: existingRegion._count.ProfileRegion,
      studios: existingRegion._count.StudioRegion,
      total: totalDependencies
    });
    
    if (totalDependencies > 0) {
      console.log(`Cannot delete region ${id} due to dependencies`);
      return NextResponse.json({
        error: "Cannot delete region with existing dependencies",
        dependencies: {
          locations: existingRegion._count.locations,
          castingCalls: existingRegion._count.castingCalls,
          profiles: existingRegion._count.ProfileRegion,
          studios: existingRegion._count.StudioRegion
        }
      }, { status: 400 });
    }
    
    // Delete region
    console.log('Deleting region using Supabase SDK:', { id });
    try {
      await supabase
        .from('Region')
        .delete()
        .eq('id', id);
      console.log(`Region ${id} deleted successfully`);
      return NextResponse.json({ success: true });
    } catch (dbError: any) {
      console.error('Database error deleting region:', dbError);
      // If the error is not a "not found" error, rethrow it
      if (dbError.code !== 'P2025') {
        throw dbError;
      }
      return NextResponse.json({ error: "Region not found" }, { status: 404 });
    }
  } catch (error) {
    console.error(`Error deleting region ${params.id}:`, error);
    return NextResponse.json({ 
      error: "Failed to delete region",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}