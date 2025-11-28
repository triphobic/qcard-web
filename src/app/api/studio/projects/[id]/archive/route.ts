import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for archive/unarchive requests
const archiveRequestSchema = z.object({
  archive: z.boolean().default(true), // true to archive, false to unarchive
});

// Helper function to check if a studio has access to a project
async function canAccessProject(userId: string, projectId: string) {
  const supabase = db();

  const userResult = await supabase
    .from('User')
    .select(`
      *,
      Tenant (*)
    `)
    .eq('id', userId)
    .single();

  const user = handleDbOptional(userResult);

  if (!user?.Tenant || user.Tenant.type !== "STUDIO") {
    return false;
  }

  const studioResult = await supabase
    .from('Studio')
    .select('*')
    .eq('tenantId', user.Tenant.id)
    .single();

  const studio = handleDbOptional(studioResult);

  if (!studio) {
    return false;
  }

  const projectResult = await supabase
    .from('Project')
    .select('*')
    .eq('id', projectId)
    .eq('studioId', studio.id)
    .single();

  const project = handleDbOptional(projectResult);

  return !!project;
}

// PATCH /api/studio/projects/[id]/archive - Archive or unarchive a project
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projectId = params.id;
    const body = await request.json();

    // Validate input data
    const result = archiveRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const { archive } = result.data;

    // Check if the user has access to this project
    if (!await canAccessProject(session.profile.id, projectId)) {
      return NextResponse.json({ error: "Unauthorized to access this project" }, { status: 403 });
    }

    const supabase = db();

    // Get the current project to check its status
    const projectResult = await supabase
      .from('Project')
      .select('*')
      .eq('id', projectId)
      .single();

    const project = handleDbOptional(projectResult);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // If project is already in the desired archive state, return early
    if (project.isArchived === archive) {
      return NextResponse.json({
        message: archive ? "Project is already archived" : "Project is already active",
        project
      });
    }

    // Update the project archive status
    const updatedProjectResult = await supabase
      .from('Project')
      .update({
        isArchived: archive,
        updatedAt: new Date().toISOString()
      })
      .eq('id', projectId)
      .select()
      .single();

    const updatedProject = handleDbResult(updatedProjectResult);

    return NextResponse.json({
      message: archive ? "Project archived successfully" : "Project unarchived successfully",
      project: updatedProject
    });
  } catch (error) {
    console.error("Error archiving/unarchiving project:", error);
    return NextResponse.json({
      error: "Failed to update project archive status",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
