import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for sending a message
const messageSchema = z.object({
  recipientId: z.string().min(1, { message: "Recipient ID is required" }),
  subject: z.string().min(1, { message: "Subject is required" }),
  content: z.string().min(1, { message: "Message content is required" }),
  originalMessageId: z.string().optional(), // Original message ID for replies
  relatedToProjectId: z.string().optional().nullable(),
  relatedToCastingCallId: z.string().optional().nullable(),
});

// Validation schema for inviting talent to a project
const inviteSchema = z.object({
  talentReceiverId: z.string().min(1, { message: "Talent ID is required" }),
  subject: z.string().min(1, { message: "Subject is required" }),
  content: z.string().min(1, { message: "Message content is required" }),
  relatedToProjectId: z.string().optional().nullable(),
  relatedToCastingCallId: z.string().optional().nullable(),
});

// GET /api/studio/messages - Get all messages for the authenticated studio
export async function GET(request: Request) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();

    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== "STUDIO") {
      return NextResponse.json({ error: "Only studio users can access this endpoint" }, { status: 403 });
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

    // Parse URL search params for filtering
    const { searchParams } = new URL(request.url);
    const sent = searchParams.get('sent') === 'true';

    let messagesResult;

    if (sent) {
      // Get sent messages
      messagesResult = await supabase
        .from('Message')
        .select(`
          *,
          Profile_Message_talentReceiverIdToProfile:Profile!Message_talentReceiverId_fkey (
            *,
            User (*)
          ),
          Studio_Message_studioSenderIdToStudio:Studio!Message_studioSenderId_fkey (*)
        `)
        .eq('studioSenderId', studio.id)
        .order('createdAt', { ascending: false });
    } else {
      // Get received messages
      messagesResult = await supabase
        .from('Message')
        .select(`
          *,
          Profile_Message_talentSenderIdToProfile:Profile!Message_talentSenderId_fkey (
            *,
            User (
              firstName,
              lastName,
              email
            )
          ),
          Studio_Message_studioReceiverIdToStudio:Studio!Message_studioReceiverId_fkey (*)
        `)
        .eq('studioReceiverId', studio.id)
        .order('createdAt', { ascending: false });
    }

    const messages = handleDbResult(messagesResult);

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({
      error: "Failed to fetch messages",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// POST /api/studio/messages - Send a new message
export async function POST(request: Request) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const supabase = db();

    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== "STUDIO") {
      return NextResponse.json({ error: "Only studio users can access this endpoint" }, { status: 403 });
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

    // Check if this is a standard message or a project invitation
    if (body.talentReceiverId) {
      // Handle project invitation
      const inviteResult = inviteSchema.safeParse(body);
      if (!inviteResult.success) {
        return NextResponse.json(
          { error: "Invalid input data", details: inviteResult.error.format() },
          { status: 400 }
        );
      }

      const { talentReceiverId, subject, content, relatedToProjectId, relatedToCastingCallId } = inviteResult.data;

      // Verify recipient profile exists
      const talentProfileResult = await supabase
        .from('Profile')
        .select('*')
        .eq('id', talentReceiverId)
        .single();

      const talentProfile = handleDbOptional(talentProfileResult);

      if (!talentProfile) {
        return NextResponse.json({ error: "Talent profile not found" }, { status: 404 });
      }

      // If project ID is provided, verify it exists and belongs to this studio
      if (relatedToProjectId) {
        const projectResult = await supabase
          .from('Project')
          .select('*')
          .eq('id', relatedToProjectId)
          .eq('studioId', studio.id)
          .single();

        const project = handleDbOptional(projectResult);

        if (!project) {
          return NextResponse.json({ error: "Project not found or does not belong to this studio" }, { status: 404 });
        }
      }

      // Create invitation message
      const messageData: any = {
        id: crypto.randomUUID(),
        subject,
        content,
        studioSenderId: studio.id,
        talentReceiverId: talentReceiverId,
        isRead: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (relatedToProjectId) {
        messageData.relatedToProjectId = relatedToProjectId;
      }
      if (relatedToCastingCallId) {
        messageData.relatedToCastingCallId = relatedToCastingCallId;
      }

      const messageResult = await supabase
        .from('Message')
        .insert(messageData)
        .select(`
          *,
          Profile_Message_talentReceiverIdToProfile:Profile!Message_talentReceiverId_fkey (
            *,
            User (
              firstName,
              lastName,
              email
            )
          ),
          Studio_Message_studioSenderIdToStudio:Studio!Message_studioSenderId_fkey (*)
        `)
        .single();

      const message = handleDbResult(messageResult);

      return NextResponse.json(message, { status: 201 });
    } else {
      // Handle regular message
      const result = messageSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json(
          { error: "Invalid input data", details: result.error.format() },
          { status: 400 }
        );
      }

      const { recipientId, subject, content, originalMessageId, relatedToProjectId, relatedToCastingCallId } = result.data;

      // Verify recipient exists
      const recipientResult = await supabase
        .from('Profile')
        .select('*')
        .eq('id', recipientId)
        .single();

      const recipient = handleDbOptional(recipientResult);

      if (!recipient) {
        return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
      }

      // Check if this is a reply to a message
      if (originalMessageId) {
        // Verify the original message exists
        const originalMessageResult = await supabase
          .from('Message')
          .select('*')
          .eq('id', originalMessageId)
          .single();

        const originalMessage = handleDbOptional(originalMessageResult);

        if (!originalMessage) {
          return NextResponse.json({ error: "Original message not found" }, { status: 404 });
        }
      }

      // Create the message
      const messageData: any = {
        id: crypto.randomUUID(),
        subject,
        content,
        studioSenderId: studio.id,
        talentReceiverId: recipientId,
        isRead: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (relatedToProjectId) {
        messageData.relatedToProjectId = relatedToProjectId;
      }
      if (relatedToCastingCallId) {
        messageData.relatedToCastingCallId = relatedToCastingCallId;
      }

      const messageResult = await supabase
        .from('Message')
        .insert(messageData)
        .select(`
          *,
          Profile_Message_talentReceiverIdToProfile:Profile!Message_talentReceiverId_fkey (
            *,
            User (
              firstName,
              lastName,
              email
            )
          ),
          Studio_Message_studioSenderIdToStudio:Studio!Message_studioSenderId_fkey (*)
        `)
        .single();

      const message = handleDbResult(messageResult);

      return NextResponse.json(message, { status: 201 });
    }
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({
      error: "Failed to send message",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}