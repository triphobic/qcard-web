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

export async function GET() {
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

    // Fetch all questionnaire invitations for the talent
    const invitationsResult = await supabase
      .from('QuestionnaireInvitation')
      .select(`
        *,
        questionnaire:Questionnaire(
          id,
          title,
          description,
          studioId,
          Studio:Studio(
            name
          )
        ),
        response:QuestionnaireResponse(
          id,
          status,
          submittedAt
        )
      `)
      .eq('profileId', profileId)
      .order('status', { ascending: true })
      .order('sentAt', { ascending: false });

    const invitations = handleDbResult(invitationsResult);

    // Get question counts for each questionnaire
    const invitationsWithCounts = await Promise.all(
      invitations.map(async (invitation: any) => {
        if (invitation.questionnaire) {
          const countResult = await supabase
            .from('Question')
            .select('*', { count: 'exact', head: true })
            .eq('questionnaireId', invitation.questionnaire.id);

          return {
            ...invitation,
            questionnaire: {
              ...invitation.questionnaire,
              _count: {
                questions: countResult.count || 0
              }
            }
          };
        }
        return invitation;
      })
    );

    return NextResponse.json(invitationsWithCounts);
  } catch (error) {
    console.error('Error fetching questionnaire invitations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questionnaire invitations' },
      { status: 500 }
    );
  }
}
