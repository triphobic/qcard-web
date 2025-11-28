import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

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

    // Get the talent profile ID from the database
    const userResult = await supabase
      .from('User')
      .select(`
        id,
        Profile (
          id
        )
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user || !user.Profile) {
      return NextResponse.json({ error: 'Talent profile not found' }, { status: 404 });
    }

    const profileId = (user.Profile as any).id;
    const projectId = params.id;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Check if the talent is a member of the project
    const memberCheckResult = await supabase
      .from('ProjectMember')
      .select('id, role')
      .eq('projectId', projectId)
      .eq('profileId', profileId)
      .maybeSingle();

    const memberCheck = handleDbOptional(memberCheckResult);

    // Check if the talent has an invitation
    const invitationCheckResult = await supabase
      .from('ProjectInvitation')
      .select('id, status, role, sentAt')
      .eq('projectId', projectId)
      .eq('profileId', profileId)
      .maybeSingle();

    const invitationCheck = handleDbOptional(invitationCheckResult);

    // If the talent is neither a member nor invited, deny access
    if (!memberCheck && !invitationCheck) {
      return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 });
    }

    // Get the project details
    const projectResult = await supabase
      .from('Project')
      .select(`
        id,
        title,
        description,
        status,
        startDate,
        endDate,
        createdAt,
        updatedAt,
        Studio (
          id,
          name
        ),
        ProjectMember (
          id,
          role,
          profileId,
          Profile (
            id,
            User (
              firstName,
              lastName
            )
          )
        ),
        Scene (
          id,
          title,
          description,
          shootDate,
          duration,
          status,
          SceneTalent (
            id,
            role,
            notes,
            profileId,
            Profile (
              id,
              User (
                firstName,
                lastName
              )
            )
          )
        )
      `)
      .eq('id', projectId)
      .single();

    const project = handleDbOptional(projectResult);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get invitations for this profile
    const projectInvitationsResult = await supabase
      .from('ProjectInvitation')
      .select('id, status, role, sentAt')
      .eq('projectId', projectId)
      .eq('profileId', profileId);

    const projectInvitations = handleDbResult(projectInvitationsResult);

    return NextResponse.json({
      project: {
        ...project,
        ProjectInvitation: projectInvitations
      },
      memberStatus: memberCheck ? 'MEMBER' : 'INVITED',
      invitation: invitationCheck,
    });
  } catch (error) {
    console.error('Error fetching project details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project details' },
      { status: 500 }
    );
  }
}
