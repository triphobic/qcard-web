import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { getSession } from '@/lib/supabase-auth';
import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/talent/messages/[id] - Get a specific message
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session?.profile?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = db();

    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*),
        Profile (*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== "TALENT" || !user.Profile) {
      return NextResponse.json({ error: "Only talent accounts can access their messages" }, { status: 403 });
    }

    const profileId = user.Profile.id;
    const messageId = params.id;

    // Get the message with all related data
    const messageResult = await supabase
      .from('Message')
      .select(`
        *,
        Studio_Message_studioSenderIdToStudio:Studio!Message_studioSenderId_fkey (
          id,
          name,
          description,
          contactEmail
        ),
        Studio_Message_studioReceiverIdToStudio:Studio!Message_studioReceiverId_fkey (
          id,
          name,
          description,
          contactEmail
        )
      `)
      .eq('id', messageId)
      .or(`talentSenderId.eq.${profileId},talentReceiverId.eq.${profileId}`)
      .single();

    const message = handleDbOptional(messageResult);

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // If this is a received message and it's not yet read, mark it as read
    if (message.talentReceiverId === profileId && !message.isRead) {
      await supabase
        .from('Message')
        .update({ isRead: true })
        .eq('id', messageId);
    }

    // Fetch related project if applicable
    let relatedProject = null;
    if (message.relatedToProjectId) {
      const projectResult = await supabase
        .from('Project')
        .select('id, title, description')
        .eq('id', message.relatedToProjectId)
        .single();
      relatedProject = handleDbOptional(projectResult);
    }

    // Fetch related casting call if applicable
    let relatedCastingCall = null;
    if (message.relatedToCastingCallId) {
      const castingCallResult = await supabase
        .from('CastingCall')
        .select('id, title, description')
        .eq('id', message.relatedToCastingCallId)
        .single();
      relatedCastingCall = handleDbOptional(castingCallResult);
    }

    // Find all related messages in the same thread
    const baseSubject = message.subject.replace(/^(Re:\s*)+/i, '').trim();
    const studioId = message.studioSenderId || message.studioReceiverId;

    // Query for thread messages with subject matching
    // Note: Supabase PostgREST doesn't support nested OR, so we'll fetch and filter
    const threadMessagesResult = await supabase
      .from('Message')
      .select(`
        *,
        Studio_Message_studioSenderIdToStudio:Studio!Message_studioSenderId_fkey (
          id,
          name,
          description,
          contactEmail
        ),
        Studio_Message_studioReceiverIdToStudio:Studio!Message_studioReceiverId_fkey (
          id,
          name,
          description,
          contactEmail
        )
      `)
      .or(`and(talentSenderId.eq.${profileId},studioReceiverId.eq.${studioId}),and(talentReceiverId.eq.${profileId},studioSenderId.eq.${studioId})`)
      .neq('id', messageId)
      .order('createdAt', { ascending: true });

    let threadMessages = handleDbResult(threadMessagesResult);

    // Filter by subject match (case-insensitive)
    threadMessages = threadMessages.filter(msg => {
      const msgSubject = msg.subject.replace(/^(Re:\s*)+/i, '').trim().toLowerCase();
      return msgSubject === baseSubject.toLowerCase();
    });

    // Add the current message at the appropriate position based on timestamp
    const allThreadMessages = [...threadMessages];
    const currentMessage = {
      ...message,
      isCurrentMessage: true
    };

    // Find the correct position for the current message
    let inserted = false;
    for (let i = 0; i < allThreadMessages.length; i++) {
      if (new Date(message.createdAt) < new Date(allThreadMessages[i].createdAt)) {
        allThreadMessages.splice(i, 0, currentMessage);
        inserted = true;
        break;
      }
    }

    // If the current message is newer than all others, add it at the end
    if (!inserted) {
      allThreadMessages.push(currentMessage);
    }

    // Format thread messages
    const formattedThreadMessages = allThreadMessages.map(threadMsg => ({
      id: threadMsg.id,
      subject: threadMsg.subject,
      content: threadMsg.content,
      isRead: threadMsg.isRead,
      isArchived: threadMsg.isArchived,
      createdAt: threadMsg.createdAt,
      isSent: threadMsg.talentSenderId === profileId,
      isCurrentMessage: threadMsg.isCurrentMessage || threadMsg.id === messageId,
      sender: threadMsg.talentSenderId === profileId
        ? null
        : {
            id: threadMsg.Studio_Message_studioSenderIdToStudio?.id,
            name: threadMsg.Studio_Message_studioSenderIdToStudio?.name,
            description: threadMsg.Studio_Message_studioSenderIdToStudio?.description,
            email: threadMsg.Studio_Message_studioSenderIdToStudio?.contactEmail,
          },
      recipient: threadMsg.talentReceiverId === profileId
        ? null
        : {
            id: threadMsg.Studio_Message_studioReceiverIdToStudio?.id,
            name: threadMsg.Studio_Message_studioReceiverIdToStudio?.name,
            description: threadMsg.Studio_Message_studioReceiverIdToStudio?.description,
            email: threadMsg.Studio_Message_studioReceiverIdToStudio?.contactEmail,
          },
    }));

    // Map message to a friendly response format
    const formattedMessage = {
      id: message.id,
      subject: message.subject,
      content: message.content,
      isRead: message.isRead,
      isArchived: message.isArchived,
      createdAt: message.createdAt,
      isSent: message.talentSenderId === profileId,
      sender: message.talentSenderId === profileId
        ? null
        : {
            id: message.Studio_Message_studioSenderIdToStudio?.id,
            name: message.Studio_Message_studioSenderIdToStudio?.name,
            description: message.Studio_Message_studioSenderIdToStudio?.description,
            email: message.Studio_Message_studioSenderIdToStudio?.contactEmail,
          },
      recipient: message.talentReceiverId === profileId
        ? null
        : {
            id: message.Studio_Message_studioReceiverIdToStudio?.id,
            name: message.Studio_Message_studioReceiverIdToStudio?.name,
            description: message.Studio_Message_studioReceiverIdToStudio?.description,
            email: message.Studio_Message_studioReceiverIdToStudio?.contactEmail,
          },
      relatedToProject: relatedProject,
      relatedToCastingCall: relatedCastingCall,
      thread: formattedThreadMessages,
      baseSubject: baseSubject,
    };

    return NextResponse.json(formattedMessage);
  } catch (error) {
    console.error("Error fetching message:", error);
    return NextResponse.json({
      error: "Failed to fetch message",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// PATCH /api/talent/messages/[id] - Update a message (mark as read/unread or archived)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session?.profile?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = db();

    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*),
        Profile (*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== "TALENT" || !user.Profile) {
      return NextResponse.json({ error: "Only talent accounts can update their messages" }, { status: 403 });
    }

    const profileId = user.Profile.id;
    const messageId = params.id;

    // Verify the message belongs to this talent
    const messageResult = await supabase
      .from('Message')
      .select('*')
      .eq('id', messageId)
      .or(`talentSenderId.eq.${profileId},talentReceiverId.eq.${profileId}`)
      .single();

    const message = handleDbOptional(messageResult);

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { isRead, isArchived } = body;

    // Build update data
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };
    if (isRead !== undefined) updateData.isRead = isRead;
    if (isArchived !== undefined) updateData.isArchived = isArchived;

    // Update the message
    const updatedMessageResult = await supabase
      .from('Message')
      .update(updateData)
      .eq('id', messageId)
      .select()
      .single();

    const updatedMessage = handleDbResult(updatedMessageResult);

    return NextResponse.json({
      success: true,
      message: "Message updated successfully",
      id: updatedMessage.id,
      isRead: updatedMessage.isRead,
      isArchived: updatedMessage.isArchived,
    });
  } catch (error) {
    console.error("Error updating message:", error);
    return NextResponse.json({
      error: "Failed to update message",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// DELETE /api/talent/messages/[id] - Delete a message
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session?.profile?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = db();

    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*),
        Profile (*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== "TALENT" || !user.Profile) {
      return NextResponse.json({ error: "Only talent accounts can delete their messages" }, { status: 403 });
    }

    const profileId = user.Profile.id;
    const messageId = params.id;

    // Verify the message belongs to this talent
    const messageResult = await supabase
      .from('Message')
      .select('*')
      .eq('id', messageId)
      .or(`talentSenderId.eq.${profileId},talentReceiverId.eq.${profileId}`)
      .single();

    const message = handleDbOptional(messageResult);

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Delete the message
    await supabase
      .from('Message')
      .delete()
      .eq('id', messageId);

    return NextResponse.json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json({
      error: "Failed to delete message",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
