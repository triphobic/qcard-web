import { db, handleDbOptional, handleDbResult, now, generateId } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for adding a talent to a scene
const addTalentSchema = z.object({
  profileId: z.string().min(1, { message: "Profile ID is required" }),
  role: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.string().default("CONFIRMED"),
});

// Helper function to check if a studio has access to a scene
async function canAccessScene(userId: string, sceneId: string) {
  const supabase = db();

  const userResult = await supabase
    .from('User')
    .select('*, Tenant(*)')
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

  const sceneResult = await supabase
    .from('Scene')
    .select('*, Project!inner(*)')
    .eq('id', sceneId)
    .eq('Project.studioId', studio.id)
    .single();

  const scene = handleDbOptional(sceneResult);

  return !!scene;
}

// GET /api/studio/projects/[id]/scenes/[sceneId]/talents - Get all talents assigned to a scene
export async function GET(
  request: Request,
  { params }: { params: { id: string; sceneId: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const { sceneId } = params;

    if (!await canAccessScene(session.profile.id, sceneId)) {
      return NextResponse.json({ error: "Unauthorized to access this scene" }, { status: 403 });
    }

    const sceneTalentsResult = await supabase
      .from('SceneTalent')
      .select(`
        *,
        Profile (
          *,
          User (
            firstName,
            lastName,
            email
          ),
          ProfileImage!ProfileImage_profileId_fkey (*)!inner,
          Skill (*)
        )
      `)
      .eq('sceneId', sceneId)
      .eq('Profile.ProfileImage.isPrimary', true);

    const sceneTalents = handleDbResult(sceneTalentsResult);

    return NextResponse.json(sceneTalents);
  } catch (error) {
    console.error("Error fetching scene talents:", error);
    return NextResponse.json({ error: "Failed to fetch scene talents" }, { status: 500 });
  }
}

// POST /api/studio/projects/[id]/scenes/[sceneId]/talents - Add a talent to a scene
export async function POST(
  request: Request,
  { params }: { params: { id: string; sceneId: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const { id: projectId, sceneId } = params;
    const body = await request.json();

    if (!await canAccessScene(session.profile.id, sceneId)) {
      return NextResponse.json({ error: "Unauthorized to access this scene" }, { status: 403 });
    }

    // Validate input data
    const result = addTalentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const { profileId, role, notes, status } = result.data;

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

    // Check if talent is already assigned to this scene
    const existingTalentResult = await supabase
      .from('SceneTalent')
      .select('*')
      .eq('sceneId', sceneId)
      .eq('profileId', profileId)
      .single();

    const existingTalent = handleDbOptional(existingTalentResult);

    if (existingTalent) {
      return NextResponse.json(
        { error: "This talent is already assigned to the scene" },
        { status: 400 }
      );
    }

    // Add talent to the scene
    const sceneTalentResult = await supabase
      .from('SceneTalent')
      .insert({
        id: generateId(),
        sceneId,
        profileId,
        role,
        notes,
        status,
        updatedAt: now(),
      })
      .select(`
        *,
        Profile (
          *,
          User (
            firstName,
            lastName,
            email
          ),
          ProfileImage!ProfileImage_profileId_fkey (*)!inner
        )
      `)
      .eq('Profile.ProfileImage.isPrimary', true)
      .single();

    const sceneTalent = handleDbResult(sceneTalentResult);

    // Also make sure the talent is a member of the project
    const projectMemberResult = await supabase
      .from('ProjectMember')
      .select('*')
      .eq('projectId', projectId)
      .eq('profileId', profileId)
      .single();

    const projectMember = handleDbOptional(projectMemberResult);

    if (!projectMember) {
      // Add the talent to the project members if not already a member
      await supabase
        .from('ProjectMember')
        .insert({
          id: generateId(),
          projectId,
          profileId,
          role: role || "Cast Member",
          updatedAt: now(),
        });
    }

    return NextResponse.json(sceneTalent, { status: 201 });
  } catch (error) {
    console.error("Error adding talent to scene:", error);
    return NextResponse.json({ error: "Failed to add talent to scene" }, { status: 500 });
  }
}
