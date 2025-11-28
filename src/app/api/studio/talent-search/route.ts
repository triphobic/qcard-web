import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { getSession } from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

// GET /api/studio/talent/search - Search for talent based on query parameters
export async function GET(request: Request) {
  const supabase = db();
  const session = await getSession();
  
  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Check if the user belongs to a studio tenant
  const userResult = await supabase
    .from('User')
    .select('*, Tenant(*)')
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
    // Age field has been removed from the schema
    // const minAge = searchParams.get('minAge') ? parseInt(searchParams.get('minAge')!) : undefined;
    // const maxAge = searchParams.get('maxAge') ? parseInt(searchParams.get('maxAge')!) : undefined;
    const gender = searchParams.get('gender');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;
    
    // Debug: Check total talent profiles
    // Note: This is a simplified count query - the original filtered by User.Tenant.type
    const totalTalentProfilesResult = await supabase
      .from('Profile')
      .select('id', { count: 'exact', head: true });
    const totalTalentProfiles = totalTalentProfilesResult.count || 0;
    console.log(`Total talent profiles in database: ${totalTalentProfiles}`);
    
    // Build where clause based on search parameters
    let whereClause: any = {
      User: {
        NOT: {
          Tenant: {
            type: 'STUDIO'
          }
        }
      }
    };
    
    if (query) {
      whereClause.OR = [
        {
          User: {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
        },
        { bio: { contains: query, mode: 'insensitive' } },
        { Skill: { some: { name: { contains: query, mode: 'insensitive' } } } },
      ];
    }
    
    if (locationId) {
      whereClause.Location = {
        some: { id: locationId },
      };
    }
    
    if (skillId) {
      whereClause.Skill = {
        some: { id: skillId },
      };
    }
    
    // Age field has been removed from the schema
    // if (minAge !== undefined) {
    //   whereClause.age = {
    //     ...whereClause.age,
    //     gte: minAge,
    //   };
    // }
    
    // if (maxAge !== undefined) {
    //   whereClause.age = {
    //     ...whereClause.age,
    //     lte: maxAge,
    //   };
    // }
    
    if (gender) {
      whereClause.gender = gender;
    }
    
    // Execute the search query
    // Note: This is a simplified version of the original Prisma query
    // Complex nested filtering (like whereClause) may need RPC functions or multiple queries
    let profilesQuery = supabase
      .from('Profile')
      .select(`
        *,
        User!inner(id, firstName, lastName, email),
        ProfileImage(*)
      `)
      .order('updatedAt', { ascending: false })
      .range(skip, skip + limit - 1);

    // Apply basic filters
    if (gender) {
      profilesQuery = profilesQuery.eq('gender', gender);
    }
    if (locationId) {
      // Note: Location filtering may need a join table query
      console.log('Location filtering needs implementation with proper join table');
    }
    if (skillId) {
      // Note: Skill filtering may need a join table query
      console.log('Skill filtering needs implementation with proper join table');
    }

    const profilesResult = await profilesQuery;
    const profiles = handleDbResult(profilesResult);

    const totalCountResult = await supabase
      .from('Profile')
      .select('id', { count: 'exact', head: true });

    const totalCount = totalCountResult.count || 0;
    
    // Format the results
    const results = profiles.map((profile: any) => ({
      id: profile.id,
      userId: profile.userId,
      name: `${profile.User?.firstName || ''} ${profile.User?.lastName || ''}`.trim(),
      email: profile.User?.email,
      bio: profile.bio,
      gender: profile.gender,
      availability: profile.availability,
      skills: [], // Note: Skill data needs many-to-many join query
      locations: [], // Note: Location data needs many-to-many join query
      imageUrl: profile.ProfileImage?.find((img: any) => img.isPrimary)?.url || profile.ProfileImage?.[0]?.url || null,
      user: profile.User,
      updatedAt: profile.updatedAt,
    }));
    
    return NextResponse.json({
      profiles: results,
      totalCount,
      page,
      limit,
      pages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error("Error searching talent:", error);
    return NextResponse.json({ error: "Failed to search talent" }, { status: 500 });
  }
}