import { db, handleDbOptional, handleDbResult, generateId, now } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/talent/casting-calls - Get all casting calls available to talent
export async function GET(request: Request) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();

    // Find the user and check if they have a talent profile
    const userResult = await supabase
      .from('User')
      .select(`
        id,
        Profile (
          id,
          ProfileRegion (
            regionId,
            Region (
              id,
              name
            )
          )
        )
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Profile) {
      return NextResponse.json({ error: "Talent profile not found" }, { status: 404 });
    }

    // Get search parameters from the URL
    const { searchParams } = new URL(request.url);

    // Build the query for filtering
    let query = supabase
      .from('CastingCall')
      .select(`
        id,
        title,
        description,
        requirements,
        compensation,
        startDate,
        endDate,
        status,
        createdAt,
        locationId,
        regionId,
        studioId,
        projectId,
        Location (
          id,
          name,
          regionId,
          Region:regionId (
            id,
            name
          )
        ),
        Region:regionId (
          id,
          name
        ),
        CastingCallSkill (
          Skill (
            id,
            name
          )
        ),
        Studio (
          id,
          name
        ),
        Project (
          id,
          title
        ),
        Application!Application_castingCallId_fkey (
          id,
          status
        )
      `)
      .eq('status', 'OPEN');

    // Optional filters
    const locationId = searchParams.get('locationId');
    if (locationId) {
      query = query.eq('locationId', locationId);
    }

    const regionId = searchParams.get('regionId');
    if (regionId) {
      query = query.eq('regionId', regionId);
    }

    const startDate = searchParams.get('startDate');
    if (startDate) {
      query = query.gte('startDate', new Date(startDate).toISOString());
    }

    const endDate = searchParams.get('endDate');
    if (endDate) {
      query = query.lte('endDate', new Date(endDate).toISOString());
    }

    // Get talent's regions to filter calls by region if no specific region is selected
    const talentRegionIds = (user.Profile as any).ProfileRegion?.map((pr: any) => pr.regionId) || [];

    // If showAllRegions param is not true AND no specific region is requested
    // filter by the talent's regions
    const showAllRegions = searchParams.get('showAllRegions') === 'true';
    if (!showAllRegions && !regionId && talentRegionIds.length > 0) {
      query = query.in('regionId', talentRegionIds);
    }

    // Execute the query with ordering
    query = query.order('createdAt', { ascending: false });

    const castingCallsResult = await query;
    const castingCalls = handleDbResult(castingCallsResult);

    const profileId = (user.Profile as any).id;

    // Filter applications for the current talent
    const formattedCastingCalls = castingCalls.map((call: any) => {
      // Filter applications to only include those from this talent
      const userApplications = call.Application?.filter((app: any) =>
        app.profileId === profileId
      ) || [];

      return {
        id: call.id,
        title: call.title,
        description: call.description,
        requirements: call.requirements,
        compensation: call.compensation,
        startDate: call.startDate,
        endDate: call.endDate,
        status: call.status,
        location: call.Location ? {
          id: call.Location.id,
          name: call.Location.name,
          region: call.Location.Region ? {
            id: call.Location.Region.id,
            name: call.Location.Region.name
          } : null
        } : null,
        region: call.Region ? {
          id: call.Region.id,
          name: call.Region.name,
        } : null,
        skills: call.CastingCallSkill?.map((ccs: any) => ({
          id: ccs.Skill.id,
          name: ccs.Skill.name,
        })) || [],
        studio: call.Studio,
        project: call.Project,
        // Check if the talent has already applied
        application: userApplications.length > 0 ? {
          id: userApplications[0].id,
          status: userApplications[0].status,
        } : null,
        createdAt: call.createdAt,
      };
    });

    return NextResponse.json({
      castingCalls: formattedCastingCalls,
      talentRegions: (user.Profile as any).ProfileRegion?.map((pr: any) => ({
        id: pr.Region.id,
        name: pr.Region.name
      })) || [],
      usingRegionFilter: !showAllRegions && !regionId && talentRegionIds.length > 0
    });
  } catch (error) {
    console.error("Error fetching casting calls for talent:", error);
    return NextResponse.json({
      error: "Failed to fetch casting calls",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
