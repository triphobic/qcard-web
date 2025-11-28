import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { db, handleDbOptional, handleDbResult, generateId, now } from '@/lib/supabase-db';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

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

    // Get the talent's profile
    const profileResult = await supabase
      .from('Profile')
      .select('id')
      .eq('userId', session.profile.id)
      .single();

    const profile = handleDbOptional(profileResult);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profileId = profile.id;

    // Check if invitation exists and belongs to this talent
    const invitationResult = await supabase
      .from('ProjectInvitation')
      .select(`
        id,
        status,
        role,
        projectId,
        profileId,
        expiresAt,
        Project (
          id,
          title
        )
      `)
      .eq('id', params.id)
      .eq('profileId', profileId)
      .single();

    const invitation = handleDbOptional(invitationResult);

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Only pending invitations can be accepted
    if ((invitation as any).status !== 'PENDING') {
      return NextResponse.json(
        { error: `Invitation is already ${(invitation as any).status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Check if invitation is expired
    if ((invitation as any).expiresAt && new Date((invitation as any).expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    const timestamp = now();

    // Update invitation status to ACCEPTED
    const updatedInvitationResult = await supabase
      .from('ProjectInvitation')
      .update({
        status: 'ACCEPTED',
        respondedAt: timestamp,
      })
      .eq('id', params.id)
      .select()
      .single();

    const updatedInvitation = handleDbResult(updatedInvitationResult);

    // Create a project member entry for the talent
    const projectMemberId = generateId();

    const projectMemberResult = await supabase
      .from('ProjectMember')
      .insert({
        id: projectMemberId,
        projectId: (invitation as any).projectId,
        profileId: profileId,
        role: (invitation as any).role || 'Talent',
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .select()
      .single();

    const projectMember = handleDbResult(projectMemberResult);

    return NextResponse.json({
      invitation: updatedInvitation,
      projectMember: projectMember,
    });
  } catch (error) {
    console.error('Error accepting project invitation:', error);
    return NextResponse.json(
      { error: 'Failed to accept project invitation' },
      { status: 500 }
    );
  }
}
