import { db, handleDbOptional, handleDbResult, now } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for updating a scene talent
const updateTalentSchema = z.object({
  role: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.string().optional(),
});

// Helper function to check if a studio has access to a scene talent
async function canAccessSceneTalent(userId: string, sceneTalentId: string) {
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

  const sceneTalentResult = await supabase
    .from('SceneTalent')
    .select('*, Scene!inner(*, Project!inner(*))')
    .eq('id', sceneTalentId)
    .eq('Scene.Project.studioId', studio.id)
    .single();

  const sceneTalent = handleDbOptional(sceneTalentResult);

  return !!sceneTalent;
}

// GET /api/studio/projects/[id]/scenes/[sceneId]/talents/[talentId] - Get a specific talent in a scene
export async function GET(
  request: Request,
  { params }: { params: { id: string; sceneId: string; talentId: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const { talentId } = params;

    if (!await canAccessSceneTalent(session.profile.id, talentId)) {
      return NextResponse.json({ error: "Unauthorized to access this scene talent" }, { status: 403 });
    }

    const sceneTalentResult = await supabase
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
          Skill (*)
        ),
        Scene (
          id,
          title,
          shootDate,
          Location (*),
          Project (
            id,
            title
          )
        )
      `)
      .eq('id', talentId)
      .single();

    const sceneTalent = handleDbOptional(sceneTalentResult);

    if (!sceneTalent) {
      return NextResponse.json({ error: "Scene talent not found" }, { status: 404 });
    }

    return NextResponse.json(sceneTalent);
  } catch (error) {
    console.error("Error fetching scene talent:", error);
    return NextResponse.json({ error: "Failed to fetch scene talent" }, { status: 500 });
  }
}

// PATCH /api/studio/projects/[id]/scenes/[sceneId]/talents/[talentId] - Update a talent in a scene
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; sceneId: string; talentId: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const { talentId } = params;
    const body = await request.json();

    if (!await canAccessSceneTalent(session.profile.id, talentId)) {
      return NextResponse.json({ error: "Unauthorized to access this scene talent" }, { status: 403 });
    }

    // Validate input data
    const result = updateTalentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const validatedData = result.data;

    // Build update data object
    const updateData: any = {
      updatedAt: now()
    };

    if (validatedData.role !== undefined) {
      updateData.role = validatedData.role;
    }
    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes;
    }
    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;
    }

    // Update the scene talent
    const updatedSceneTalentResult = await supabase
      .from('SceneTalent')
      .update(updateData)
      .eq('id', talentId)
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

    const updatedSceneTalent = handleDbResult(updatedSceneTalentResult);

    return NextResponse.json(updatedSceneTalent);
  } catch (error) {
    console.error("Error updating scene talent:", error);
    return NextResponse.json({ error: "Failed to update scene talent" }, { status: 500 });
  }
}

// DELETE /api/studio/projects/[id]/scenes/[sceneId]/talents/[talentId] - Remove a talent from a scene
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; sceneId: string; talentId: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const { talentId } = params;

    if (!await canAccessSceneTalent(session.profile.id, talentId)) {
      return NextResponse.json({ error: "Unauthorized to access this scene talent" }, { status: 403 });
    }

    // Delete the scene talent
    const deleteResult = await supabase
      .from('SceneTalent')
      .delete()
      .eq('id', talentId);

    if (deleteResult.error) {
      throw deleteResult.error;
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error removing talent from scene:", error);
    return NextResponse.json({ error: "Failed to remove talent from scene" }, { status: 500 });
  }
}
