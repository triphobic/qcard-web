import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for project updates
const projectUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z.string().optional(),
  isArchived: z.boolean().optional(),
});

// GET /api/studio/projects/[id] - Get a specific project
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = params.id;

  if (!projectId) {
    return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
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

    // Get the project with related data
    const projectResult = await supabase
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
          *,
          Location (*),
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
          )
        )
      `)
      .eq('id', projectId)
      .eq('studioId', studio.id)
      .single();

    const project = handleDbOptional(projectResult);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Map fields for frontend compatibility
    const mappedProject = {
      ...project,
      members: project.ProjectMember?.map((member: any) => ({
        ...member,
        profile: {
          ...member.Profile,
          user: member.Profile?.User
        }
      })),
      castingCalls: project.CastingCall?.map((call: any) => ({
        id: call.id,
        title: call.title,
        status: call.status,
        createdAt: call.createdAt,
        updatedAt: call.updatedAt,
        location: call.Location,
        applications: call.Application || [],
        // Include the application count
        _count: {
          applications: call.Application?.length || 0
        }
      }))
    };

    return NextResponse.json(mappedProject);
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json({
      error: "Failed to fetch project",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// PUT /api/studio/projects/[id] - Update a project
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = params.id;

  if (!projectId) {
    return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
  }

  try {
    const body = await request.json();

    // Validate input data
    const result = projectUpdateSchema.safeParse(body);
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
      return NextResponse.json({ error: "Only studio accounts can update projects" }, { status: 403 });
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

    // Check if the project exists and belongs to this studio
    const existingProjectResult = await supabase
      .from('Project')
      .select('*')
      .eq('id', projectId)
      .eq('studioId', studio.id)
      .single();

    const existingProject = handleDbOptional(existingProjectResult);

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found or you don't have permission to update it" }, { status: 404 });
    }

    // Prepare the data object with proper types
    const updateData: Record<string, any> = {
      ...validatedData,
      updatedAt: new Date().toISOString()
    };

    // Handle dates if provided - convert strings to ISO strings
    if (validatedData.startDate) {
      updateData.startDate = new Date(validatedData.startDate).toISOString();
    }

    if (validatedData.endDate) {
      updateData.endDate = new Date(validatedData.endDate).toISOString();
    }

    // Update the project
    const updatedProjectResult = await supabase
      .from('Project')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single();

    const updatedProject = handleDbResult(updatedProjectResult);

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json({
      error: "Failed to update project",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// DELETE /api/studio/projects/[id] - Archive a project
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = params.id;

  if (!projectId) {
    return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
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
      return NextResponse.json({ error: "Only studio accounts can delete projects" }, { status: 403 });
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

    // Check if the project exists and belongs to this studio
    const existingProjectResult = await supabase
      .from('Project')
      .select('*')
      .eq('id', projectId)
      .eq('studioId', studio.id)
      .single();

    const existingProject = handleDbOptional(existingProjectResult);

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found or you don't have permission to delete it" }, { status: 404 });
    }

    // Instead of actually deleting, we archive the project
    const archivedProjectResult = await supabase
      .from('Project')
      .update({
        isArchived: true,
        updatedAt: new Date().toISOString()
      })
      .eq('id', projectId)
      .select()
      .single();

    const archivedProject = handleDbResult(archivedProjectResult);

    return NextResponse.json({
      message: "Project archived successfully",
      project: archivedProject
    });
  } catch (error) {
    console.error("Error archiving project:", error);
    return NextResponse.json({
      error: "Failed to archive project",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
