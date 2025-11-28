import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { getSession } from '@/lib/supabase-auth';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/talent/messages - Get all messages organized as conversations
export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session?.profile?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get('unread') === 'true';

    const supabase = db();

    // Find the user and their profile
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

    // Build query for messages
    let messagesQuery = supabase
      .from('Message')
      .select(`
        *,
        Studio_Message_studioSenderIdToStudio:Studio!Message_studioSenderId_fkey (
          id,
          name,
          description
        ),
        Studio_Message_studioReceiverIdToStudio:Studio!Message_studioReceiverId_fkey (
          id,
          name,
          description
        )
      `)
      .eq('isArchived', false)
      .or(`talentSenderId.eq.${profileId},talentReceiverId.eq.${profileId}`)
      .order('createdAt', { ascending: false });

    if (unreadOnly) {
      messagesQuery = messagesQuery.eq('isRead', false);
    }

    const messagesResult = await messagesQuery;
    const messages = handleDbResult(messagesResult);

    // Collect all project and casting call IDs that we need to fetch
    const projectIds = messages
      .filter(m => m.relatedToProjectId)
      .map(m => m.relatedToProjectId as string)
      .filter((id, index, self) => self.indexOf(id) === index); // unique

    const castingCallIds = messages
      .filter(m => m.relatedToCastingCallId)
      .map(m => m.relatedToCastingCallId as string)
      .filter((id, index, self) => self.indexOf(id) === index); // unique

    // Fetch related projects
    let projects: any[] = [];
    if (projectIds.length > 0) {
      const projectsResult = await supabase
        .from('Project')
        .select('id, title, description')
        .in('id', projectIds);
      projects = handleDbResult(projectsResult);
    }

    // Fetch related casting calls
    let castingCalls: any[] = [];
    if (castingCallIds.length > 0) {
      const castingCallsResult = await supabase
        .from('CastingCall')
        .select('id, title, description')
        .in('id', castingCallIds);
      castingCalls = handleDbResult(castingCallsResult);
    }

    // Create maps for easy lookup
    const projectMap = new Map(projects.map(p => [p.id, p]));
    const castingCallMap = new Map(castingCalls.map(c => [c.id, c]));

    // Group messages into conversations
    const conversations = new Map(); // Map of conversation IDs to message arrays
    const messageToConversation = new Map(); // Map of message IDs to conversation IDs

    // First, group messages by conversation
    messages.forEach(message => {
      // Normalize subject (remove Re: prefixes)
      const normalizedSubject = message.subject.replace(/^(Re:\s*)+/i, '').trim();

      // Create a unique conversation key using normalized subject and studio ID
      const studioId = message.studioSenderId || message.studioReceiverId;
      const conversationKey = `${normalizedSubject}__${studioId}`;

      // Store mapping of this message to its conversation
      messageToConversation.set(message.id, conversationKey);

      // Add message to the conversation
      if (!conversations.has(conversationKey)) {
        conversations.set(conversationKey, []);
      }
      conversations.get(conversationKey).push(message);
    });

    // Now build the conversations to return
    type ConversationThread = {
      id: string;
      subject: string;
      preview: string;
      latestMessageId: string;
      latestMessageDate: string;
      messageCount: number;
      unreadCount: number;
      hasUnread: boolean;
      studio: {
        id: string;
        name: string;
        description?: string;
      } | null;
      relatedToProject: any;
      relatedToCastingCall: any;
    };

    const conversationThreads: ConversationThread[] = [];

    // Process each conversation
    Array.from(conversations.entries()).forEach(([conversationKey, conversationMessages]) => {
      // Sort messages in this conversation by date (newest first)
      conversationMessages.sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // The latest message is the first one after sorting
      const latestMessage = conversationMessages[0];

      // Get the studio involved in this conversation
      const studioInfo = latestMessage.studioSenderId
        ? latestMessage.Studio_Message_studioSenderIdToStudio
        : latestMessage.Studio_Message_studioReceiverIdToStudio;

      // Count unread messages in this conversation
      const unreadCount = conversationMessages.filter(
        (msg: any) => msg.talentReceiverId === profileId && !msg.isRead
      ).length;

      // Create the conversation object
      conversationThreads.push({
        id: conversationKey,
        subject: latestMessage.subject.replace(/^(Re:\s*)+/i, '').trim(),
        preview: latestMessage.content.substring(0, 100) + (latestMessage.content.length > 100 ? '...' : ''),
        latestMessageId: latestMessage.id,
        latestMessageDate: latestMessage.createdAt,
        messageCount: conversationMessages.length,
        unreadCount: unreadCount,
        hasUnread: unreadCount > 0,
        studio: studioInfo ? {
          id: studioInfo.id,
          name: studioInfo.name,
          description: studioInfo.description,
        } : null,
        relatedToProject: latestMessage.relatedToProjectId ? projectMap.get(latestMessage.relatedToProjectId) || null : null,
        relatedToCastingCall: latestMessage.relatedToCastingCallId ? castingCallMap.get(latestMessage.relatedToCastingCallId) || null : null,
      });
    });

    // Sort conversations by the date of their latest message
    conversationThreads.sort((a: any, b: any) =>
      new Date(b.latestMessageDate).getTime() - new Date(a.latestMessageDate).getTime()
    );

    return NextResponse.json(conversationThreads);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({
      error: "Failed to fetch messages",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// POST /api/talent/messages - Send a message (only replies are allowed)
export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.profile?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = db();

    // Find the user and their profile
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
      return NextResponse.json({ error: "Only talent accounts can send messages" }, { status: 403 });
    }

    const profileId = user.Profile.id;

    // Parse request body
    const body = await request.json();
    const { recipientId, subject, content, originalMessageId } = body;

    // Validate required fields
    if (!recipientId || !subject || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Talents can only reply to messages they received, so verify the original message
    if (!originalMessageId) {
      return NextResponse.json({
        error: "Talents can only reply to existing messages"
      }, { status: 403 });
    }

    // Check that the original message exists and was sent to this talent
    const originalMessageResult = await supabase
      .from('Message')
      .select('*')
      .eq('id', originalMessageId)
      .eq('talentReceiverId', profileId)
      .single();

    const originalMessage = handleDbOptional(originalMessageResult);

    if (!originalMessage) {
      return NextResponse.json({
        error: "Original message not found or you don't have permission to reply"
      }, { status: 404 });
    }

    // Verify that the recipient (studio) exists
    const studioRecipientResult = await supabase
      .from('Studio')
      .select('*')
      .eq('id', recipientId)
      .single();

    const studioRecipient = handleDbOptional(studioRecipientResult);

    if (!studioRecipient) {
      return NextResponse.json({
        error: "Recipient studio not found"
      }, { status: 404 });
    }

    // Get safe values for related fields
    const relatedToProjectId = originalMessage.relatedToProjectId || null;
    const relatedToCastingCallId = originalMessage.relatedToCastingCallId || null;

    // Create a reply message
    const newMessageData: any = {
      id: crypto.randomUUID(),
      subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
      content,
      talentSenderId: profileId,
      studioReceiverId: recipientId,
      isRead: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Only include related entities if they exist
    if (relatedToProjectId) {
      newMessageData.relatedToProjectId = relatedToProjectId;
    }
    if (relatedToCastingCallId) {
      newMessageData.relatedToCastingCallId = relatedToCastingCallId;
    }

    const newMessageResult = await supabase
      .from('Message')
      .insert(newMessageData)
      .select()
      .single();

    const newMessage = handleDbResult(newMessageResult);

    return NextResponse.json({
      success: true,
      message: "Message sent successfully",
      id: newMessage.id,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({
      error: "Failed to send message",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
