import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { db, handleDbOptional, handleDbResult, now } from '@/lib/supabase-db';

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
        profileId,
        expiresAt
      `)
      .eq('id', params.id)
      .eq('profileId', profileId)
      .single();

    const invitation = handleDbOptional(invitationResult);

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Only pending invitations can be declined
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

    // Update invitation status to DECLINED
    const updatedInvitationResult = await supabase
      .from('ProjectInvitation')
      .update({
        status: 'DECLINED',
        respondedAt: timestamp,
      })
      .eq('id', params.id)
      .select()
      .single();

    const updatedInvitation = handleDbResult(updatedInvitationResult);

    return NextResponse.json(updatedInvitation);
  } catch (error) {
    console.error('Error declining project invitation:', error);
    return NextResponse.json(
      { error: 'Failed to decline project invitation' },
      { status: 500 }
    );
  }
}
