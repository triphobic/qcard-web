import { db, handleDbOptional, handleDbResult, generateId, now } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for studio notes
const noteSchema = z.object({
  content: z.string().min(1, { message: "Note content is required" }),
});

// Helper function to check if a studio has access to modify a note
async function canAccessNote(userId: string, noteId: string) {
  const supabase = db();

  const userResult = await supabase
    .from('User')
    .select('*, Tenant(*)')
    .eq('id', userId)
    .single();

  const user = handleDbOptional(userResult);

  if (!user?.Tenant || user.Tenant.type !== "STUDIO") {
    return false;
  }

  const studioResult = await supabase
    .from('Studio')
    .select('*')
    .eq('tenantId', user.Tenant.id)
    .single();

  const studio = handleDbOptional(studioResult);

  if (!studio) {
    return false;
  }

  const noteResult = await supabase
    .from('StudioNote')
    .select('*')
    .eq('id', noteId)
    .eq('studioId', studio.id)
    .single();

  const note = handleDbOptional(noteResult);

  return !!note;
}

// GET /api/studio/notes/[id] - Get all notes for a talent profile
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();

    const userResult = await supabase
      .from('User')
      .select('*, Tenant(*)')
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== "STUDIO") {
      return NextResponse.json({ error: "Only studio users can access notes" }, { status: 403 });
    }

    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.Tenant.id)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: "Studio profile not found" }, { status: 404 });
    }

    const { id: profileId } = params;

    const notesResult = await supabase
      .from('StudioNote')
      .select('*')
      .eq('profileId', profileId)
      .eq('studioId', studio.id)
      .order('createdAt', { ascending: false });

    const notes = handleDbResult(notesResult);

    return NextResponse.json(notes);
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}

// POST /api/studio/notes/[id] - Create a new note for a talent profile
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();

    const userResult = await supabase
      .from('User')
      .select('*, Tenant(*)')
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== "STUDIO") {
      return NextResponse.json({ error: "Only studio users can create notes" }, { status: 403 });
    }

    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.Tenant.id)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: "Studio profile not found" }, { status: 404 });
    }

    const { id: profileId } = params;
    const body = await request.json();

    // Validate input data
    const result = noteSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const { content } = result.data;

    // Check if profile exists
    const profileResult = await supabase
      .from('Profile')
      .select('*')
      .eq('id', profileId)
      .single();

    const profile = handleDbOptional(profileResult);

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Create the note
    const noteResult = await supabase
      .from('StudioNote')
      .insert({
        id: generateId(),
        content,
        studioId: studio.id,
        profileId,
        updatedAt: now(),
      })
      .select()
      .single();

    const note = handleDbResult(noteResult);

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}

// For managing a specific note (delete)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const { id } = params;

    // Check if the studio has access to this note
    if (!(await canAccessNote(session.profile.id, id))) {
      return NextResponse.json({ error: "Unauthorized to access this note" }, { status: 403 });
    }

    // Delete the note
    const deleteResult = await supabase
      .from('StudioNote')
      .delete()
      .eq('id', id);

    if (deleteResult.error) {
      throw deleteResult.error;
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
