import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { getSession } from '@/lib/supabase-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for talent invitations
const invitationSchema = z.object({
  talentIds: z.array(z.string()).min(1, "At least one talent must be selected"),
  message: z.string().optional(),
});

// GET /api/studio/projects/[id]/invitations - Get all invitations for a project
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session?.profile?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = db();

    // Find the user and their tenant
    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== "STUDIO") {
      return NextResponse.json({ error: "Only studio accounts can access invitations" }, { status: 403 });
    }

    // Find the studio associated with this tenant
    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.Tenant.id)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const projectId = params.id;

    // Check if the project belongs to this studio
    const projectResult = await supabase
      .from('Project')
      .select('*')
      .eq('id', projectId)
      .eq('studioId', studio.id)
      .single();

    const project = handleDbOptional(projectResult);

    if (!project) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 403 });
    }

    // For projects, invitations are tracked through messages
    const invitationsResult = await supabase
      .from('Message')
      .select(`
        *,
        Profile_Message_talentReceiverIdToProfile:Profile!Message_talentReceiverId_fkey (
          id,
          User (
            firstName,
            lastName,
            email
          )
        )
      `)
      .eq('relatedToProjectId', projectId)
      .eq('studioSenderId', studio.id)
      .order('createdAt', { ascending: false });

    const invitations = handleDbResult(invitationsResult);

    // Get talent IDs from invitations
    const talentIds = invitations
      .map(inv => inv.talentReceiverId)
      .filter(Boolean) as string[];

    // Also get information about talents that have joined the project
    let projectMembers: any[] = [];
    if (talentIds.length > 0) {
      const projectMembersResult = await supabase
        .from('ProjectMember')
        .select('profileId, role, createdAt')
        .eq('projectId', projectId)
        .in('profileId', talentIds);

      projectMembers = handleDbResult(projectMembersResult);
    }

    // Combine invitation data with project member status
    const invitationsWithStatus = invitations.map((invitation: any) => {
      const member = projectMembers.find(
        m => m.profileId === invitation.talentReceiverId
      );

      return {
        ...invitation,
        hasJoined: !!member,
        role: member?.role || null,
        joinDate: member?.createdAt || null,
        talent: invitation.Profile_Message_talentReceiverIdToProfile ? {
          id: invitation.Profile_Message_talentReceiverIdToProfile.id,
          name: `${invitation.Profile_Message_talentReceiverIdToProfile.User.firstName} ${invitation.Profile_Message_talentReceiverIdToProfile.User.lastName}`,
          email: invitation.Profile_Message_talentReceiverIdToProfile.User.email,
        } : null
      };
    });

    return NextResponse.json(invitationsWithStatus);
  } catch (error) {
    console.error("Error fetching project invitations:", error);
    return NextResponse.json({
      error: "Failed to fetch project invitations",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// POST /api/studio/projects/[id]/invitations
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session?.profile?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate projectId
    const projectId = params.id;
    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    // Get request body
    const body = await request.json();

    // Validate request data
    const validationResult = invitationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        error: "Invalid request data",
        details: validationResult.error.format()
      }, { status: 400 });
    }

    const { talentIds, message } = validationResult.data;

    const supabase = db();

    // Find the user's tenant
    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== "STUDIO") {
      return NextResponse.json({ error: "Only studio accounts can send talent invitations" }, { status: 403 });
    }

    // Find the studio
    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.Tenant.id)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    // Verify the project belongs to this studio
    const projectResult = await supabase
      .from('Project')
      .select('*')
      .eq('id', projectId)
      .eq('studioId', studio.id)
      .single();

    const project = handleDbOptional(projectResult);

    if (!project) {
      return NextResponse.json({ error: "Project not found or you don't have permission to access it" }, { status: 404 });
    }

    // Find all the profiles for the talent IDs
    const talentProfilesResult = await supabase
      .from('Profile')
      .select(`
        *,
        User (
          id,
          email,
          firstName,
          lastName,
          Tenant (
            type
          )
        )
      `)
      .in('id', talentIds);

    const allProfiles = handleDbResult(talentProfilesResult);

    // Filter to only profiles with TALENT tenant type
    const talentProfiles = allProfiles.filter(
      (profile: any) => profile.User?.Tenant?.type === "TALENT"
    );

    if (talentProfiles.length === 0) {
      return NextResponse.json({ error: "No valid talent profiles found" }, { status: 400 });
    }

    // Create a personalized invite message for each talent
    const inviteMessage = message || `You've been invited to join project: ${project.title}. Please check your dashboard for more details.`;

    // Create messages for each talent as project invitations
    const messagesToInsert = talentProfiles.map((profile: any) => ({
      id: crypto.randomUUID(),
      subject: `Invitation to join project: ${project.title}`,
      content: inviteMessage,
      studioSenderId: studio.id,
      talentReceiverId: profile.id,
      relatedToProjectId: projectId,
      isRead: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const createdInvitationsResult = await supabase
      .from('Message')
      .insert(messagesToInsert)
      .select('id, subject, createdAt');

    const createdInvitations = handleDbResult(createdInvitationsResult);

    return NextResponse.json({
      message: "Invitations sent successfully",
      count: createdInvitations.length,
      invitations: createdInvitations
    });

  } catch (error) {
    console.error("Error creating project invitations:", error);
    return NextResponse.json({
      error: "Failed to send invitations",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
