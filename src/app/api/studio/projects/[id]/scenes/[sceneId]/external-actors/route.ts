import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Schema for validating POST request body
const createExternalActorSchema = z.object({
  externalActorId: z.string().uuid({ message: "Invalid external actor ID" }),
  role: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional().default("CONFIRMED"),
});

// Schema for validating PATCH request body
const updateExternalActorSchema = z.object({
  role: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
});

// GET: Get all external actors for a scene
export async function GET(
  request: Request,
  { params }: { params: { id: string; sceneId: string } }
) {
  try {
    const supabase = db();
    const session = await getSession();

    if (!session || !session.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get studio ID from user's tenant
    const userResult = await supabase
      .from('User')
      .select('*, Tenant(*)')
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== 'STUDIO') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Verify ownership of scene
    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.tenantId!)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    // Verify the scene belongs to this studio
    const sceneResult = await supabase
      .from('Scene')
      .select('*, Project!inner(*)')
      .eq('id', params.sceneId)
      .eq('Project.studioId', studio.id)
      .single();

    const scene = handleDbOptional(sceneResult);

    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    // Get external actors assigned to this scene
    const externalActorsResult = await supabase
      .from('SceneExternalActor')
      .select(`
        *,
        ExternalActor (*)
      `)
      .eq('sceneId', params.sceneId)
      .order('createdAt', { ascending: false });

    const externalActors = handleDbResult(externalActorsResult);

    return NextResponse.json(externalActors);
  } catch (error) {
    console.error('Error fetching scene external actors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scene external actors' },
      { status: 500 }
    );
  }
}

// POST: Assign an external actor to a scene
export async function POST(
  request: Request,
  { params }: { params: { id: string; sceneId: string } }
) {
  try {
    const supabase = db();
    const session = await getSession();

    if (!session || !session.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get studio ID from user's tenant
    const userResult = await supabase
      .from('User')
      .select('*, Tenant(*)')
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== 'STUDIO') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Validate request body
    const body = await request.json();
    const validatedData = createExternalActorSchema.parse(body);

    // Verify ownership of scene and external actor
    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.tenantId!)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    // Verify the scene belongs to this studio
    const sceneResult = await supabase
      .from('Scene')
      .select('*, Project!inner(*)')
      .eq('id', params.sceneId)
      .eq('Project.studioId', studio.id)
      .single();

    const scene = handleDbOptional(sceneResult);

    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    // Verify the external actor belongs to this studio
    const externalActorResult = await supabase
      .from('ExternalActor')
      .select('*')
      .eq('id', validatedData.externalActorId)
      .eq('studioId', studio.id)
      .single();

    const externalActor = handleDbOptional(externalActorResult);

    if (!externalActor) {
      return NextResponse.json(
        { error: 'External actor not found' },
        { status: 404 }
      );
    }

    // Check if already assigned
    const existingAssignmentResult = await supabase
      .from('SceneExternalActor')
      .select('*')
      .eq('sceneId', params.sceneId)
      .eq('externalActorId', validatedData.externalActorId)
      .single();

    const existingAssignment = handleDbOptional(existingAssignmentResult);

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'External actor is already assigned to this scene' },
        { status: 409 }
      );
    }

    // Create the scene external actor assignment
    const sceneExternalActorResult = await supabase
      .from('SceneExternalActor')
      .insert({
        sceneId: params.sceneId,
        externalActorId: validatedData.externalActorId,
        role: validatedData.role,
        notes: validatedData.notes,
        status: validatedData.status,
      })
      .select()
      .single();

    const sceneExternalActor = handleDbResult(sceneExternalActorResult);

    return NextResponse.json(sceneExternalActor);
  } catch (error) {
    console.error('Error assigning external actor to scene:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.format() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to assign external actor to scene' },
      { status: 500 }
    );
  }
}
