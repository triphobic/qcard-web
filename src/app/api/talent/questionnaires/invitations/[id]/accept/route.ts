import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Helper to get the talent's profile ID from the session
async function getProfileIdFromSession(session: any) {
  if (!session?.profile?.id) return null;

  const supabase = db();

  const profileResult = await supabase
    .from('Profile')
    .select('id')
    .eq('userId', session.profile.id)
    .single();

  const profile = handleDbOptional(profileResult);

  return profile?.id || null;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = db();

    const session = await getSession();

    if (!session?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profileId = await getProfileIdFromSession(session);

    if (!profileId) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if invitation exists and belongs to this talent
    const invitationResult = await supabase
      .from('QuestionnaireInvitation')
      .select(`
        *,
        questionnaire:Questionnaire(*)
      `)
      .eq('id', params.id)
      .eq('profileId', profileId)
      .single();

    const invitation = handleDbOptional(invitationResult);

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Only pending invitations can be accepted
    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Invitation is already ${invitation.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Check if invitation is expired
    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Update invitation status to ACCEPTED
    const updatedInvitationResult = await supabase
      .from('QuestionnaireInvitation')
      .update({
        status: 'ACCEPTED',
        updatedAt: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single();

    const updatedInvitation = handleDbResult(updatedInvitationResult);

    return NextResponse.json(updatedInvitation);
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
