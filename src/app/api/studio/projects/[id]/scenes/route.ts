import { db, handleDbOptional, handleDbResult, now, generateId } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for creating a scene
const sceneSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  shootDate: z.string().optional().nullable(),
  duration: z.number().int().positive().optional().nullable(), // Duration in minutes
  talentNeeded: z.number().int().nonnegative().optional().nullable(),
  status: z.string().default("PLANNING"),
});

// Helper function to check if a studio has access to a project
async function canAccessProject(userId: string, projectId: string) {
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

  const projectResult = await supabase
    .from('Project')
    .select('*')
    .eq('id', projectId)
    .eq('studioId', studio.id)
    .single();

  const project = handleDbOptional(projectResult);

  return !!project;
}

// GET /api/studio/projects/[id]/scenes - Get all scenes for a project
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const { id: projectId } = params;

    if (!await canAccessProject(session.profile.id, projectId)) {
      return NextResponse.json({ error: "Unauthorized to access this project" }, { status: 403 });
    }

    const scenesResult = await supabase
      .from('Scene')
      .select(`
        *,
        SceneTalent (
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
        Location (*)
      `)
      .eq('projectId', projectId)
      .order('shootDate', { ascending: true, nullsFirst: false })
      .order('createdAt', { ascending: false });

    const scenes = handleDbResult(scenesResult);

    // Map capitalized fields to lowercase for frontend compatibility
    const formattedScenes = scenes.map((scene: any) => ({
      ...scene,
      location: scene.Location,
      talents: scene.SceneTalent?.map((talent: any) => ({
        ...talent,
        profile: {
          ...talent.Profile,
          user: talent.Profile?.User
        }
      })),
      _count: {
        talents: scene.SceneTalent?.length || 0
      }
    }));

    return NextResponse.json(formattedScenes);
  } catch (error) {
    console.error("Error fetching scenes:", error);
    return NextResponse.json({ error: "Failed to fetch scenes" }, { status: 500 });
  }
}

// POST /api/studio/projects/[id]/scenes - Create a new scene
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const { id: projectId } = params;
    const body = await request.json();

    if (!await canAccessProject(session.profile.id, projectId)) {
      return NextResponse.json({ error: "Unauthorized to access this project" }, { status: 403 });
    }

    // Validate input data
    const result = sceneSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const validatedData = result.data;

    // Process date if it's a string
    let shootDate = null;
    if (validatedData.shootDate) {
      try {
        shootDate = new Date(validatedData.shootDate).toISOString();
      } catch (e) {
        console.error("Invalid date format:", validatedData.shootDate);
      }
    }

    // Generate a unique ID for the scene
    const sceneId = generateId();
    const timestamp = now();

    // Create the scene
    const sceneResult = await supabase
      .from('Scene')
      .insert({
        id: sceneId,
        title: validatedData.title,
        description: validatedData.description,
        locationId: validatedData.locationId,
        shootDate,
        duration: validatedData.duration,
        talentNeeded: validatedData.talentNeeded,
        status: validatedData.status,
        projectId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .select(`
        *,
        Location (*)
      `)
      .single();

    const scene = handleDbResult(sceneResult);

    // Format the response for frontend compatibility
    const formattedScene = {
      ...scene,
      location: scene.Location,
      _count: {
        talents: 0
      }
    };

    return NextResponse.json(formattedScene, { status: 201 });
  } catch (error) {
    console.error("Error creating scene:", error);
    return NextResponse.json({ error: "Failed to create scene" }, { status: 500 });
  }
}