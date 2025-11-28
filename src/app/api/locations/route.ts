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

export async function GET(request: Request) {
  try {
    const supabase = db();

    const { searchParams } = new URL(request.url);
    const includeRegions = searchParams.get('includeRegions') === 'true';
    const regionId = searchParams.get('regionId');
    
    // Build the query
    let query: any = {
      orderBy: { name: 'asc' },
    };
    
    // Include region information if requested - uncomment when region relationship is added to schema
    // if (includeRegions) {
    //   query.include = { region: true };
    // }
    
    // Filter by region if regionId is provided
    if (regionId) {
      query.where = { regionId };
    }
    
    
    console.log('Fetching locations with Supabase SDK');
    const locationsResult = await supabase
      .from('Location')
      .select('*');
    const locations = handleDbResult(locationsResult);
    
    return NextResponse.json(locations);
  } catch (error) {
    console.error("Error fetching locations:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    if (!data.name) {
      return NextResponse.json({ error: "Location name is required" }, { status: 400 });
    }
    
    // Check if regionId is provided and verify super admin status
    if (data.regionId) {
      // Only super admins can assign regions
      const authCheck = await requireSuperAdmin();
      if (!authCheck.authorized) {
        return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
      }
      
      // Verify the region exists
      try {

        console.log('Validating region existence with Supabase SDK');
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
    
    // Create the location using Prisma's create method instead of raw SQL
    const id = crypto.randomUUID();
    const now = new Date(); // Use a Date object, not a string
    
    // Insert the location with or without regionId
    console.log('Creating location with Supabase SDK:', { id, name: data.name, regionId: data.regionId });

    const locationResult = await supabase
      .from('Location')
      .insert({
        id,
        name: data.name,
        regionId: data.regionId || null,
        createdAt: now,
        updatedAt: now
      })
      .select()
      .single();

    const location = handleDbResult(locationResult);

    return NextResponse.json(location);
  } catch (error) {
    console.error("Error creating location:", error);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}