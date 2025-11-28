import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { db, handleDbOptional, handleDbResult, now } from '@/lib/supabase-db';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Schema for validation
const updateCastingCodeSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }).optional(),
  description: z.string().optional(),
  projectId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  surveyFields: z.any().optional(), // Allow updating survey fields
});

// GET - Get a specific casting code
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
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

    // Get the casting code
    const castingCodeResult = await supabase
      .from('CastingCode')
      .select(`
        *,
        Project:project!castingCode_projectId_fkey (
          id,
          title
        ),
        CastingSubmission:submissions (
          id,
          firstName,
          lastName,
          email,
          phoneNumber,
          status,
          createdAt,
          externalActorId,
          convertedToProfileId,
          convertedUserId,
          survey,
          ExternalActor:externalActor (
            id,
            status,
            convertedProfileId,
            convertedToUserId
          )
        )
      `)
      .eq('id', params.id)
      .eq('studioId', studio.id)
      .order('createdAt', { ascending: false, foreignTable: 'submissions' })
      .single();

    const castingCode = handleDbOptional(castingCodeResult);

    if (!castingCode) {
      return NextResponse.json({ error: 'Casting code not found' }, { status: 404 });
    }

    return NextResponse.json(castingCode);
  } catch (error) {
    console.error('Error fetching casting code:', error);
    return NextResponse.json(
      { error: 'Failed to fetch casting code' },
      { status: 500 }
    );
  }
}

// PATCH - Update a casting code
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
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

    // Check if the casting code exists and belongs to this studio
    const existingCodeResult = await supabase
      .from('CastingCode')
      .select('*')
      .eq('id', params.id)
      .eq('studioId', studio.id)
      .single();

    const existingCode = handleDbOptional(existingCodeResult);

    if (!existingCode) {
      return NextResponse.json({ error: 'Casting code not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateCastingCodeSchema.parse(body);

    // Check if projectId is valid if provided
    if (validatedData.projectId) {
      const projectResult = await supabase
        .from('Project')
        .select('*')
        .eq('id', validatedData.projectId)
        .eq('studioId', studio.id)
        .single();

      const project = handleDbOptional(projectResult);

      if (!project) {
        return NextResponse.json(
          { error: 'Project not found or not owned by this studio' },
          { status: 404 }
        );
      }
    }

    // Update the casting code
    const updateData: any = {
      updatedAt: now(),
    };

    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.projectId !== undefined) updateData.projectId = validatedData.projectId;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.surveyFields !== undefined) updateData.surveyFields = validatedData.surveyFields;
    if (validatedData.expiresAt !== undefined) {
      updateData.expiresAt = validatedData.expiresAt ? new Date(validatedData.expiresAt).toISOString() : null;
    }

    const updatedCodeResult = await supabase
      .from('CastingCode')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    const updatedCode = handleDbResult(updatedCodeResult);

    return NextResponse.json(updatedCode);
  } catch (error) {
    console.error('Error updating casting code:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.format() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update casting code' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a casting code
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
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

    // Check if the casting code exists and belongs to this studio
    const existingCodeResult = await supabase
      .from('CastingCode')
      .select('*')
      .eq('id', params.id)
      .eq('studioId', studio.id)
      .single();

    const existingCode = handleDbOptional(existingCodeResult);

    if (!existingCode) {
      return NextResponse.json({ error: 'Casting code not found' }, { status: 404 });
    }

    // Delete the casting code (and related submissions will be deleted via cascade)
    const deleteResult = await supabase
      .from('CastingCode')
      .delete()
      .eq('id', params.id);

    if (deleteResult.error) {
      throw deleteResult.error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting casting code:', error);
    return NextResponse.json(
      { error: 'Failed to delete casting code' },
      { status: 500 }
    );
  }
}
