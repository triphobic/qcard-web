import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { getSession } from '@/lib/supabase-auth';
import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/messages/unread-count - Get count of unread messages for either talent or studio
export async function GET(request: Request) {
  try {
    const supabase = db();

    const session = await getSession();
    
    if (!session?.profile?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Find the user and determine their type
    const { data: user, error: userError } = await supabase
      .from('User')
      .select(`
        id,
        Tenant!inner(id, type),
        Profile(id)
      `)
      .eq('id', session.profile.id)
      .single();

    if (userError || !user?.Tenant) {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ error: "User tenant not found" }, { status: 404 });
    }

    const tenant = Array.isArray(user.Tenant) ? user.Tenant[0] : user.Tenant;
    const profile = Array.isArray(user.Profile) ? user.Profile[0] : user.Profile;

    let unreadCount = 0;

    if (tenant.type === "TALENT" && profile) {
      // Count unread messages for talent
      const { count, error } = await supabase
        .from('Message')
        .select('*', { count: 'exact', head: true })
        .eq('talentReceiverId', profile.id)
        .eq('isRead', false)
        .eq('isArchived', false);

      if (!error) {
        unreadCount = count || 0;
      }
    } else if (tenant.type === "STUDIO") {
      // Find the studio
      const { data: studio } = await supabase
        .from('Studio')
        .select('id')
        .eq('tenantId', tenant.id)
        .limit(1)
        .single();

      if (studio) {
        // Count unread messages for studio
        const { count, error } = await supabase
          .from('Message')
          .select('*', { count: 'exact', head: true })
          .eq('studioReceiverId', studio.id)
          .eq('isRead', false)
          .eq('isArchived', false);

        if (!error) {
          unreadCount = count || 0;
        }
      }
    }
    
    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error("Error counting unread messages:", error);
    return NextResponse.json({ 
      error: "Failed to count unread messages",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}