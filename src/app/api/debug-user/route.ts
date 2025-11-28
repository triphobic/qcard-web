import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = db();

    const session = await getSession();
    
    if (!session?.profile?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    console.log("Debug endpoint - fetching user data for:", session.profile.id);

    // First get basic user information (without complex relations)
    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant:Tenant(*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Remove password for security
    const { password, ...userData } = user;

    // Separately fetch profile information to avoid relation issues
    let profileData = null;
    try {
      const profileResult = await supabase
        .from('Profile')
        .select('*')
        .eq('userId', session.profile.id)
        .single();

      const profile = handleDbOptional(profileResult);

      if (profile) {
        // Get relations in separate queries to avoid schema issues
        const [locationsResult, skillsResult] = await Promise.all([
          supabase
            .from('_LocationToProfile')
            .select('A')
            .eq('B', profile.id)
            .then(async (result) => {
              const locationIds = handleDbResult(result).map((r: any) => r.A);
              if (locationIds.length === 0) return [];
              return supabase
                .from('Location')
                .select('*')
                .in('id', locationIds)
                .then(r => handleDbResult(r));
            }),
          supabase
            .from('_ProfileToSkill')
            .select('B')
            .eq('A', profile.id)
            .then(async (result) => {
              const skillIds = handleDbResult(result).map((r: any) => r.B);
              if (skillIds.length === 0) return [];
              return supabase
                .from('Skill')
                .select('*')
                .in('id', skillIds)
                .then(r => handleDbResult(r));
            })
        ]);

        // Safely try to get the profile images separately
        let images: any[] = [];
        try {
          const imagesResult = await supabase
            .from('ProfileImage')
            .select('*')
            .eq('profileId', profile.id);

          images = handleDbResult(imagesResult);
        } catch (imgErr) {
          console.error("Error fetching profile images:", imgErr);
        }

        profileData = {
          ...profile,
          locations: locationsResult,
          skills: skillsResult,
          images
        };
      }
    } catch (profileErr) {
      console.error("Error fetching profile details:", profileErr);
      profileData = { error: "Failed to fetch profile details" };
    }
    
    // Return detailed user info for debugging
    return NextResponse.json({
      message: "Debug user information",
      user: {
        ...userData,
        profile: profileData
      },
      session: {
        id: session.profile.id,
        email: session.profile.email,
        name: session.profile.name,
        tenantType: (session.profile as any).tenantType
      }
    });
  } catch (error) {
    console.error("Error fetching debug user info:", error);
    return NextResponse.json({ 
      error: "Failed to fetch debug user info",
      errorDetails: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}