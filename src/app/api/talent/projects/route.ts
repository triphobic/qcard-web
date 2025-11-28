import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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

    // Get URL parameters
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

    // Get projects where the talent is a member
    let memberProjectsQuery = supabase
      .from('ProjectMember')
      .select(`
        id,
        role,
        Project (
          id,
          title,
          description,
          status,
          startDate,
          endDate,
          updatedAt,
          Studio (
            id,
            name
          ),
          Scene (
            id,
            title,
            shootDate,
            duration,
            status,
            SceneTalent (
              id,
              role,
              notes
            )
          )
        )
      `)
      .eq('profileId', profileId)
      .order('updatedAt', { foreignTable: 'Project', ascending: false })
      .limit(limit);

    const memberProjectsResult = await memberProjectsQuery;
    const memberProjectsData = handleDbResult(memberProjectsResult);

    // Transform the data to match expected format
    const memberProjects = memberProjectsData
      .map((pm: any) => ({
        ...pm.Project,
        ProjectMember: [{
          profileId: profileId,
          role: pm.role
        }],
        Scene: pm.Project.Scene?.map((scene: any) => ({
          ...scene,
          SceneTalent: scene.SceneTalent?.filter((st: any) => st.profileId === profileId) || []
        })) || []
      }))
      .filter((project: any) => {
        // Apply status filter if provided
        if (statusFilter && project.status !== statusFilter) {
          return false;
        }
        return true;
      });

    // Get projects where the talent has invitations
    const invitedProjectsResult = await supabase
      .from('ProjectInvitation')
      .select(`
        id,
        status,
        role,
        sentAt,
        Project (
          id,
          title,
          description,
          status,
          startDate,
          endDate,
          updatedAt,
          Studio (
            id,
            name
          )
        )
      `)
      .eq('profileId', profileId)
      .order('sentAt', { ascending: false });

    const invitedProjectsData = handleDbResult(invitedProjectsResult);

    // Transform the data to match expected format
    const invitedProjects = invitedProjectsData.map((pi: any) => ({
      ...pi.Project,
      ProjectInvitation: [{
        profileId: profileId,
        status: pi.status,
        role: pi.role,
        sentAt: pi.sentAt
      }]
    }));

    return NextResponse.json({
      memberProjects,
      invitedProjects,
    });
  } catch (error) {
    console.error('Error fetching talent projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
