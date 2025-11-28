import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for updating a message
const messageUpdateSchema = z.object({
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

// Helper function to check if a studio has access to a message
async function canAccessMessage(userId: string, messageId: string) {
  const supabase = db();

  const userResult = await supabase
    .from('User')
    .select(`
      *,
      Tenant (*)
    `)
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

  const messageResult = await supabase
    .from('Message')
    .select('*')
    .eq('id', messageId)
    .or(`studioSenderId.eq.${studio.id},studioReceiverId.eq.${studio.id}`)
    .single();

  const message = handleDbOptional(messageResult);

  return !!message;
}

// GET /api/studio/messages/[id] - Get a specific message
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = params;

    if (!await canAccessMessage(session.profile.id, id)) {
      return NextResponse.json({ error: "Unauthorized to access this message" }, { status: 403 });
    }

    const supabase = db();

    const messageResult = await supabase
      .from('Message')
      .select(`
        *,
        Studio_Message_studioSenderIdToStudio:Studio!Message_studioSenderId_fkey (
          *,
          Tenant (*)
        ),
        Studio_Message_studioReceiverIdToStudio:Studio!Message_studioReceiverId_fkey (
          *,
          Tenant (*)
        ),
        Profile_Message_talentSenderIdToProfile:Profile!Message_talentSenderId_fkey (
          *,
          User (*)
        ),
        Profile_Message_talentReceiverIdToProfile:Profile!Message_talentReceiverId_fkey (
          *,
          User (*)
        )
      `)
      .eq('id', id)
      .single();

    const message = handleDbOptional(messageResult);

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // If this is an incoming message to studio and it's not read, mark as read
    if (message.studioReceiverId && !message.isRead) {
      await supabase
        .from('Message')
        .update({ isRead: true, updatedAt: new Date().toISOString() })
        .eq('id', id);
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error("Error fetching message:", error);
    return NextResponse.json({
      error: "Failed to fetch message",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// PATCH /api/studio/messages/[id] - Update a message (mark as read, archive, etc.)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = params;
    const body = await request.json();

    if (!await canAccessMessage(session.profile.id, id)) {
      return NextResponse.json({ error: "Unauthorized to access this message" }, { status: 403 });
    }

    // Validate input data
    const result = messageUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const validatedData = result.data;

    const supabase = db();

    // Update the message
    const updateData = {
      ...validatedData,
      updatedAt: new Date().toISOString(),
    };

    const updatedMessageResult = await supabase
      .from('Message')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    const updatedMessage = handleDbResult(updatedMessageResult);

    return NextResponse.json(updatedMessage);
  } catch (error) {
    console.error("Error updating message:", error);
    return NextResponse.json({
      error: "Failed to update message",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// DELETE /api/studio/messages/[id] - Delete a message
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = params;

    if (!await canAccessMessage(session.profile.id, id)) {
      return NextResponse.json({ error: "Unauthorized to access this message" }, { status: 403 });
    }

    const supabase = db();

    // Delete the message
    await supabase
      .from('Message')
      .delete()
      .eq('id', id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json({
      error: "Failed to delete message",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}