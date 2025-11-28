import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';
import { db, handleDbOptional, handleDbResult, now } from '@/lib/supabase-db';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Schema for validating PATCH request body
const updateExternalActorSchema = z.object({
  role: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
});

// GET: Get specific external actor for a scene
export async function GET(
  request: Request,
  { params }: { params: { id: string; sceneId: string; actorId: string } }
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

    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.tenantId!)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    // Get the scene external actor assignment
    const sceneExternalActorResult = await supabase
      .from('SceneExternalActor')
      .select(`
        *,
        ExternalActor (*),
        Scene (
          *,
          Project (*)
        )
      `)
      .eq('id', params.actorId)
      .single();

    const sceneExternalActor = handleDbOptional(sceneExternalActorResult);

    if (!sceneExternalActor) {
      return NextResponse.json(
        { error: 'Scene external actor not found' },
        { status: 404 }
      );
    }

    // Verify the studio owns this assignment
    if (sceneExternalActor.ExternalActor.studioId !== studio.id ||
        sceneExternalActor.Scene.Project.studioId !== studio.id) {
      return NextResponse.json(
        { error: 'Not authorized to access this assignment' },
        { status: 403 }
      );
    }

    return NextResponse.json(sceneExternalActor);
  } catch (error) {
    console.error('Error fetching scene external actor:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scene external actor' },
      { status: 500 }
    );
  }
}

// PATCH: Update an external actor's assignment in a scene
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; sceneId: string; actorId: string } }
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
    const validatedData = updateExternalActorSchema.parse(body);

    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.tenantId!)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    // Get the scene external actor assignment
    const sceneExternalActorResult = await supabase
      .from('SceneExternalActor')
      .select(`
        *,
        ExternalActor (*),
        Scene (
          *,
          Project (*)
        )
      `)
      .eq('id', params.actorId)
      .single();

    const sceneExternalActor = handleDbOptional(sceneExternalActorResult);

    if (!sceneExternalActor) {
      return NextResponse.json(
        { error: 'Scene external actor not found' },
        { status: 404 }
      );
    }

    // Verify the studio owns this assignment
    if (sceneExternalActor.ExternalActor.studioId !== studio.id ||
        sceneExternalActor.Scene.Project.studioId !== studio.id) {
      return NextResponse.json(
        { error: 'Not authorized to update this assignment' },
        { status: 403 }
      );
    }

    // Build update data
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

    // Update the assignment
    const updatedAssignmentResult = await supabase
      .from('SceneExternalActor')
      .update(updateData)
      .eq('id', params.actorId)
      .select()
      .single();

    const updatedAssignment = handleDbResult(updatedAssignmentResult);

    return NextResponse.json(updatedAssignment);
  } catch (error) {
    console.error('Error updating scene external actor:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.format() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update scene external actor' },
      { status: 500 }
    );
  }
}

// DELETE: Remove an external actor from a scene
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; sceneId: string; actorId: string } }
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

    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.tenantId!)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    // Get the scene external actor assignment
    const sceneExternalActorResult = await supabase
      .from('SceneExternalActor')
      .select(`
        *,
        ExternalActor (*),
        Scene (
          *,
          Project (*)
        )
      `)
      .eq('id', params.actorId)
      .single();

    const sceneExternalActor = handleDbOptional(sceneExternalActorResult);

    if (!sceneExternalActor) {
      return NextResponse.json(
        { error: 'Scene external actor not found' },
        { status: 404 }
      );
    }

    // Verify the studio owns this assignment
    if (sceneExternalActor.ExternalActor.studioId !== studio.id ||
        sceneExternalActor.Scene.Project.studioId !== studio.id) {
      return NextResponse.json(
        { error: 'Not authorized to delete this assignment' },
        { status: 403 }
      );
    }

    // Remove the assignment
    const deleteResult = await supabase
      .from('SceneExternalActor')
      .delete()
      .eq('id', params.actorId);

    if (deleteResult.error) {
      throw deleteResult.error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing external actor from scene:', error);
    return NextResponse.json(
      { error: 'Failed to remove external actor from scene' },
      { status: 500 }
    );
  }
}
