import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for updating a studio profile
const studioProfileSchema = z.object({
  name: z.string().min(1, "Studio name is required"),
  description: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  locationIds: z.array(z.string()).optional(),
});

// GET /api/studio/profile - Get the authenticated studio's profile
export async function GET() {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

    if (!user) {
      return NextResponse.json({
        error: "User not found, session may be corrupted",
        sessionUserId: session.profile.id
      }, { status: 404 });
    }

    if (!user.Tenant) {
      return NextResponse.json({
        error: "User has no tenant associated, session may need refresh",
        userId: user.id
      }, { status: 404 });
    }

    if (user.Tenant.type !== "STUDIO") {
      return NextResponse.json({
        error: "Only studio accounts can access this endpoint",
        tenantType: user.Tenant.type
      }, { status: 403 });
    }

    // Find the studio associated with this tenant
    const studioResult = await supabase
      .from('Studio')
      .select(`
        *,
        Location (*)
      `)
      .eq('tenantId', user.Tenant.id)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({
        error: "Studio profile not found, needs initialization",
        userId: user.id
      }, { status: 404 });
    }

    // Return the studio profile, mapping Location to lowercase for frontend compatibility
    return NextResponse.json({
      ...studio,
      locations: studio.Location,
    });
  } catch (error) {
    console.error("Error fetching studio profile:", error);
    return NextResponse.json({ error: "Failed to fetch studio profile" }, { status: 500 });
  }
}

// PATCH /api/studio/profile - Update the authenticated studio's profile
export async function PATCH(request: Request) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const body = await request.json();

    // Validate input data
    const result = studioProfileSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const validatedData = result.data;

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
      return NextResponse.json({ error: "Only studio accounts can update studio profiles" }, { status: 403 });
    }

    // Find the studio associated with this tenant
    const studioResult = await supabase
      .from('Studio')
      .select('id')
      .eq('tenantId', user.Tenant.id)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: "Studio profile not found" }, { status: 404 });
    }

    // Extract relation IDs
    const { locationIds, ...studioData } = validatedData;

    // Build update data
    const updateData: any = {
      ...studioData,
      updatedAt: new Date().toISOString(),
    };

    // Update basic studio data
    await supabase
      .from('Studio')
      .update(updateData)
      .eq('id', studio.id);

    // Update location relations if provided
    // Note: This requires the junction table (_LocationToStudio)
    if (locationIds !== undefined) {
      // Delete existing relations
      await supabase
        .from('_LocationToStudio')
        .delete()
        .eq('B', studio.id);

      // Insert new relations
      if (locationIds.length > 0) {
        const locationRelations = locationIds.map(locationId => ({
          A: locationId,
          B: studio.id,
        }));
        await supabase
          .from('_LocationToStudio')
          .insert(locationRelations);
      }
    }

    // Get the updated studio with all relations
    const updatedStudioResult = await supabase
      .from('Studio')
      .select(`
        *,
        Location (*)
      `)
      .eq('id', studio.id)
      .single();

    const updatedStudio = handleDbResult(updatedStudioResult);

    // Return the updated studio profile
    return NextResponse.json({
      ...updatedStudio,
      locations: updatedStudio.Location,
    });
  } catch (error) {
    console.error("Error updating studio profile:", error);
    return NextResponse.json({
      error: "Failed to update studio profile",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}