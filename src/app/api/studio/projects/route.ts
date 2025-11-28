import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for creating a project
const projectSchema = z.object({
  title: z.string(),
  description: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z.string().optional().default("PLANNING"),
});

// GET /api/studio/projects - Get all projects for the authenticated studio
export async function GET(request: Request) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();

    // Get URL search parameters
    const { searchParams } = new URL(request.url);
    const showArchived = searchParams.get('archived') === 'true';

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

    // Get projects for this studio
    const projectsResult = await supabase
      .from('Project')
      .select(`
        *,
        ProjectMember (
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
        CastingCall (
          id,
          title,
          status,
          createdAt,
          updatedAt
        )
      `)
      .eq('studioId', studio.id)
      .order('createdAt', { ascending: false });

    const projects = handleDbResult(projectsResult);

    // Count applications for each casting call
    const projectsWithCounts = await Promise.all(projects.map(async (project) => {
      const castingCallsWithCounts = await Promise.all((project.CastingCall || []).map(async (call: any) => {
        const countResult = await supabase
          .from('Application')
          .select('id', { count: 'exact', head: true })
          .eq('castingCallId', call.id);

        return {
          ...call,
          _count: {
            applications: countResult.count || 0
          }
        };
      }));

      return {
        ...project,
        members: project.ProjectMember?.map((member: any) => ({
          ...member,
          profile: {
            ...member.Profile,
            user: member.Profile?.User
          }
        })),
        castingCalls: castingCallsWithCounts
      };
    }));

    return NextResponse.json(projectsWithCounts);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({
      error: "Failed to fetch projects",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// POST /api/studio/projects - Create a new project
export async function POST(request: Request) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate input data
    const result = projectSchema.safeParse(body);
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
      return NextResponse.json({ error: "Only studio accounts can create projects" }, { status: 403 });
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

    // Prepare the data object
    const projectData: any = {
      id: crypto.randomUUID(),
      title: validatedData.title,
      studioId: studio.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Only add optional fields if they're not undefined or null
    if (validatedData.description !== undefined && validatedData.description !== null) {
      projectData.description = validatedData.description;
    }

    if (validatedData.status !== undefined && validatedData.status !== null) {
      projectData.status = validatedData.status;
    }

    // Handle dates - convert strings to ISO strings if present
    if (validatedData.startDate) {
      try {
        projectData.startDate = new Date(validatedData.startDate).toISOString();
      } catch (e) {
        console.error("Invalid start date:", validatedData.startDate, e);
      }
    }

    if (validatedData.endDate) {
      try {
        projectData.endDate = new Date(validatedData.endDate).toISOString();
      } catch (e) {
        console.error("Invalid end date:", validatedData.endDate, e);
      }
    }

    console.log("Creating project with data:", projectData);

    // Create the project
    const projectResult = await supabase
      .from('Project')
      .insert(projectData)
      .select()
      .single();

    const project = handleDbResult(projectResult);

    // Return a structured response with properly initialized empty arrays for relationships
    // This ensures consistency with the GET response and prevents errors in the project detail page
    const structuredResponse = {
      ...project,
      castingCalls: [],
      members: [],
      talentRequirements: [],
      ProjectMember: [],
      CastingCall: [],
    };

    return NextResponse.json(structuredResponse, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({
      error: "Failed to create project",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
