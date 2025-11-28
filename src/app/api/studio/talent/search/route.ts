import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { getSession } from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

// GET /api/studio/talent/search - Search for talent based on query parameters
export async function GET(request: Request) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = db();

  // Check if the user belongs to a studio tenant
  const userResult = await supabase
    .from('User')
    .select(`
      id,
      tenantId,
      Tenant:Tenant(
        id,
        type
      )
    `)
    .eq('id', session.profile.id)
    .single();

  const user = handleDbOptional(userResult);

  if (!user?.Tenant || user.Tenant.type !== 'STUDIO') {
    return NextResponse.json({ error: "Only studio accounts can access this endpoint" }, { status: 403 });
  }

  try {
    // Get URL search parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const locationId = searchParams.get('locationId');
    const skillId = searchParams.get('skillId');
    const gender = searchParams.get('gender');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build the base query for profiles
    let profilesQuery = supabase
      .from('Profile')
      .select(`
        *,
        User:User!Profile_userId_fkey(
          id,
          firstName,
          lastName,
          email,
          tenantId,
          Tenant:Tenant(type)
        ),
        ProfileImage:ProfileImage(url, isPrimary)
      `, { count: 'exact' })
      .not('User.Tenant.type', 'eq', 'STUDIO')
      .range(skip, skip + limit - 1)
      .order('updatedAt', { ascending: false });

    // Apply gender filter
    if (gender) {
      profilesQuery = profilesQuery.eq('gender', gender);
    }

    // Execute the base query first
    const profilesResult = await profilesQuery;
    let profiles = handleDbResult(profilesResult);
    const totalCount = profilesResult.count || 0;

    // Filter by query text (name, email, bio) in memory since OR queries are complex in Supabase
    if (query) {
      profiles = profiles.filter((profile: any) => {
        const firstName = profile.User?.firstName || '';
        const lastName = profile.User?.lastName || '';
        const email = profile.User?.email || '';
        const bio = profile.bio || '';
        const searchText = `${firstName} ${lastName} ${email} ${bio}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      });
    }

    // Get locations for filtering
    if (locationId) {
      const locationProfiles = await supabase
        .from('_LocationToProfile')
        .select('B')
        .eq('A', locationId);

      const locationProfileIds = handleDbResult(locationProfiles).map((r: any) => r.B);
      profiles = profiles.filter((p: any) => locationProfileIds.includes(p.id));
    }

    // Get skills for filtering
    if (skillId) {
      const skillProfiles = await supabase
        .from('_ProfileToSkill')
        .select('A')
        .eq('B', skillId);

      const skillProfileIds = handleDbResult(skillProfiles).map((r: any) => r.A);
      profiles = profiles.filter((p: any) => skillProfileIds.includes(p.id));
    }

    // Enrich profiles with locations and skills
    const enrichedProfiles = await Promise.all(
      profiles.map(async (profile: any) => {
        // Get locations
        const locationIds = await supabase
          .from('_LocationToProfile')
          .select('A')
          .eq('B', profile.id);

        const locIds = handleDbResult(locationIds).map((r: any) => r.A);
        let locations: any[] = [];
        if (locIds.length > 0) {
          const locsResult = await supabase
            .from('Location')
            .select('*')
            .in('id', locIds);
          locations = handleDbResult(locsResult);
        }

        // Get skills
        const skillIds = await supabase
          .from('_ProfileToSkill')
          .select('B')
          .eq('A', profile.id);

        const skIds = handleDbResult(skillIds).map((r: any) => r.B);
        let skills: any[] = [];
        if (skIds.length > 0) {
          const skillsResult = await supabase
            .from('Skill')
            .select('*')
            .in('id', skIds);
          skills = handleDbResult(skillsResult);
        }

        // Filter by query in skills
        if (query) {
          const hasMatchingSkill = skills.some((skill: any) =>
            skill.name.toLowerCase().includes(query.toLowerCase())
          );
          if (!hasMatchingSkill && !profile._matchedByText) {
            return null; // Will be filtered out
          }
        }

        return {
          ...profile,
          Location: locations,
          Skill: skills,
        };
      })
    );

    // Filter out nulls and format the results
    const results = enrichedProfiles
      .filter((p) => p !== null)
      .slice(0, limit)
      .map((profile: any) => ({
        id: profile.id,
        userId: profile.userId,
        name: `${profile.User?.firstName || ''} ${profile.User?.lastName || ''}`.trim(),
        email: profile.User?.email,
        bio: profile.bio,
        gender: profile.gender,
        availability: profile.availability,
        skills: profile.Skill || [],
        locations: profile.Location || [],
        imageUrl: profile.ProfileImage?.find((img: any) => img.isPrimary)?.url || null,
        user: profile.User,
        updatedAt: profile.updatedAt,
      }));

    return NextResponse.json({
      profiles: results,
      totalCount: results.length,
      page,
      limit,
      pages: Math.ceil(results.length / limit),
    });
  } catch (error) {
    console.error("Error searching talent:", error);
    return NextResponse.json({ error: "Failed to search talent" }, { status: 500 });
  }
}
