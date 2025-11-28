import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// POST /api/studio/init - Initialize a studio account for existing users
export async function POST() {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();

    // Check if the user exists and has the STUDIO tenant type
    console.log("Checking if studio user exists with ID:", session.profile.id);
    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.Tenant || user.Tenant.type !== "STUDIO") {
      return NextResponse.json({ error: "Only studio accounts can be initialized" }, { status: 403 });
    }

    // Check if a studio already exists for this tenant
    console.log("Checking if studio exists for tenant ID:", user.Tenant.id);
    const existingStudioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.Tenant.id)
      .single();

    const existingStudio = handleDbOptional(existingStudioResult);

    if (existingStudio) {
      // Studio already exists, just return it
      return NextResponse.json({
        message: "Studio already initialized",
        studio: existingStudio
      });
    }

    // Create a new studio record for this tenant
    const studioName = user.Tenant.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'New Studio';

    console.log("Creating new studio for tenant ID:", user.Tenant.id);
    const studioResult = await supabase
      .from('Studio')
      .insert({
        id: crypto.randomUUID(),
        name: studioName,
        tenantId: user.Tenant.id,
        description: `Studio for ${studioName}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    const studio = handleDbResult(studioResult);

    return NextResponse.json({
      message: "Studio initialized successfully",
      studio
    });
  } catch (error) {
    console.error("Error initializing studio:", error);
    return NextResponse.json({
      error: "Failed to initialize studio",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}