import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/talent/project-invitations - Get all project invitations for the current talent
export async function GET(request: Request) {
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

    // Parse query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    // Build query
    let query = supabase
      .from('ProjectInvitation')
      .select(`
        id,
        status,
        role,
        sentAt,
        respondedAt,
        expiresAt,
        message,
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
      .eq('profileId', profileId)
      .order('sentAt', { ascending: false });

    // Add status filter if provided
    if (status) {
      query = query.eq('status', status);
    }

    const invitationsResult = await query;
    const invitations = handleDbResult(invitationsResult);

    // Transform the data to match expected format
    const formattedInvitations = invitations.map((inv: any) => ({
      id: inv.id,
      status: inv.status,
      role: inv.role,
      sentAt: inv.sentAt,
      respondedAt: inv.respondedAt,
      expiresAt: inv.expiresAt,
      message: inv.message,
      project: {
        id: inv.Project.id,
        title: inv.Project.title,
        description: inv.Project.description,
        startDate: inv.Project.startDate,
        endDate: inv.Project.endDate,
        status: inv.Project.status,
        Studio: {
          id: inv.Project.Studio.id,
          name: inv.Project.Studio.name,
          description: inv.Project.Studio.description,
        }
      }
    }));

    return NextResponse.json(formattedInvitations);
  } catch (error) {
    console.error("Error fetching project invitations:", error);
    return NextResponse.json({
      error: "Failed to fetch project invitations",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
