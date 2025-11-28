import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET: Search for external actors
export async function GET(request: Request) {
  try {
    const supabase = db();

    const session = await getSession();

    if (!session || !session.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the studio ID from the user's tenant
    const userResult = await supabase
      .from('User')
      .select(`
        id,
        tenantId,
        Tenant:Tenant(
          id,
          type
        )
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user || !user.Tenant || user.Tenant.type !== 'STUDIO') {
      return NextResponse.json({ error: 'Not a studio user' }, { status: 403 });
    }

    const studioResult = await supabase
      .from('Studio')
      .select('id')
      .eq('tenantId', user.tenantId)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    // Get search parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Perform the search - in Supabase we can use ilike for case-insensitive search
    const searchPattern = `%${query}%`;
    const externalActorsResult = await supabase
      .from('ExternalActor')
      .select('*')
      .eq('studioId', studio.id)
      .eq('status', 'ACTIVE')
      .or(`email.ilike.${searchPattern},firstName.ilike.${searchPattern},lastName.ilike.${searchPattern},phoneNumber.ilike.${searchPattern}`)
      .limit(20)
      .order('createdAt', { ascending: false });

    const externalActors = handleDbResult(externalActorsResult);

    // Format the results to match the talent search format
    const results = externalActors.map((actor: any) => ({
      id: actor.id,
      name: `${actor.firstName || ''} ${actor.lastName || ''}`.trim() || actor.email,
      email: actor.email,
      phone: actor.phoneNumber || null,
      type: 'external', // Distinguish from registered talent
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error searching external actors:', error);
    return NextResponse.json(
      { error: 'Failed to search external actors' },
      { status: 500 }
    );
  }
}
