import { db, handleDbOptional, handleDbResult, generateId, now } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for submitting an application
const applicationSchema = z.object({
  message: z.string().min(10, { message: "Message must be at least 10 characters" }).max(1000, { message: "Message must be less than 1000 characters" }),
});

// POST /api/talent/casting-calls/[id]/apply - Apply to a casting call
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const castingCallId = params.id;
    const body = await request.json();

    // Validate input data
    const result = applicationSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const validatedData = result.data;

    // Find the user and check if they have a talent profile
    const userResult = await supabase
      .from('User')
      .select(`
        id,
        Profile (
          id
        ),
        RegionSubscription (
          id,
          status,
          RegionPlan (
            id,
            Region (
              id
            )
          )
        )
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Profile) {
      return NextResponse.json({ error: "Talent profile not found" }, { status: 404 });
    }

    const profileId = (user.Profile as any).id;

    // Check if the casting call exists and is open
    const castingCallResult = await supabase
      .from('CastingCall')
      .select(`
        id,
        status,
        Location (
          id,
          regionId,
          Region (
            id
          )
        )
      `)
      .eq('id', castingCallId)
      .single();

    const castingCall = handleDbOptional(castingCallResult);

    if (!castingCall) {
      return NextResponse.json({ error: "Casting call not found" }, { status: 404 });
    }

    if ((castingCall as any).status !== "OPEN") {
      return NextResponse.json({ error: "This casting call is no longer accepting applications" }, { status: 400 });
    }

    // NOTE: Subscription check removed to allow non-subscribers to apply to casting calls
    // Users will only need subscriptions for talent search/discovery features

    // Check if already applied
    const existingApplicationResult = await supabase
      .from('Application')
      .select('id')
      .eq('castingCallId', castingCallId)
      .eq('profileId', profileId)
      .maybeSingle();

    const existingApplication = handleDbOptional(existingApplicationResult);

    if (existingApplication) {
      return NextResponse.json({ error: "You have already applied to this casting call" }, { status: 400 });
    }

    // Create the application
    const applicationId = generateId();
    const timestamp = now();

    const newApplicationResult = await supabase
      .from('Application')
      .insert({
        id: applicationId,
        message: validatedData.message,
        profileId: profileId,
        castingCallId: castingCallId,
        status: 'PENDING',
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .select()
      .single();

    const application = handleDbResult(newApplicationResult);

    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    console.error("Error applying to casting call:", error);
    return NextResponse.json({
      error: "Failed to submit application",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
