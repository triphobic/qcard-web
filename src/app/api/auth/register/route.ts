
// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
/**
 * User Registration API Route (Supabase Auth)
 *
 * This endpoint creates the application-specific user profile
 * after Supabase Auth has created the authentication user.
 */

import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase';
import { db, handleDbOptional, generateId, now } from '@/lib/supabase-db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      userId,
      email,
      firstName,
      lastName,
      phoneNumber,
      userType,
      submissionId,
    } = body;

    // Validate required fields
    if (!userId || !email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Creating user profile for:', email);

    // Verify the user exists in Supabase Auth (using service role key)
    const supabaseAuth = getServerSupabaseClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.admin.getUserById(userId);

    if (authError || !user) {
      console.error('Failed to verify Supabase user:', authError);
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const dbClient = db();

    // Check if user already exists in our database
    const existingUserResult = await dbClient
      .from('User')
      .select('*')
      .eq('id', userId)
      .single();

    const existingUser = handleDbOptional(existingUserResult);

    if (existingUser) {
      console.log('User profile already exists');
      return NextResponse.json({ user: existingUser });
    }

    // Create tenant if userType is provided
    let tenantId: string | null = null;
    if (userType === 'TALENT' || userType === 'STUDIO') {
      const tenantResult = await dbClient
        .from('Tenant')
        .insert({
          id: generateId(),
          tenantType: userType,
          createdAt: now(),
          updatedAt: now(),
        })
        .select()
        .single();

      if (tenantResult.error) throw tenantResult.error;
      tenantId = tenantResult.data.id;
      console.log(`Created ${userType} tenant:`, tenantId);
    }

    // Create user profile in our database
    const newUserResult = await dbClient
      .from('User')
      .insert({
        id: userId, // Use Supabase auth user ID
        email,
        firstName,
        lastName,
        phoneNumber: phoneNumber || null,
        tenantId,
        role: 'USER', // Default role
        createdAt: now(),
        updatedAt: now(),
      })
      .select()
      .single();

    if (newUserResult.error) throw newUserResult.error;
    const newUser = newUserResult.data;

    console.log('User profile created:', newUser.id);

    // If user is TALENT, create their profile
    if (userType === 'TALENT') {
      const profileResult = await dbClient
        .from('Profile')
        .insert({
          id: generateId(),
          userId: newUser.id,
          availability: true,
          createdAt: now(),
          updatedAt: now(),
        })
        .select()
        .single();

      if (profileResult.error) throw profileResult.error;
      console.log('Talent profile created:', profileResult.data.id);
    }

    // If user is STUDIO, create their studio
    if (userType === 'STUDIO') {
      const studioName = `${firstName} ${lastName}'s Studio`;
      const studioResult = await dbClient
        .from('Studio')
        .insert({
          id: generateId(),
          name: studioName,
          userId: newUser.id,
          createdAt: now(),
          updatedAt: now(),
        })
        .select()
        .single();

      if (studioResult.error) throw studioResult.error;
      console.log('Studio created:', studioResult.data.id);
    }

    // Handle casting code submission conversion if provided
    if (submissionId && userType === 'TALENT') {
      try {
        const submissionResult = await dbClient
          .from('CastingCodeSubmission')
          .select('*')
          .eq('id', submissionId)
          .single();

        const submission = handleDbOptional(submissionResult);

        if (submission) {
          // TODO: Convert external actor to talent profile
          // This would involve migrating submission data to the new user's profile
          console.log('Converting casting submission:', submissionId);
        }
      } catch (error) {
        console.error('Error converting submission:', error);
        // Don't fail registration if submission conversion fails
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        tenantType: userType,
      },
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}
