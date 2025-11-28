import { db, handleDbOptional, handleDbResult, generateId, now } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for updating an application
const updateApplicationSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  message: z.string().optional(),
  addToProject: z.boolean().optional(),
  projectRole: z.string().optional(),
});

// Helper function to check if a studio has access to an application
async function canAccessApplication(userId: string, applicationId: string) {
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

  const applicationResult = await supabase
    .from('Application')
    .select('*, CastingCall!inner(*)')
    .eq('id', applicationId)
    .eq('CastingCall.studioId', studio.id)
    .single();

  const application = handleDbOptional(applicationResult);

  return !!application;
}

// GET /api/studio/applications/[id] - Get a specific application
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const id = params.id;

    if (!await canAccessApplication(session.profile.id, id)) {
      return NextResponse.json({ error: "Unauthorized to access this application" }, { status: 403 });
    }

    const applicationResult = await supabase
      .from('Application')
      .select(`
        *,
        Profile (
          *,
          User (
            firstName,
            lastName,
            email
          ),
          Skill (*),
          Location (*)
        ),
        CastingCall (
          *,
          Project (*)
        )
      `)
      .eq('id', id)
      .single();

    const application = handleDbOptional(applicationResult);

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json(application);
  } catch (error) {
    console.error("Error fetching application:", error);
    return NextResponse.json({
      error: "Failed to fetch application",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// PATCH /api/studio/applications/[id] - Update an application
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const id = params.id;
    const body = await request.json();

    if (!await canAccessApplication(session.profile.id, id)) {
      return NextResponse.json({ error: "Unauthorized to modify this application" }, { status: 403 });
    }

    // Validate input data
    const result = updateApplicationSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const validatedData = result.data;

    // Get the application first to access casting call and profile info
    const applicationResult = await supabase
      .from('Application')
      .select(`
        *,
        Profile (*),
        CastingCall (
          *,
          Project (*)
        )
      `)
      .eq('id', id)
      .single();

    const application = handleDbResult(applicationResult);

    // Update the application status
    const updatedApplicationResult = await supabase
      .from('Application')
      .update({
        status: validatedData.status,
        message: validatedData.message,
        updatedAt: now()
      })
      .eq('id', id)
      .select(`
        *,
        Profile (*),
        CastingCall (
          *,
          Project (*)
        )
      `)
      .single();

    const updatedApplication = handleDbResult(updatedApplicationResult);

    // If approved and we should add to project
    if (
      validatedData.status === "APPROVED" &&
      validatedData.addToProject === true &&
      application.CastingCall.projectId
    ) {
      // Check if already a project member
      const existingMemberResult = await supabase
        .from('ProjectMember')
        .select('*')
        .eq('projectId', application.CastingCall.projectId)
        .eq('profileId', application.profileId)
        .single();

      const existingMember = handleDbOptional(existingMemberResult);

      // If not already a member, add them to the project
      if (!existingMember) {
        await supabase
          .from('ProjectMember')
          .insert({
            id: generateId(),
            projectId: application.CastingCall.projectId,
            profileId: application.profileId,
            role: validatedData.projectRole || `Talent for ${application.CastingCall.title}`,
            updatedAt: now()
          });
      }
    }

    return NextResponse.json(updatedApplication);
  } catch (error) {
    console.error("Error updating application:", error);
    return NextResponse.json({
      error: "Failed to update application",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
