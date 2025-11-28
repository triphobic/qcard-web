import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { db, handleDbOptional, handleDbResult, generateId, now } from '@/lib/supabase-db';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Generic invitation handler that can be used for different invitation types
export async function POST(request: Request) {
  try {
    const supabase = db();
    const session = await getSession();

    if (!session?.profile?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the user is associated with a studio
    const userResult = await supabase
      .from('User')
      .select('*, Tenant(*)')
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== 'STUDIO') {
      return NextResponse.json({ error: 'Only studio accounts can send invitations' }, { status: 403 });
    }

    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.Tenant.id)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const {
      invitationType,
      invitationId,
      talentIds,
      message
    } = body;

    // Validate required fields
    if (!invitationType || !invitationId || !Array.isArray(talentIds) || talentIds.length === 0) {
      return NextResponse.json({
        error: 'Missing required fields',
        details: 'invitationType, invitationId, and talentIds are required'
      }, { status: 400 });
    }

    // Process different invitation types
    let invitationResults;

    switch (invitationType) {
      case 'questionnaire':
        invitationResults = await handleQuestionnaireInvitations(supabase, studio.id, invitationId, talentIds, message);
        break;
      case 'casting-call':
        invitationResults = await handleCastingCallInvitations(supabase, studio.id, invitationId, talentIds, message);
        break;
      case 'project':
        invitationResults = await handleProjectInvitations(supabase, studio.id, invitationId, talentIds, message);
        break;
      default:
        return NextResponse.json({
          error: 'Invalid invitation type',
          details: 'Supported types: questionnaire, casting-call, project'
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      invitationsCount: invitationResults.count,
      results: invitationResults.details
    }, { status: 201 });

  } catch (error) {
    console.error('Error sending invitations:', error);
    return NextResponse.json(
      { error: 'Failed to send invitations', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Handle questionnaire invitations
async function handleQuestionnaireInvitations(supabase: any, studioId: string, questionnaireId: string, talentIds: string[], message?: string) {
  // Verify questionnaire exists and belongs to studio
  const questionnaireResult = await supabase
    .from('Questionnaire')
    .select('*')
    .eq('id', questionnaireId)
    .eq('studioId', studioId)
    .single();

  const questionnaire = handleDbOptional(questionnaireResult);

  if (!questionnaire) {
    throw new Error('Questionnaire not found or does not belong to this studio');
  }

  // Create invitations
  const invitations = talentIds.map(talentId => ({
    id: generateId(),
    questionnaireId,
    profileId: talentId,
    status: 'PENDING',
    message: message || null,
  }));

  const invitationsResult = await supabase
    .from('QuestionnaireInvitation')
    .insert(invitations)
    .select();

  const results = handleDbResult(invitationsResult);

  return {
    count: results.length,
    details: results
  };
}

// Handle casting call invitations
async function handleCastingCallInvitations(supabase: any, studioId: string, castingCallId: string, talentIds: string[], message?: string) {
  // Verify casting call exists and belongs to studio
  const castingCallResult = await supabase
    .from('CastingCall')
    .select('*')
    .eq('id', castingCallId)
    .eq('studioId', studioId)
    .single();

  const castingCall = handleDbOptional(castingCallResult);

  if (!castingCall) {
    throw new Error('Casting call not found or does not belong to this studio');
  }

  // For casting calls, we'll send a message to each talent
  const messages = talentIds.map(talentId => ({
    id: generateId(),
    subject: `Invitation to apply for casting call: ${castingCall.title}`,
    content: message || `You've been invited to apply for a casting call: ${castingCall.title}. Please visit your opportunities page to learn more and apply.`,
    studioSenderId: studioId,
    talentReceiverId: talentId,
    relatedToCastingCallId: castingCallId,
    isRead: false,
  }));

  const messagesResult = await supabase
    .from('Message')
    .insert(messages)
    .select();

  const results = handleDbResult(messagesResult);

  return {
    count: results.length,
    details: results
  };
}

// Handle project invitations
async function handleProjectInvitations(supabase: any, studioId: string, projectId: string, talentIds: string[], message?: string) {
  // Verify project exists and belongs to studio
  const projectResult = await supabase
    .from('Project')
    .select('*')
    .eq('id', projectId)
    .eq('studioId', studioId)
    .single();

  const project = handleDbOptional(projectResult);

  if (!project) {
    throw new Error('Project not found or does not belong to this studio');
  }

  // For project invitations, we create both a message and a project invitation entry
  const invitationResults = [];

  for (const talentId of talentIds) {
    // First create a message
    const inviteMessage = message || `You've been invited to join the project: ${project.title}. Please visit your projects page to accept or decline this invitation.`;

    const messageResult = await supabase
      .from('Message')
      .insert({
        id: generateId(),
        subject: `Invitation to join project: ${project.title}`,
        content: inviteMessage,
        studioSenderId: studioId,
        talentReceiverId: talentId,
        relatedToProjectId: projectId,
        isRead: false,
      })
      .select()
      .single();

    const newMessage = handleDbResult(messageResult);

    // Then create the project invitation entry
    const invitationResult = await supabase
      .from('ProjectInvitation')
      .insert({
        projectId,
        profileId: talentId,
        status: 'PENDING',
        message: inviteMessage,
        role: 'Talent',
        messageId: newMessage.id,
      })
      .select()
      .single();

    const invitation = handleDbResult(invitationResult);

    invitationResults.push({
      message: newMessage,
      invitation
    });
  }

  return {
    count: invitationResults.length,
    details: invitationResults
  };
}
