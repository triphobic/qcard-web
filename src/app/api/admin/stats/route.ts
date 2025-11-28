import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { requireAdmin } from '@/lib/admin-helpers';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/admin/stats
export async function GET() {
  try {
    const supabase = db();

    // Check admin access
    await requireAdmin();

    // Run queries in parallel for better performance
    console.log('Fetching admin statistics with Supabase');

    const [
      { count: usersCount },
      { count: studiosCount },
      { count: talentsCount },
      { count: projectsCount },
      { count: castingCallsCount },
      recentActivity
    ] = await Promise.all([
      supabase.from('User').select('*', { count: 'exact', head: true }),
      supabase.from('Studio').select('*', { count: 'exact', head: true }),
      supabase.from('Profile').select('*', { count: 'exact', head: true }),
      supabase.from('Project').select('*', { count: 'exact', head: true }),
      supabase.from('CastingCall').select('*', { count: 'exact', head: true }),
      getRecentActivity()
    ]);

    return NextResponse.json({
      users: usersCount || 0,
      studios: studiosCount || 0,
      talents: talentsCount || 0,
      projects: projectsCount || 0,
      castingCalls: castingCallsCount || 0,
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin statistics' },
      { status: 500 }
    );
  }
}

// Helper function to get recent activity
async function getRecentActivity() {
  const supabase = db();
  console.log('Fetching recent activity with Supabase');

  const [
    { data: recentUsers },
    { data: recentProjects },
    { data: recentCastingCalls }
  ] = await Promise.all([
    supabase
      .from('User')
      .select(`
        id,
        firstName,
        lastName,
        email,
        createdAt,
        Tenant (type)
      `)
      .order('createdAt', { ascending: false })
      .limit(5),
    supabase
      .from('Project')
      .select(`
        id,
        title,
        createdAt,
        Studio (name)
      `)
      .order('createdAt', { ascending: false })
      .limit(5),
    supabase
      .from('CastingCall')
      .select(`
        id,
        title,
        createdAt,
        Project (title)
      `)
      .order('createdAt', { ascending: false })
      .limit(5)
  ]);

  // Format and combine activities
  const activities = [
    ...(recentUsers || []).map((user: any) => ({
      type: 'user',
      id: user.id,
      description: `${user.firstName || ''} ${user.lastName || ''} (${user.Tenant?.type || 'User'}) registered`,
      time: user.createdAt
    })),
    ...(recentProjects || []).map((project: any) => ({
      type: 'project',
      id: project.id,
      description: `New project "${project.title}" created${project.Studio ? ` by ${project.Studio.name}` : ''}`,
      time: project.createdAt
    })),
    ...(recentCastingCalls || []).map((call: any) => ({
      type: 'castingCall',
      id: call.id,
      description: `Casting call "${call.title}" posted${call.Project ? ` for project "${call.Project.title}"` : ''}`,
      time: call.createdAt
    }))
  ];

  // Sort by date, most recent first, and take only 5
  return activities
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5);
}