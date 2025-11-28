import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/studio/casting-calls/[id]/invitations - Get all invitations for a casting call
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

    // Find the user and their tenant
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
      return NextResponse.json({ error: "Only studio accounts can access invitations" }, { status: 403 });
    }

    // Find the studio associated with this tenant
    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.Tenant.id)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const castingCallId = params.id;

    // Check if the casting call belongs to this studio
    const castingCallResult = await supabase
      .from('CastingCall')
      .select('*')
      .eq('id', castingCallId)
      .eq('studioId', studio.id)
      .single();

    const castingCall = handleDbOptional(castingCallResult);

    if (!castingCall) {
      return NextResponse.json({ error: "Casting call not found or unauthorized" }, { status: 403 });
    }

    // For casting calls, invitations are tracked through messages
    const invitationsResult = await supabase
      .from('Message')
      .select(`
        *,
        Profile_Message_talentReceiverIdToProfile:Profile!Message_talentReceiverId_fkey (
          id,
          User (
            firstName,
            lastName,
            email
          )
        )
      `)
      .eq('relatedToCastingCallId', castingCallId)
      .eq('studioSenderId', studio.id)
      .order('createdAt', { ascending: false });

    const invitations = handleDbResult(invitationsResult);

    // Get talent IDs from invitations
    const talentIds = invitations
      .map(inv => inv.talentReceiverId)
      .filter(Boolean) as string[];

    // Also get information about profiles that have applied to track response
    let applications: any[] = [];
    if (talentIds.length > 0) {
      const applicationsResult = await supabase
        .from('Application')
        .select('profileId, status, createdAt')
        .eq('castingCallId', castingCallId)
        .in('profileId', talentIds);

      applications = handleDbResult(applicationsResult);
    }

    // Combine invitation data with application status
    const invitationsWithStatus = invitations.map((invitation: any) => {
      const application = applications.find(
        app => app.profileId === invitation.talentReceiverId
      );

      return {
        ...invitation,
        hasResponded: !!application,
        responseStatus: application?.status || null,
        responseDate: application?.createdAt || null,
      };
    });

    return NextResponse.json(invitationsWithStatus);
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return NextResponse.json({
      error: "Failed to fetch invitations",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// POST /api/studio/casting-calls/[id]/invitations - Send invitations for a casting call
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session?.profile?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = db();

    // Find the user and their tenant
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
      return NextResponse.json({ error: "Only studio accounts can send invitations" }, { status: 403 });
    }

    // Find the studio associated with this tenant
    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.Tenant.id)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const castingCallId = params.id;

    // Check if the casting call belongs to this studio
    const castingCallResult = await supabase
      .from('CastingCall')
      .select('*')
      .eq('id', castingCallId)
      .eq('studioId', studio.id)
      .single();

    const castingCall = handleDbOptional(castingCallResult);

    if (!castingCall) {
      return NextResponse.json({ error: "Casting call not found or unauthorized" }, { status: 403 });
    }

    // Parse the request body
    const body = await request.json();
    const { talentIds, message } = body;

    if (!Array.isArray(talentIds) || talentIds.length === 0) {
      return NextResponse.json({ error: "talentIds must be a non-empty array" }, { status: 400 });
    }

    // Create a personalized invite message for each talent
    const inviteMessage = message || `You've been invited to apply for a casting call: ${castingCall.title}. Please visit your opportunities page to learn more and apply.`;

    // Create messages for each talent as casting call invitations
    const messagesToInsert = talentIds.map(talentId => ({
      id: crypto.randomUUID(),
      subject: `Invitation to apply for casting call: ${castingCall.title}`,
      content: inviteMessage,
      studioSenderId: studio.id,
      talentReceiverId: talentId,
      relatedToCastingCallId: castingCallId,
      isRead: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const resultsData = await supabase
      .from('Message')
      .insert(messagesToInsert)
      .select('id, subject, createdAt');

    const results = handleDbResult(resultsData);

    return NextResponse.json({
      success: true,
      invitationsSent: results.length,
      message: `Successfully sent ${results.length} invitations for casting call: ${castingCall.title}`
    }, { status: 201 });
  } catch (error) {
    console.error("Error sending invitations:", error);
    return NextResponse.json({
      error: "Failed to send invitations",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
