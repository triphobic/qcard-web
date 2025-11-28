import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// This endpoint is called during the sign-up process to check if the email
// matches an external actor and convert them if it does
export async function GET(request: Request) {
  try {
    const supabase = db();

    const session = await getSession();

    if (!session || !session.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = session.profile.email;

    if (!email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    // Find the user's profile
    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Profile:Profile(*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user || !user.Profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get the user's phone number
    const phoneNumber = user.phoneNumber;

    // Find any external actors with matching email or phone number
    let orConditions = [
      supabase
        .from('ExternalActor')
        .select(`
          *,
          studio:Studio(*),
          projects:ExternalActorProject(
            *,
            project:Project(*)
          )
        `)
        .eq('email', email)
        .neq('status', 'CONVERTED')
    ];

    if (phoneNumber) {
      orConditions.push(
        supabase
          .from('ExternalActor')
          .select(`
            *,
            studio:Studio(*),
            projects:ExternalActorProject(
              *,
              project:Project(*)
            )
          `)
          .eq('phoneNumber', phoneNumber)
          .neq('status', 'CONVERTED')
      );
    }

    const results = await Promise.all(orConditions);
    const externalActors: any[] = [];

    results.forEach(result => {
      const actors = handleDbResult(result);
      externalActors.push(...actors);
    });

    // Deduplicate by ID
    const uniqueActors = Array.from(
      new Map(externalActors.map(actor => [actor.id, actor])).values()
    );

    if (uniqueActors.length === 0) {
      return NextResponse.json({
        converted: false,
        message: phoneNumber
          ? 'No external actor records found matching your email or phone number'
          : 'No external actor records found matching your email'
      });
    }

    // Convert all found external actors
    const conversionResults = [];

    for (const actor of uniqueActors) {
      // Update the external actor record
      await supabase
        .from('ExternalActor')
        .update({
          status: 'CONVERTED',
          convertedToTalentAt: new Date().toISOString(),
          convertedProfileId: user.Profile.id,
          updatedAt: new Date().toISOString()
        })
        .eq('id', actor.id);

      // Create project members for each project the external actor was part of
      for (const projectAssignment of actor.projects || []) {
        // Check if the user is already a member of this project
        const existingMemberResult = await supabase
          .from('ProjectMember')
          .select('id')
          .eq('projectId', projectAssignment.projectId)
          .eq('profileId', user.Profile.id)
          .single();

        const existingMember = handleDbOptional(existingMemberResult);

        // If not already a member, add them to the project
        if (!existingMember) {
          await supabase
            .from('ProjectMember')
            .insert({
              id: crypto.randomUUID(),
              projectId: projectAssignment.projectId,
              profileId: user.Profile.id,
              role: projectAssignment.role || 'Talent',
              notes: `Converted from external actor: ${actor.email}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
        }
      }

      conversionResults.push({
        id: actor.id,
        studio: actor.studio.name,
        projects: (actor.projects || []).length,
      });
    }

    return NextResponse.json({
      converted: true,
      message: `Successfully converted ${uniqueActors.length} external actor records`,
      conversions: conversionResults,
    });
  } catch (error) {
    console.error('Error converting external actor:', error);
    return NextResponse.json(
      { error: 'Failed to convert external actor' },
      { status: 500 }
    );
  }
}
