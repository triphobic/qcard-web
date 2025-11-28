import { db, handleDbOptional, handleDbResult, now } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for updating a scene
const sceneUpdateSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }).optional(),
  description: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  shootDate: z.string().optional().nullable(),
  duration: z.number().int().positive().optional().nullable(), // Duration in minutes
  talentNeeded: z.number().int().nonnegative().optional().nullable(),
  status: z.string().optional(),
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

// GET /api/studio/projects/[id]/scenes/[sceneId] - Get a specific scene
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

    const sceneResult = await supabase
      .from('Scene')
      .select(`
        *,
        Project (
          id,
          title
        ),
        Location (*),
        SceneTalent (
          *,
          Profile (
            *,
            User (
              firstName,
              lastName,
              email
            ),
            ProfileImage (*)!ProfileImage_profileId_fkey,
            Skill (*)
          )
        )
      `)
      .eq('id', sceneId)
      .eq('SceneTalent.Profile.ProfileImage.isPrimary', true)
      .limit(1, { foreignTable: 'SceneTalent.Profile.ProfileImage' })
      .single();

    const scene = handleDbOptional(sceneResult);

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    return NextResponse.json(scene);
  } catch (error) {
    console.error("Error fetching scene:", error);
    return NextResponse.json({ error: "Failed to fetch scene" }, { status: 500 });
  }
}

// PATCH /api/studio/projects/[id]/scenes/[sceneId] - Update a specific scene
export async function PATCH(
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
    const body = await request.json();

    if (!await canAccessScene(session.profile.id, sceneId)) {
      return NextResponse.json({ error: "Unauthorized to access this scene" }, { status: 403 });
    }

    // Validate input data
    const result = sceneUpdateSchema.safeParse(body);
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

    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title;
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }
    if (validatedData.locationId !== undefined) {
      updateData.locationId = validatedData.locationId;
    }
    if (validatedData.shootDate !== undefined) {
      try {
        updateData.shootDate = validatedData.shootDate ? new Date(validatedData.shootDate).toISOString() : null;
      } catch (e) {
        console.error("Invalid date format:", validatedData.shootDate);
      }
    }
    if (validatedData.duration !== undefined) {
      updateData.duration = validatedData.duration;
    }
    if (validatedData.talentNeeded !== undefined) {
      updateData.talentNeeded = validatedData.talentNeeded;
    }
    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;
    }

    // Update the scene
    const updatedSceneResult = await supabase
      .from('Scene')
      .update(updateData)
      .eq('id', sceneId)
      .select(`
        *,
        Location (*)
      `)
      .single();

    const updatedScene = handleDbResult(updatedSceneResult);

    return NextResponse.json(updatedScene);
  } catch (error) {
    console.error("Error updating scene:", error);
    return NextResponse.json({ error: "Failed to update scene" }, { status: 500 });
  }
}

// DELETE /api/studio/projects/[id]/scenes/[sceneId] - Delete a specific scene
export async function DELETE(
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

    // Delete the scene (this will cascade delete talents if configured in schema)
    const deleteResult = await supabase
      .from('Scene')
      .delete()
      .eq('id', sceneId);

    if (deleteResult.error) {
      throw deleteResult.error;
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting scene:", error);
    return NextResponse.json({ error: "Failed to delete scene" }, { status: 500 });
  }
}