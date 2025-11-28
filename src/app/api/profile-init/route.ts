import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// This endpoint initializes a profile for a user if they don't have one yet
export async function POST() {
  const session = await getSession();
  
  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const supabase = db();

    // Check if user has a profile
    const { data: existingProfile } = await supabase
      .from('Profile')
      .select('*')
      .eq('userId', session.profile.id)
      .single();

    if (existingProfile) {
      return NextResponse.json({
        message: "Profile already exists",
        profile: existingProfile
      });
    }

    // Create a new profile for the user
    const now = new Date().toISOString();
    const { data: newProfile, error: createError } = await supabase
      .from('Profile')
      .insert({
        id: crypto.randomUUID(),
        userId: session.profile.id,
        availability: true,
        createdAt: now,
        updatedAt: now
      })
      .select(`
        *,
        Location(*),
        Skill(*),
        ProfileImage(*)
      `)
      .single();

    if (createError) {
      console.error('Error creating profile:', createError);
      throw createError;
    }
    
    return NextResponse.json({
      message: "Profile created successfully",
      profile: newProfile
    });
    
  } catch (error) {
    console.error("Error initializing profile:", error);
    return NextResponse.json({ 
      error: "Failed to initialize profile",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}