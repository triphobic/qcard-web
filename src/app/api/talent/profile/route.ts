import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Validation schema for updating a profile
// Adjusted to match the actual database schema
const profileUpdateSchema = z.object({
  bio: z.string().optional().nullable(),
  height: z.string().optional().nullable(),
  weight: z.string().optional().nullable(),
  hairColor: z.string().optional().nullable(),
  eyeColor: z.string().optional().nullable(),
  // Field 'gender' might be causing issues - we'll still accept it but handle it specially
  gender: z.string().optional().nullable(),
  ethnicity: z.string().optional().nullable(),
  // age field has been removed from the schema
  // age: z.number().int().min(0).max(120).optional().nullable(),
  // Languages is actually stored as a string in the database according to the schema
  languages: z.union([
    z.array(z.string()),
    z.string()
  ]).optional().nullable(),
  experience: z.string().optional().nullable(),
  availability: z.boolean().optional(),
  headshotUrl: z.string().optional().nullable(),
  // Relation fields
  skillIds: z.array(z.string()).optional(),
  locationIds: z.array(z.string()).optional(),
});

// GET /api/talent/profile - Get the authenticated user's profile
export async function GET() {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    console.log("Fetching profile for user:", session.profile.id);

    // Get the user
    const userResult = await supabase
      .from('User')
      .select('id, email')
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user) {
      console.error("User not found in database:", session.profile.id);
      return NextResponse.json({
        error: "User not found",
        sessionUserId: session.profile.id
      }, { status: 404 });
    }

    console.log("User found, fetching profile");

    // Get the profile with relations
    const profileResult = await supabase
      .from('Profile')
      .select(`
        *,
        Skill (*),
        Location (*)
      `)
      .eq('userId', user.id)
      .single();

    const profile = handleDbOptional(profileResult);

    if (!profile) {
      console.log("Profile not found for user", user.id, "- needs initialization");
      return NextResponse.json({
        error: "Profile not found, needs initialization",
        userId: user.id
      }, { status: 404 });
    }

    console.log("Profile found, fetching images");

    // Get profile images separately
    const imagesResult = await supabase
      .from('ProfileImage')
      .select('*')
      .eq('profileId', profile.id)
      .order('isPrimary', { ascending: false }); // Primary image first

    const profileImages = handleDbResult(imagesResult);

    console.log(`Found ${profileImages.length} images`);

    // Construct a complete profile response with properly mapped relation fields
    const completeProfile = {
      ...profile,
      skills: profile.Skill || [],
      locations: profile.Location || [],
      images: profileImages
    };

    console.log("Returning complete profile with relations");
    return NextResponse.json(completeProfile);
  } catch (error) {
    console.error("Error fetching profile:", error);

    // Enhanced error details
    return NextResponse.json({
      error: "Failed to fetch profile",
      message: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      userId: session.profile.id
    }, { status: 500 });
  }
}

// PATCH /api/talent/profile - Update the authenticated user's profile
export async function PATCH(request: Request) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const body = await request.json();

    // Validate input data
    const result = profileUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const validatedData = result.data;

    console.log("Updating profile for user:", session.profile.id);

    // Get user profile
    const profileResult = await supabase
      .from('Profile')
      .select('id, userId')
      .eq('userId', session.profile.id)
      .single();

    let profile = handleDbOptional(profileResult);

    if (!profile) {
      console.log("Profile not found for user", session.profile.id, "- creating new profile during update");

      // Double-check that user exists first
      const userExistsResult = await supabase
        .from('User')
        .select('id')
        .eq('id', session.profile.id)
        .single();

      const userExists = handleDbOptional(userExistsResult);

      if (!userExists) {
        console.error("Cannot create profile: user not found:", session.profile.id);
        return NextResponse.json({ error: "User not found when creating profile" }, { status: 404 });
      }

      // Create profile if it doesn't exist
      const newProfileResult = await supabase
        .from('Profile')
        .insert({
          id: crypto.randomUUID(),
          userId: session.profile.id,
          availability: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .select()
        .single();

      profile = handleDbResult(newProfileResult);
      console.log("Created new profile during update for user", session.profile.id);
    }

    // Extract relation IDs
    const { skillIds, locationIds, ...allProfileData } = validatedData;

    // Safe fields that exist in the database schema
    const safeFields = [
      'bio', 'height', 'weight', 'hairColor', 'eyeColor',
      'experience', 'availability', 'headshotUrl',
      'gender', 'ethnicity'
    ];

    // Build update data
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    // Add safe fields to update data
    for (const [key, value] of Object.entries(allProfileData)) {
      if (safeFields.includes(key) && value !== undefined) {
        updateData[key] = value;
      }
    }

    // Handle languages field separately (convert array to comma-separated string)
    if (allProfileData.languages && Array.isArray(allProfileData.languages)) {
      updateData.languages = allProfileData.languages.join(',');
    }

    console.log("Updating profile with data:", {
      profileId: profile.id,
      userId: session.profile.id,
      fields: Object.keys(updateData),
    });

    // Update profile basic fields
    await supabase
      .from('Profile')
      .update(updateData)
      .eq('id', profile.id);

    // Update many-to-many relations if provided
    // Note: This requires junction tables (_ProfileToSkill and _ProfileToLocation)
    if (skillIds !== undefined) {
      console.log("Updating skills relation");
      // Delete existing relations
      await supabase
        .from('_ProfileToSkill')
        .delete()
        .eq('A', profile.id);

      // Insert new relations
      if (skillIds.length > 0) {
        const skillRelations = skillIds.map(skillId => ({
          A: profile.id,
          B: skillId,
        }));
        await supabase
          .from('_ProfileToSkill')
          .insert(skillRelations);
      }
    }

    if (locationIds !== undefined) {
      console.log("Updating locations relation");
      // Delete existing relations
      await supabase
        .from('_LocationToProfile')
        .delete()
        .eq('B', profile.id);

      // Insert new relations
      if (locationIds.length > 0) {
        const locationRelations = locationIds.map(locationId => ({
          A: locationId,
          B: profile.id,
        }));
        await supabase
          .from('_LocationToProfile')
          .insert(locationRelations);
      }
    }

    // Fetch the full updated profile with relations
    const fullProfileResult = await supabase
      .from('Profile')
      .select(`
        *,
        Skill (*),
        Location (*)
      `)
      .eq('id', profile.id)
      .single();

    const fullProfile = handleDbResult(fullProfileResult);

    // Fetch images separately
    const imagesResult = await supabase
      .from('ProfileImage')
      .select('*')
      .eq('profileId', fullProfile.id)
      .order('isPrimary', { ascending: false });

    const profileImages = handleDbResult(imagesResult);

    console.log("Profile updated successfully for user", session.profile.id);

    // Map relation fields for frontend compatibility
    return NextResponse.json({
      ...fullProfile,
      images: profileImages,
      skills: fullProfile.Skill || [],
      locations: fullProfile.Location || []
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({
      error: "Failed to update profile",
      message: error instanceof Error ? error.message : String(error),
      userId: session.profile.id
    }, { status: 500 });
  }
}