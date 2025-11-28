import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/talent/casting-calls/[id] - Get a specific casting call details
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const id = params.id;

    // Find the user and check if they have a talent profile
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

    if (!user?.Profile) {
      return NextResponse.json({ error: "Talent profile not found" }, { status: 404 });
    }

    const profileId = (user.Profile as any).id;

    // Get the casting call with detailed information
    const castingCallResult = await supabase
      .from('CastingCall')
      .select(`
        id,
        title,
        description,
        requirements,
        compensation,
        startDate,
        endDate,
        status,
        createdAt,
        updatedAt,
        Location (
          id,
          name
        ),
        CastingCallSkill (
          Skill (
            id,
            name
          )
        ),
        Studio (
          id,
          name,
          description
        ),
        Project (
          id,
          title,
          description
        ),
        Application!Application_castingCallId_fkey (
          id,
          status,
          message,
          createdAt,
          profileId
        )
      `)
      .eq('id', id)
      .single();

    const castingCall = handleDbOptional(castingCallResult);

    if (!castingCall) {
      return NextResponse.json({ error: "Casting call not found" }, { status: 404 });
    }

    // Filter applications to only include the current talent's application
    const userApplications = (castingCall as any).Application?.filter((app: any) =>
      app.profileId === profileId
    ) || [];

    // Format the data for the frontend
    const formattedCastingCall = {
      id: (castingCall as any).id,
      title: (castingCall as any).title,
      description: (castingCall as any).description,
      requirements: (castingCall as any).requirements,
      compensation: (castingCall as any).compensation,
      startDate: (castingCall as any).startDate,
      endDate: (castingCall as any).endDate,
      status: (castingCall as any).status,
      location: (castingCall as any).Location ? {
        id: (castingCall as any).Location.id,
        name: (castingCall as any).Location.name,
      } : null,
      skills: (castingCall as any).CastingCallSkill?.map((ccs: any) => ({
        id: ccs.Skill.id,
        name: ccs.Skill.name,
      })) || [],
      studio: (castingCall as any).Studio,
      project: (castingCall as any).Project,
      // Check if the talent has already applied
      application: userApplications.length > 0 ? {
        id: userApplications[0].id,
        status: userApplications[0].status,
        message: userApplications[0].message,
        createdAt: userApplications[0].createdAt,
      } : null,
      createdAt: (castingCall as any).createdAt,
      updatedAt: (castingCall as any).updatedAt,
    };

    return NextResponse.json(formattedCastingCall);
  } catch (error) {
    console.error("Error fetching casting call detail:", error);
    return NextResponse.json({
      error: "Failed to fetch casting call details",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
