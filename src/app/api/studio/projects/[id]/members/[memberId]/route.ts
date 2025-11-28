import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for updating a project member
const updateMemberSchema = z.object({
  role: z.string().optional(),
  notes: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

// Helper function to check if a studio has access to a project member
async function canAccessProjectMember(userId: string, projectId: string, memberId: string) {
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

  const projectMemberResult = await supabase
    .from('ProjectMember')
    .select(`
      *,
      Project (*)
    `)
    .eq('id', memberId)
    .eq('projectId', projectId)
    .single();

  const projectMember = handleDbOptional(projectMemberResult);

  if (!projectMember) {
    return false;
  }

  return projectMember.Project.studioId === studio.id;
}

// GET /api/studio/projects/[id]/members/[memberId] - Get a specific project member
export async function GET(
  request: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: projectId, memberId } = params;

    if (!await canAccessProjectMember(session.profile.id, projectId, memberId)) {
      return NextResponse.json({ error: "Unauthorized to access this project member" }, { status: 403 });
    }

    const supabase = db();

    const memberResult = await supabase
      .from('ProjectMember')
      .select(`
        *,
        Profile (
          *,
          User (
            firstName,
            lastName,
            email
          ),
          Skill (*)
        ),
        Project (*)
      `)
      .eq('id', memberId)
      .single();

    const member = handleDbOptional(memberResult);

    if (!member) {
      return NextResponse.json({ error: "Project member not found" }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error fetching project member:", error);
    return NextResponse.json({ error: "Failed to fetch project member" }, { status: 500 });
  }
}

// PATCH /api/studio/projects/[id]/members/[memberId] - Update a specific project member
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: projectId, memberId } = params;
    const body = await request.json();

    if (!await canAccessProjectMember(session.profile.id, projectId, memberId)) {
      return NextResponse.json({ error: "Unauthorized to access this project member" }, { status: 403 });
    }

    // Validate input data
    const result = updateMemberSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const validatedData = result.data;

    const supabase = db();

    // Update the project member
    const updatedMemberResult = await supabase
      .from('ProjectMember')
      .update(validatedData)
      .eq('id', memberId)
      .select(`
        *,
        Profile (
          *,
          User (
            firstName,
            lastName,
            email
          )
        )
      `)
      .single();

    const updatedMember = handleDbResult(updatedMemberResult);

    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error("Error updating project member:", error);
    return NextResponse.json({ error: "Failed to update project member" }, { status: 500 });
  }
}

// DELETE /api/studio/projects/[id]/members/[memberId] - Remove a member from a project
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: projectId, memberId } = params;

    if (!await canAccessProjectMember(session.profile.id, projectId, memberId)) {
      return NextResponse.json({ error: "Unauthorized to access this project member" }, { status: 403 });
    }

    const supabase = db();

    // Delete the project member
    await supabase
      .from('ProjectMember')
      .delete()
      .eq('id', memberId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error removing project member:", error);
    return NextResponse.json({ error: "Failed to remove project member" }, { status: 500 });
  }
}
