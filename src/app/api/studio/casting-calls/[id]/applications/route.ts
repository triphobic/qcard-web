import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/studio/casting-calls/[id]/applications - Get all applications for a casting call
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const castingCallId = params.id;

    const supabase = db();

    // Find the user and their tenant
    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== "STUDIO") {
      return NextResponse.json({ error: "Only studio accounts can access applications" }, { status: 403 });
    }

    // Find the studio associated with this tenant
    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.Tenant.id)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    // Check if the casting call belongs to this studio
    const castingCallResult = await supabase
      .from('CastingCall')
      .select('*')
      .eq('id', castingCallId)
      .eq('studioId', studio.id)
      .single();

    const castingCall = handleDbOptional(castingCallResult);

    if (!castingCall) {
      return NextResponse.json({ error: "Unauthorized to access these applications" }, { status: 403 });
    }

    // Get all applications for this casting call
    const applicationsResult = await supabase
      .from('Application')
      .select(`
        *,
        Profile (
          *,
          User (
            firstName,
            lastName,
            email
          ),
          Skill (*),
          Location (*)
        ),
        CastingCall (
          title
        )
      `)
      .eq('castingCallId', castingCallId)
      .order('createdAt', { ascending: false });

    const applications = handleDbResult(applicationsResult);

    return NextResponse.json(applications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    return NextResponse.json({
      error: "Failed to fetch applications",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
