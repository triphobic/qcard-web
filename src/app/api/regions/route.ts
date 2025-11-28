import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import crypto from 'crypto';

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

// GET /api/regions - Get all regions
export async function GET(request: Request) {
  try {
    const supabase = db();

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('includeStats') === 'true';
    
    // If includeStats is true, include counts of related records
    if (includeStats) {
      console.log('Fetching regions with stats using Supabase SDK');

      // Fetch all regions
      const regionsResult = await supabase
        .from('Region')
        .select('*')
        .order('name', { ascending: true });

      const regions = handleDbResult(regionsResult);

      // For each region, fetch counts for related tables
      const formattedRegions = await Promise.all(
        regions.map(async (region: any) => {
          const [locationsResult, castingCallsResult, profileRegionsResult, studioRegionsResult] = await Promise.all([
            supabase.from('Location').select('id', { count: 'exact', head: true }).eq('regionId', region.id),
            supabase.from('CastingCall').select('id', { count: 'exact', head: true }).eq('regionId', region.id),
            supabase.from('ProfileRegion').select('id', { count: 'exact', head: true }).eq('regionId', region.id),
            supabase.from('StudioRegion').select('id', { count: 'exact', head: true }).eq('regionId', region.id),
          ]);

          return {
            ...region,
            _count: {
              locations: locationsResult.count || 0,
              castingCalls: castingCallsResult.count || 0,
              profiles: profileRegionsResult.count || 0,
              studios: studioRegionsResult.count || 0
            }
          };
        })
      );

      return NextResponse.json(formattedRegions);
    }
    
    // Regular query without stats
    console.log('Fetching regions using Supabase SDK');
    const regionsResult = await supabase
      .from('Region')
      .select('*')
      .order('name', { ascending: true });

    const regions = handleDbResult(regionsResult);

    return NextResponse.json(regions);
  } catch (error) {
    console.error("Error fetching regions:", error);
    return NextResponse.json({ error: "Failed to fetch regions" }, { status: 500 });
  }
}

// POST /api/regions - Create a new region (super admin only)
export async function POST(request: Request) {
  try {
    // Check authorization
    const authResult = await requireSuperAdmin();
    console.log('SuperAdmin check result:', { authorized: authResult.authorized, userId: authResult.session?.profile?.id });
    
    if (!authResult.authorized) {
      console.log('Not authorized to create region:', authResult.message);
      return NextResponse.json({ error: authResult.message }, { status: authResult.status });
    }
    
    let data;
    try {
      data = await request.json();
      console.log('Received region creation data:', data);
    } catch (parseError) {
      console.error('Error parsing request JSON:', parseError);
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 });
    }
    
    if (!data || !data.name) {
      console.log('Missing region name in request');
      return NextResponse.json({ error: "Region name is required" }, { status: 400 });
    }
    
    // Create new region using Prisma's create method instead of raw SQL
    const id = crypto.randomUUID();
    const now = new Date(); // Use a Date object, not a string
    
    console.log('Creating new region using Supabase SDK:', { id, name: data.name });
    try {
      const regionResult = await supabase
        .from('Region')
        .insert({
          id,
          name: data.name,
          description: data.description || null,
          createdAt: now,
          updatedAt: now
        })
        .select()
        .single();

      const region = handleDbResult(regionResult);

      console.log('Region created successfully:', { id: region.id, name: region.name });
      return NextResponse.json(region);
    } catch (dbError: any) {
      console.error('Database error creating region:', dbError);
      // Check for unique constraint violation
      if (dbError.code === 'P2002') {
        return NextResponse.json({ 
          error: "A region with this name already exists", 
          code: "DUPLICATE_NAME"
        }, { status: 409 });
      }
      throw dbError;
    }
  } catch (error) {
    console.error("Error creating region:", error);
    return NextResponse.json({ error: "Failed to create region" }, { status: 500 });
  }
}