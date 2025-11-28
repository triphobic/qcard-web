import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Schema for adding an external actor to a project
const addToProjectSchema = z.object({
  externalActorId: z.string().uuid({ message: "Invalid external actor ID" }),
  projectId: z.string().uuid({ message: "Invalid project ID" }),
  role: z.string().optional(),
  notes: z.string().optional(),
});

// Schema for updating an external actor's project information
const updateProjectSchema = z.object({
  id: z.string().uuid({ message: "Invalid ID" }),
  role: z.string().optional(),
  notes: z.string().optional(),
});

// POST: Add an external actor to a project
export async function POST(request: Request) {
  try {
    const supabase = db();

    const session = await getSession();
    
    if (!session || !session.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get the studio ID from the user's tenant
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
    
    if (!user || !user.Tenant || user.Tenant.type !== 'STUDIO') {
      return NextResponse.json({ error: 'Not a studio user' }, { status: 403 });
    }
    
    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.tenantId)
      .single();

    const studio = handleDbOptional(studioResult);
    
    if (!studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }
    
    // Parse request body
    const body = await request.json();
    const validatedData = addToProjectSchema.parse(body);
    
    // Ensure the external actor belongs to this studio
    const externalActorResult = await supabase
      .from('ExternalActor')
      .select('*')
      .eq('id', validatedData.externalActorId)
      .eq('studioId', studio.id)
      .single();

    const externalActor = handleDbOptional(externalActorResult);
    
    if (!externalActor) {
      return NextResponse.json(
        { error: 'External actor not found or not owned by this studio' },
        { status: 404 }
      );
    }
    
    // Ensure the project belongs to this studio
    const projectResult = await supabase
      .from('Project')
      .select('*')
      .eq('id', validatedData.projectId)
      .eq('studioId', studio.id)
      .single();

    const project = handleDbOptional(projectResult);
    
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or not owned by this studio' },
        { status: 404 }
      );
    }
    
    // Check if the external actor is already in this project
    const existingAssignmentResult = await supabase
      .from('ExternalActorProject')
      .select('*')
      .eq('externalActorId', validatedData.externalActorId)
      .eq('projectId', validatedData.projectId)
      .single();

    const existingAssignment = handleDbOptional(existingAssignmentResult);
    
    if (existingAssignment) {
      return NextResponse.json(
        { error: 'External actor is already assigned to this project' },
        { status: 409 }
      );
    }
    
    // Add the external actor to the project
    const externalActorProjectResult = await supabase
      .from('ExternalActorProject')
      .insert({
        externalActorId: validatedData.externalActorId,
        projectId: validatedData.projectId,
        role: validatedData.role,
        notes: validatedData.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    const externalActorProject = handleDbResult(externalActorProjectResult);
    
    return NextResponse.json(externalActorProject);
  } catch (error) {
    console.error('Error adding external actor to project:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.format() },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to add external actor to project' },
      { status: 500 }
    );
  }
}

// PATCH: Update external actor's project information
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    
    if (!session || !session.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get the studio ID from the user's tenant
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
    
    if (!user || !user.Tenant || user.Tenant.type !== 'STUDIO') {
      return NextResponse.json({ error: 'Not a studio user' }, { status: 403 });
    }
    
    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.tenantId)
      .single();

    const studio = handleDbOptional(studioResult);
    
    if (!studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }
    
    // Parse request body
    const body = await request.json();
    const validatedData = updateProjectSchema.parse(body);
    
    // Get the external actor project assignment
    const externalActorProjectResult = await supabase
      .from('ExternalActorProject')
      .select(`
        *,
        externalActor:ExternalActor(*),
        project:Project(*)
      `)
      .eq('id', validatedData.id)
      .single();

    const externalActorProject = handleDbOptional(externalActorProjectResult);
    
    if (!externalActorProject) {
      return NextResponse.json(
        { error: 'External actor project assignment not found' },
        { status: 404 }
      );
    }
    
    // Ensure the studio owns this assignment
    if (externalActorProject.externalActor.studioId !== studio.id ||
        externalActorProject.project.studioId !== studio.id) {
      return NextResponse.json(
        { error: 'Not authorized to update this assignment' },
        { status: 403 }
      );
    }
    
    // Update the assignment
    const updatedAssignmentResult = await supabase
      .from('ExternalActorProject')
      .update({
        role: validatedData.role,
        notes: validatedData.notes,
        updatedAt: new Date().toISOString()
      })
      .eq('id', validatedData.id)
      .select()
      .single();

    const updatedAssignment = handleDbResult(updatedAssignmentResult);
    
    return NextResponse.json(updatedAssignment);
  } catch (error) {
    console.error('Error updating external actor project assignment:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.format() },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update assignment' },
      { status: 500 }
    );
  }
}

// DELETE: Remove an external actor from a project
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    
    if (!session || !session.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get the URL parameters
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Assignment ID is required' },
        { status: 400 }
      );
    }
    
    // Get the studio ID from the user's tenant
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
    
    if (!user || !user.Tenant || user.Tenant.type !== 'STUDIO') {
      return NextResponse.json({ error: 'Not a studio user' }, { status: 403 });
    }
    
    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.tenantId)
      .single();

    const studio = handleDbOptional(studioResult);
    
    if (!studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }
    
    // Get the external actor project assignment
    const externalActorProjectResult = await supabase
      .from('ExternalActorProject')
      .select(`
        *,
        externalActor:ExternalActor(*),
        project:Project(*)
      `)
      .eq('id', id)
      .single();

    const externalActorProject = handleDbOptional(externalActorProjectResult);
    
    if (!externalActorProject) {
      return NextResponse.json(
        { error: 'External actor project assignment not found' },
        { status: 404 }
      );
    }
    
    // Ensure the studio owns this assignment
    if (externalActorProject.externalActor.studioId !== studio.id ||
        externalActorProject.project.studioId !== studio.id) {
      return NextResponse.json(
        { error: 'Not authorized to delete this assignment' },
        { status: 403 }
      );
    }
    
    // Remove the assignment
    await supabase
      .from('ExternalActorProject')
      .delete()
      .eq('id', id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing external actor from project:', error);
    return NextResponse.json(
      { error: 'Failed to remove external actor from project' },
      { status: 500 }
    );
  }
}