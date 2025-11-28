import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for adding a member to a project
const addMemberSchema = z.object({
  profileId: z.string().uuid({ message: "Invalid profile ID format" }),
  role: z.string().optional(),
  notes: z.string().optional(),
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

// GET /api/studio/projects/[id]/members - Get all members of a project
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = params;

    if (!await canAccessProject(session.profile.id, id)) {
      return NextResponse.json({ error: "Unauthorized to access this project" }, { status: 403 });
    }

    const supabase = db();

    const membersResult = await supabase
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
        )
      `)
      .eq('projectId', id);

    const members = handleDbResult(membersResult);

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error fetching project members:", error);
    return NextResponse.json({ error: "Failed to fetch project members" }, { status: 500 });
  }
}

// POST /api/studio/projects/[id]/members - Add a new member to a project
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: projectId } = params;
    const body = await request.json();

    if (!await canAccessProject(session.profile.id, projectId)) {
      return NextResponse.json({ error: "Unauthorized to access this project" }, { status: 403 });
    }

    // Validate input data
    const result = addMemberSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const { profileId, role, notes } = result.data;

    const supabase = db();

    // Check if profile exists
    const profileResult = await supabase
      .from('Profile')
      .select('*')
      .eq('id', profileId)
      .single();

    const profile = handleDbOptional(profileResult);

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Check if member already exists in this project
    const existingMemberResult = await supabase
      .from('ProjectMember')
      .select('*')
      .eq('projectId', projectId)
      .eq('profileId', profileId)
      .single();

    const existingMember = handleDbOptional(existingMemberResult);

    if (existingMember) {
      return NextResponse.json(
        { error: "This person is already a member of the project" },
        { status: 400 }
      );
    }

    // Add member to project
    const memberData: any = {
      id: crypto.randomUUID(),
      projectId,
      profileId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (role) memberData.role = role;
    if (notes) memberData.notes = notes;

    const memberResult = await supabase
      .from('ProjectMember')
      .insert(memberData)
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

    const member = handleDbResult(memberResult);

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("Error adding project member:", error);
    return NextResponse.json({ error: "Failed to add project member" }, { status: 500 });
  }
}
