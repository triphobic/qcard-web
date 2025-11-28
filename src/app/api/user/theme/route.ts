import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase';
import { db, handleDbResult, now } from '@/lib/supabase-db';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/user/theme - Get user's theme preference
export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabaseClient();

    // Try to get authenticated user (but don't require it)
    const { data: { user } } = await supabase.auth.getUser();

    // If user is logged in, get their saved preference
    if (user) {
      try {
        const dbClient = db();
        const result = await dbClient
          .from('User')
          .select('theme')
          .eq('id', user.id)
          .single();

        if (result.data) {
          return NextResponse.json({
            theme: result.data.theme || 'system'
          });
        }
      } catch (error) {
        // User might not have a database record yet
        console.log('User has no theme preference saved');
      }
    }

    // Return default theme for unauthenticated users or users without preference
    return NextResponse.json({
      theme: 'system'
    });
  } catch (error) {
    console.error('Error fetching user theme:', error);
    // Still return a default theme so the site is usable
    return NextResponse.json({
      theme: 'system'
    });
  }
}

// PATCH /api/user/theme - Update user's theme preference
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getServerSupabaseClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { theme } = body;

    // Validate theme value
    if (!theme || !['light', 'dark', 'system'].includes(theme)) {
      return NextResponse.json(
        { error: 'Invalid theme value. Must be "light", "dark", or "system"' },
        { status: 400 }
      );
    }

    // Update user's theme preference
    const dbClient = db();
    const result = await dbClient
      .from('User')
      .update({
        theme,
        updatedAt: now(),
      })
      .eq('id', user.id)
      .select('theme')
      .single();

    const updatedUser = handleDbResult(result);

    return NextResponse.json({
      theme: updatedUser.theme,
      message: 'Theme preference updated successfully'
    });
  } catch (error) {
    console.error('Error updating user theme:', error);
    return NextResponse.json(
      { error: 'Failed to update theme preference' },
      { status: 500 }
    );
  }
}
