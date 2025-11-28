import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for updating a casting call
const updateCastingCallSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }).optional(),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }).optional(),
  requirements: z.string().optional(),
  compensation: z.string().optional(),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  status: z.enum(["OPEN", "CLOSED", "FILLED"]).optional(),
  locationId: z.string().optional(),
  projectId: z.string().optional(),
  skillIds: z.array(z.string()).optional(),
});

// Helper function to check if a studio has access to a casting call
async function canAccessCastingCall(userId: string, castingCallId: string) {
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

  const castingCallResult = await supabase
    .from('CastingCall')
    .select('*')
    .eq('id', castingCallId)
    .eq('studioId', studio.id)
    .single();

  const castingCall = handleDbOptional(castingCallResult);

  return !!castingCall;
}

// GET /api/studio/casting-calls/[id] - Get a specific casting call
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = params.id;

    if (!await canAccessCastingCall(session.profile.id, id)) {
      return NextResponse.json({ error: "Unauthorized to access this casting call" }, { status: 403 });
    }

    const supabase = db();

    const castingCallResult = await supabase
      .from('CastingCall')
      .select(`
        *,
        Location (*),
        Application (
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
        Project (*),
        Studio (*)
      `)
      .eq('id', id)
      .single();

    const castingCall = handleDbOptional(castingCallResult);

    if (!castingCall) {
      return NextResponse.json({ error: "Casting call not found" }, { status: 404 });
    }

    // Get skills for this casting call (many-to-many relationship)
    const skillsResult = await supabase
      .from('_CastingCallToSkill')
      .select(`
        Skill:B (*)
      `)
      .eq('A', id);

    const skillsData = handleDbResult(skillsResult);
    const skills = skillsData.map((s: any) => s.Skill);

    return NextResponse.json({
      ...castingCall,
      Skill: skills
    });
  } catch (error) {
    console.error("Error fetching casting call:", error);
    return NextResponse.json({
      error: "Failed to fetch casting call",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// PATCH /api/studio/casting-calls/[id] - Update a casting call
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = params.id;
    const body = await request.json();

    if (!await canAccessCastingCall(session.profile.id, id)) {
      return NextResponse.json({ error: "Unauthorized to modify this casting call" }, { status: 403 });
    }

    // Validate input data
    const result = updateCastingCallSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const validatedData = result.data;

    const supabase = db();

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.requirements !== undefined) updateData.requirements = validatedData.requirements;
    if (validatedData.compensation !== undefined) updateData.compensation = validatedData.compensation;
    if (validatedData.startDate !== undefined) updateData.startDate = validatedData.startDate?.toISOString();
    if (validatedData.endDate !== undefined) updateData.endDate = validatedData.endDate?.toISOString();
    if (validatedData.status !== undefined) updateData.status = validatedData.status;
    if (validatedData.locationId !== undefined) updateData.locationId = validatedData.locationId;
    if (validatedData.projectId !== undefined) updateData.projectId = validatedData.projectId;

    // Handle skill updates if provided
    if (validatedData.skillIds !== undefined) {
      // Delete current skill connections
      await supabase
        .from('_CastingCallToSkill')
        .delete()
        .eq('A', id);

      // Add new skill connections
      if (validatedData.skillIds.length > 0) {
        const skillConnections = validatedData.skillIds.map(skillId => ({
          A: id,
          B: skillId
        }));

        await supabase
          .from('_CastingCallToSkill')
          .insert(skillConnections);
      }
    }

    // Update the casting call
    const updatedCastingCallResult = await supabase
      .from('CastingCall')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        Location (*),
        Application (*),
        Project (*)
      `)
      .single();

    const updatedCastingCall = handleDbResult(updatedCastingCallResult);

    // Get updated skills
    const skillsResult = await supabase
      .from('_CastingCallToSkill')
      .select(`
        Skill:B (*)
      `)
      .eq('A', id);

    const skillsData = handleDbResult(skillsResult);
    const skills = skillsData.map((s: any) => s.Skill);

    return NextResponse.json({
      ...updatedCastingCall,
      Skill: skills
    });
  } catch (error) {
    console.error("Error updating casting call:", error);
    return NextResponse.json({
      error: "Failed to update casting call",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// DELETE /api/studio/casting-calls/[id] - Delete a casting call
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = params.id;

    if (!await canAccessCastingCall(session.profile.id, id)) {
      return NextResponse.json({ error: "Unauthorized to delete this casting call" }, { status: 403 });
    }

    const supabase = db();

    // Delete skill connections first (foreign key constraint)
    await supabase
      .from('_CastingCallToSkill')
      .delete()
      .eq('A', id);

    // Delete the casting call
    await supabase
      .from('CastingCall')
      .delete()
      .eq('id', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting casting call:", error);
    return NextResponse.json({
      error: "Failed to delete casting call",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
