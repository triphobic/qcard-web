import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

// GET /api/talent/profile/[id] - Get a specific talent profile by ID
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
    const { id } = params;

    // Get the current user data including tenant information
    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*),
        Profile (*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user) {
      return NextResponse.json({ error: "User data not found" }, { status: 404 });
    }

    let isAuthorized = false;

    // If it's an admin or super admin, they can access all profiles
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      isAuthorized = true;
    }
    // If talent user, they can only see their own profile
    else if (user.Tenant?.type === 'TALENT' && user.Profile) {
      isAuthorized = user.Profile.id === id;
    }
    // If studio user, check if this talent was converted from their external actor
    else if (user.Tenant?.type === 'STUDIO') {
      // Find the studio for this user
      const studioResult = await supabase
        .from('Studio')
        .select('id')
        .eq('tenantId', user.tenantId || '')
        .single();

      const studio = handleDbOptional(studioResult);

      if (studio) {
        // Check if this profile was converted from this studio's external actor
        const externalActorResult = await supabase
          .from('ExternalActor')
          .select('id')
          .eq('studioId', studio.id)
          .eq('convertedProfileId', id)
          .eq('status', 'CONVERTED')
          .single();

        const externalActor = handleDbOptional(externalActorResult);
        isAuthorized = !!externalActor;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({
        error: "You don't have permission to view this profile"
      }, { status: 403 });
    }

    // Get user profile with related data
    const profileResult = await supabase
      .from('Profile')
      .select(`
        *,
        User (
          firstName,
          lastName,
          email
        ),
        Location (*),
        Skill (*),
        ProfileImage (*)
      `)
      .eq('id', id)
      .single();

    const profile = handleDbOptional(profileResult);

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Sort ProfileImage by isPrimary (primary first)
    if (profile.ProfileImage) {
      profile.ProfileImage.sort((a: any, b: any) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching talent profile:", error);
    return NextResponse.json({ error: "Failed to fetch talent profile" }, { status: 500 });
  }
}