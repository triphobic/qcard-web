import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// This endpoint initializes a profile for a talent user if they don't have one yet
export async function POST() {
  const session = await getSession();
  
  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const supabase = db();

    // Enhanced session logging for debugging
    console.log("Initializing profile for user:", {
      userId: session.profile.id,
      email: session.profile.email,
      sessionData: JSON.stringify(session)
    });

    // Additional debugging to understand the session issue
    console.log("SESSION DEBUG - Looking up session user in database");

    // Try to find the user
    const userResult = await supabase
      .from('User')
      .select('id, email')
      .eq('id', session.profile.id)
      .single();

    let user = handleDbOptional(userResult);

    console.log("SESSION DEBUG - User result:", user);

    // If user is not found by ID, try to find by email
    if (!user && session.profile.email) {
      console.log("SESSION DEBUG - User not found by ID, trying email lookup");

      const userByEmailResult = await supabase
        .from('User')
        .select('id, email')
        .eq('email', session.profile.email)
        .single();

      const userByEmail = handleDbOptional(userByEmailResult);

      console.log("SESSION DEBUG - User found by email:", userByEmail);

      // If we found a user by email but the ID doesn't match the session
      if (userByEmail && userByEmail.id !== session.profile.id) {
        console.log("SESSION DEBUG - CRITICAL: Session ID mismatch detected!");
        console.log(`Session has ID ${session.profile.id} but database has ID ${userByEmail.id} for email ${session.profile.email}`);
        // Update the user reference to use the correct ID
        user = userByEmail;
        session.profile.id = userByEmail.id;
      }
    }
    
    // Check if user has a profile
    console.log("Checking for existing profile...");

    // If we still couldn't find the user, proceed with original ID (will likely fail later)
    const userIdToUse = user?.id || session.profile.id;

    // Check for existing profile with relations
    console.log(`Looking for profile with userId: ${userIdToUse}`);
    const existingProfileResult = await supabase
      .from('Profile')
      .select(`
        *,
        Location (*),
        Skill (*)
      `)
      .eq('userId', userIdToUse)
      .single();

    const existingProfile = handleDbOptional(existingProfileResult);

    // If profile exists, get images separately
    let profileImages: any[] = [];
    if (existingProfile) {
      try {
        const imagesResult = await supabase
          .from('ProfileImage')
          .select('*')
          .eq('profileId', existingProfile.id);

        profileImages = handleDbResult(imagesResult);
      } catch (imgError) {
        console.error("Error fetching profile images:", imgError);
      }
    }

    if (existingProfile) {
      console.log("Profile already exists for user", session.profile.id);
      return NextResponse.json({
        message: "Profile already exists",
        profile: {
          ...existingProfile,
          images: profileImages
        }
      });
    }

    console.log("No existing profile found, creating new profile");

    // Check if user exists first
    console.log("Checking if user exists with ID:", session.profile.id);
    const userExistsResult = await supabase
      .from('User')
      .select('id, email')
      .eq('id', session.profile.id)
      .single();

    let userExists = handleDbOptional(userExistsResult);

    // If user not found by ID but we have an email, try to find by email
    if (!userExists && session.profile.email) {
      console.log("User not found by ID, trying by email:", session.profile.email);

      const userByEmailResult = await supabase
        .from('User')
        .select('id, email')
        .eq('email', session.profile.email)
        .single();

      const userByEmail = handleDbOptional(userByEmailResult);

      if (userByEmail) {
        console.log("Found user by email instead of ID:", userByEmail);
        userExists = userByEmail;

        // CRITICAL: We found the user but with a different ID than in the session
        console.log("SESSION MISMATCH DETECTED - Session has wrong user ID");
        console.log(`Session ID: ${session.profile.id}, Actual user ID: ${userByEmail.id}`);

        // Use the correct ID for profile creation
        // This is a temporary workaround for the session mismatch issue
        console.log("Using correct user ID from email lookup for profile creation");
        session.profile.id = userByEmail.id;
      }
    }

    if (!userExists) {
      console.error("User not found by ID or email:", session.profile.id, session.profile.email);
      return NextResponse.json({
        error: "User not found when creating profile"
      }, { status: 404 });
    }
    
    // Create a new profile for the user with error handling
    try {
      console.log("Creating new profile for user ID:", session.profile.id);

      const newProfileResult = await supabase
        .from('Profile')
        .insert({
          id: crypto.randomUUID(),
          userId: session.profile.id,
          availability: true, // Default to available
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .select(`
          *,
          Location (*),
          Skill (*)
        `)
        .single();

      const newProfile = handleDbResult(newProfileResult);

      // Profile was created successfully
      console.log("Profile created successfully for user", session.profile.id);
      return NextResponse.json({
        message: "Profile created successfully",
        profile: {
          ...newProfile,
          images: [] // New profile won't have images yet
        }
      });
    } catch (createError) {
      console.error("Database error creating profile:", createError);

      // Additional info for error diagnosis
      if (createError instanceof Error && createError.message.includes('duplicate key')) {
        return NextResponse.json({
          error: "Profile already exists but could not be found (unique constraint violation)",
          details: createError.message
        }, { status: 409 });
      }

      throw createError; // Re-throw to be caught by outer catch
    }
    
  } catch (error: unknown) {
    console.error("Error initializing profile:", error);
    let errorMessage = "Unknown error";
    let errorCode = "unknown";
    
    if (error instanceof Error) {
      errorMessage = error.message;
      if ('code' in error) {
        errorCode = (error as any).code || 'unknown';
      }
    }
    
    return NextResponse.json({ 
      error: "Failed to initialize profile",
      message: errorMessage,
      code: errorCode
    }, { status: 500 });
  }
}