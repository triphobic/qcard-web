import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { z } from 'zod';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Schema for validating submission data
const castingSubmissionSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required" }),
  lastName: z.string().min(1, { message: "Last name is required" }),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  message: z.string().optional(),
  code: z.string().min(1, { message: "Casting code is required" }),
  createAccount: z.boolean().optional().default(false),
  surveyResponses: z.record(z.string(), z.any()).optional(),
});

// POST - Submit application via casting code
export async function POST(request: Request) {
  try {
    const supabase = db();

    // Parse and validate request body
    const body = await request.json();
    const validatedData = castingSubmissionSchema.parse(body);

    // Retrieve the casting code
    const castingCodeResult = await supabase
      .from('CastingCode')
      .select(`
        *,
        studio:Studio(*),
        project:Project(*)
      `)
      .eq('code', validatedData.code)
      .single();

    const castingCode = handleDbOptional(castingCodeResult);
    
    if (!castingCode) {
      return NextResponse.json(
        { error: 'Invalid casting code' },
        { status: 404 }
      );
    }
    
    // Check if the code is active
    if (!castingCode.isActive) {
      return NextResponse.json(
        { error: 'This casting code is no longer active' },
        { status: 400 }
      );
    }
    
    // Check if the code has expired
    if (castingCode.expiresAt && castingCode.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This casting code has expired' },
        { status: 400 }
      );
    }
    
    // Create a new external actor if the person doesn't exist yet
    let externalActor = null;

    // Check if this person already exists as an external actor for this studio
    if (validatedData.email) {
      const actorByEmailResult = await supabase
        .from('ExternalActor')
        .select('*')
        .eq('email', validatedData.email)
        .eq('studioId', castingCode.studioId)
        .single();

      externalActor = handleDbOptional(actorByEmailResult);
      console.log('Existing actor found by email:', externalActor?.id);
    }

    // If not found by email, try to match by name
    if (!externalActor) {
      const actorByNameResult = await supabase
        .from('ExternalActor')
        .select('*')
        .eq('firstName', validatedData.firstName)
        .eq('lastName', validatedData.lastName)
        .eq('studioId', castingCode.studioId)
        .single();

      externalActor = handleDbOptional(actorByNameResult);
      console.log('Existing actor found by name:', externalActor?.id);
    }

    // If we still don't have an external actor, create one
    if (!externalActor) {
      console.log('Creating new external actor for studio:', castingCode.studioId);
      try {
        const newActorResult = await supabase
          .from('ExternalActor')
          .insert({
            id: crypto.randomUUID(),
            firstName: validatedData.firstName,
            lastName: validatedData.lastName,
            email: validatedData.email,
            phoneNumber: validatedData.phoneNumber,
            studioId: castingCode.studioId,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .select()
          .single();

        externalActor = handleDbResult(newActorResult);
        console.log('New external actor created:', externalActor.id);
      } catch (error) {
        console.error('Error creating external actor:', error);
        throw error;
      }
    } else {
      // Update existing external actor with any new information
      console.log('Updating existing external actor:', externalActor.id);
      const updatedActorResult = await supabase
        .from('ExternalActor')
        .update({
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          email: validatedData.email || externalActor.email,
          phoneNumber: validatedData.phoneNumber || externalActor.phoneNumber,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', externalActor.id)
        .select()
        .single();

      externalActor = handleDbResult(updatedActorResult);
    }
    
    // Create the casting submission
    console.log('Creating casting submission with external actor ID:', externalActor.id);
    let submission;
    try {
      const submissionResult = await supabase
        .from('CastingSubmission')
        .insert({
          id: crypto.randomUUID(),
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          email: validatedData.email,
          phoneNumber: validatedData.phoneNumber,
          message: validatedData.message,
          castingCodeId: castingCode.id,
          externalActorId: externalActor.id,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .select()
        .single();

      submission = handleDbResult(submissionResult);
      console.log('Created submission:', submission.id);
    } catch (error) {
      console.error('Error creating submission:', error);
      throw error;
    }

    // Process survey responses if they exist
    if (validatedData.surveyResponses && Object.keys(validatedData.surveyResponses).length > 0 && castingCode.surveyFields) {
      // Create survey response record
      await supabase
        .from('CastingSubmissionSurvey')
        .insert({
          id: crypto.randomUUID(),
          submissionId: submission.id,
          responses: validatedData.surveyResponses,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
    }

    // Add this external actor to the project if there is one
    if (castingCode.projectId) {
      console.log('Checking if external actor is already in project:', castingCode.projectId);
      try {
        // Check if the external actor is already in this project
        const existingAssociationResult = await supabase
          .from('ExternalActorProject')
          .select('id')
          .eq('externalActorId', externalActor.id)
          .eq('projectId', castingCode.projectId)
          .single();

        const existingProjectAssociation = handleDbOptional(existingAssociationResult);

        if (!existingProjectAssociation) {
          console.log('Adding external actor to project');
          // Add the external actor to the project
          const projectAssociationResult = await supabase
            .from('ExternalActorProject')
            .insert({
              id: crypto.randomUUID(),
              externalActorId: externalActor.id,
              projectId: castingCode.projectId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            .select()
            .single();

          const projectAssociation = handleDbResult(projectAssociationResult);
          console.log('Created project association:', projectAssociation.id);
        } else {
          console.log('External actor already in project:', existingProjectAssociation.id);
        }
      } catch (error) {
        console.error('Error adding external actor to project:', error);
        // Continue even if project association fails
      }
    }
    
    // Handle the create account option
    // Return the submission ID and user data for redirecting to sign-up
    console.log('Returning submission response with createAccount:', validatedData.createAccount);
    
    const response = {
      success: true,
      message: "Your submission has been received successfully!",
      submissionId: submission.id,
      createAccount: validatedData.createAccount,
      userData: {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        email: validatedData.email || '',
        phoneNumber: validatedData.phoneNumber || '',
      }
    };
    
    console.log('Final response:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing casting submission:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.format() },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to process submission' },
      { status: 500 }
    );
  }
}