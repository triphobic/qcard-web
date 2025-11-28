import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * API route that checks if the current user has a studio initialized
 * Used by middleware and components to determine if studio initialization is needed
 */
export async function GET() {
  const supabase = db();
  const session = await getSession();
  
  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    // Find the user and their tenant
    const userResult = await supabase
      .from('User')
      .select('*, Tenant(*)')
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== "STUDIO") {
      return NextResponse.json({ error: "Only studio accounts can access this endpoint" }, { status: 403 });
    }
    
    // Find the studio associated with this tenant
    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.Tenant.id)
      .limit(1)
      .single();

    const studio = handleDbOptional(studioResult);
    
    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }
    
    // Return basic studio info
    return NextResponse.json({ 
      status: "ok",
      studio: {
        id: studio.id,
        name: studio.name
      }
    });
  } catch (error) {
    console.error("Error checking studio access:", error);
    return NextResponse.json({ 
      error: "Failed to check studio access",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}