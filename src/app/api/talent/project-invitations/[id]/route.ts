import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult, generateId, now } from '@/lib/supabase-db';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/talent/project-invitations/[id] - Get a specific project invitation
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = db();
    const session = await getSession();

    if (!session?.profile?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the user and their profile
    const userResult = await supabase
      .from('User')
      .select(`
        id,
        Tenant (
          id,
          type
        ),
        Profile (
          id
        )
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || (user.Tenant as any).type !== "TALENT" || !user.Profile) {
      return NextResponse.json({ error: "Only talent accounts can access their invitations" }, { status: 403 });
    }

    const profileId = (user.Profile as any).id;
    const invitationId = params.id;

    // Get the invitation with related project details
    const invitationResult = await supabase
      .from('ProjectInvitation')
      .select(`
        id,
        status,
        role,
        sentAt,
        respondedAt,
        expiresAt,
        message,
        profileId,
        projectId,
        Project (
          id,
          title,
          description,
          startDate,
          endDate,
          status,
          studioId,
          Studio (
            id,
            name,
            description
          )
        )
      `)
      .eq('id', invitationId)
      .eq('profileId', profileId)
      .single();

    const invitation = handleDbOptional(invitationResult);

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    // Format the response
    const formattedInvitation = {
      id: (invitation as any).id,
      status: (invitation as any).status,
      role: (invitation as any).role,
      sentAt: (invitation as any).sentAt,
      respondedAt: (invitation as any).respondedAt,
      expiresAt: (invitation as any).expiresAt,
      message: (invitation as any).message,
      project: {
        id: (invitation as any).Project.id,
        title: (invitation as any).Project.title,
        description: (invitation as any).Project.description,
        startDate: (invitation as any).Project.startDate,
        endDate: (invitation as any).Project.endDate,
        status: (invitation as any).Project.status,
        studioId: (invitation as any).Project.studioId,
        Studio: {
          id: (invitation as any).Project.Studio.id,
          name: (invitation as any).Project.Studio.name,
          description: (invitation as any).Project.Studio.description,
        }
      }
    };

    return NextResponse.json(formattedInvitation);
  } catch (error) {
    console.error("Error fetching project invitation:", error);
    return NextResponse.json({
      error: "Failed to fetch project invitation",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// PATCH /api/talent/project-invitations/[id] - Update invitation status (accept or decline)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = db();
    const session = await getSession();

    if (!session?.profile?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the user and their profile
    const userResult = await supabase
      .from('User')
      .select(`
        id,
        Tenant (
          id,
          type
        ),
        Profile (
          id
        )
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || (user.Tenant as any).type !== "TALENT" || !user.Profile) {
      return NextResponse.json({ error: "Only talent accounts can respond to invitations" }, { status: 403 });
    }

    const profileId = (user.Profile as any).id;
    const invitationId = params.id;

    // Get the request body
    const body = await request.json();
    const { status } = body;

    // Validate status
    if (!status || !['ACCEPTED', 'DECLINED'].includes(status)) {
      return NextResponse.json({
        error: "Invalid status. Must be 'ACCEPTED' or 'DECLINED'."
      }, { status: 400 });
    }

    // Find the invitation
    const invitationResult = await supabase
      .from('ProjectInvitation')
      .select(`
        id,
        status,
        role,
        projectId,
        profileId,
        Project (
          id,
          studioId
        )
      `)
      .eq('id', invitationId)
      .eq('profileId', profileId)
      .single();

    const invitation = handleDbOptional(invitationResult);

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    // Check if the invitation is still pending
    if ((invitation as any).status !== 'PENDING') {
      return NextResponse.json({
        error: "This invitation has already been responded to"
      }, { status: 400 });
    }

    const timestamp = now();

    // Update the invitation status
    const updatedInvitationResult = await supabase
      .from('ProjectInvitation')
      .update({
        status,
        respondedAt: timestamp
      })
      .eq('id', invitationId)
      .select()
      .single();

    const updatedInvitation = handleDbResult(updatedInvitationResult);

    // If accepted, create a ProjectMember entry
    if (status === 'ACCEPTED') {
      const projectMemberId = generateId();

      await supabase
        .from('ProjectMember')
        .insert({
          id: projectMemberId,
          projectId: (invitation as any).projectId,
          profileId: profileId,
          role: (invitation as any).role || 'Talent',
          notes: `Added via project invitation ${invitationId}`,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
    }

    // Send notification message back to studio
    const messageId = generateId();
    const projectTitle = (invitation as any).Project?.title || 'the project';

    await supabase
      .from('Message')
      .insert({
        id: messageId,
        subject: `Response to project invitation: ${projectTitle}`,
        content: status === 'ACCEPTED'
          ? `I've accepted your invitation to join the project: ${projectTitle}.`
          : `I've declined your invitation to join the project: ${projectTitle}.`,
        talentSenderId: profileId,
        studioReceiverId: (invitation as any).Project?.studioId,
        relatedToProjectId: (invitation as any).projectId,
        isRead: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    return NextResponse.json({
      success: true,
      message: `Invitation ${status.toLowerCase()} successfully`,
      invitation: updatedInvitation
    });
  } catch (error) {
    console.error("Error updating project invitation:", error);
    return NextResponse.json({
      error: "Failed to update project invitation",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
