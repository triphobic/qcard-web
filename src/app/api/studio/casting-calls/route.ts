import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for creating a casting call (updated to include regionId)
const castingCallSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }),
  requirements: z.string().optional(),
  compensation: z.string().optional(),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  locationId: z.string().optional(),
  regionId: z.string().optional(), // New field for region
  projectId: z.string().optional(),
  skillIds: z.array(z.string()).optional(),
});

// GET /api/studio/casting-calls - Get all casting calls for the authenticated studio
export async function GET() {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();

    // Find the user and their tenant
    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== "STUDIO") {
      return NextResponse.json({ error: "Only studio accounts can access this endpoint" }, { status: 403 });
    }

    // Find the studio associated with this tenant
    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.Tenant.id)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    // Get all casting calls for this studio
    const castingCallsResult = await supabase
      .from('CastingCall')
      .select(`
        *,
        Location (
          *,
          Region (*)
        ),
        Region (*),
        Application (
          *,
          Profile (
            *,
            User (
              firstName,
              lastName,
              email
            )
          )
        ),
        Project (*)
      `)
      .eq('studioId', studio.id)
      .order('createdAt', { ascending: false });

    const castingCalls = handleDbResult(castingCallsResult);

    // Get skills for each casting call (many-to-many relationship)
    const castingCallsWithSkills = await Promise.all(castingCalls.map(async (call: any) => {
      const skillsResult = await supabase
        .from('_CastingCallToSkill')
        .select(`
          Skill:B (*)
        `)
        .eq('A', call.id);

      const skillsData = handleDbResult(skillsResult);
      const skills = skillsData.map((s: any) => s.Skill);

      return {
        ...call,
        location: call.Location,
        region: call.Region || call.Location?.Region,
        skillsRequired: skills,
        applications: call.Application,
        project: call.Project,
        Skill: skills
      };
    }));

    return NextResponse.json(castingCallsWithSkills);
  } catch (error) {
    console.error("Error fetching casting calls:", error);
    return NextResponse.json({
      error: "Failed to fetch casting calls",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// POST /api/studio/casting-calls - Create a new casting call
export async function POST(request: Request) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate input data
    const result = castingCallSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const validatedData = result.data;

    const supabase = db();

    // Find the user and their tenant
    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== "STUDIO") {
      return NextResponse.json({ error: "Only studio accounts can create casting calls" }, { status: 403 });
    }

    // Find the studio associated with this tenant
    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.Tenant.id)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    // If location is provided but no region, try to get the region from the location
    let regionId = validatedData.regionId;
    if (!regionId && validatedData.locationId) {
      const locationResult = await supabase
        .from('Location')
        .select('regionId')
        .eq('id', validatedData.locationId)
        .single();

      const location = handleDbOptional(locationResult);

      if (location?.regionId) {
        regionId = location.regionId;
      }
    }

    // Generate a unique ID for the casting call
    const castingCallId = crypto.randomUUID();

    // Create the casting call
    const castingCallData: any = {
      id: castingCallId,
      title: validatedData.title,
      description: validatedData.description,
      requirements: validatedData.requirements,
      compensation: validatedData.compensation,
      startDate: validatedData.startDate?.toISOString(),
      endDate: validatedData.endDate?.toISOString(),
      studioId: studio.id,
      locationId: validatedData.locationId,
      regionId: regionId,
      projectId: validatedData.projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const castingCallResult = await supabase
      .from('CastingCall')
      .insert(castingCallData)
      .select(`
        *,
        Location (
          *,
          Region (*)
        ),
        Region (*),
        Project (*)
      `)
      .single();

    const castingCall = handleDbResult(castingCallResult);

    // Connect skills if skillIds are provided
    if (validatedData.skillIds && validatedData.skillIds.length > 0) {
      const skillConnections = validatedData.skillIds.map(skillId => ({
        A: castingCallId,
        B: skillId
      }));

      await supabase
        .from('_CastingCallToSkill')
        .insert(skillConnections);

      // Fetch the skills to return
      const skillsResult = await supabase
        .from('Skill')
        .select('*')
        .in('id', validatedData.skillIds);

      const skills = handleDbResult(skillsResult);

      // Return the casting call with properly mapped fields for frontend compatibility
      return NextResponse.json({
        ...castingCall,
        location: castingCall.Location,
        region: castingCall.Region || castingCall.Location?.Region,
        skillsRequired: skills,
        project: castingCall.Project,
        Skill: skills
      }, { status: 201 });
    }

    // Return the casting call with properly mapped fields for frontend compatibility
    return NextResponse.json({
      ...castingCall,
      location: castingCall.Location,
      region: castingCall.Region || castingCall.Location?.Region,
      skillsRequired: [],
      project: castingCall.Project,
      Skill: []
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating casting call:", error);
    return NextResponse.json({
      error: "Failed to create casting call",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
