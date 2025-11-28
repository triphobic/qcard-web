import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * API routes for managing individual feature flags
 */
export async function GET(
  request: Request,
  { params }: { params: { key: string } }
) {
  try {
    const session = await getSession();
    const { key } = params;
    
    // Check if user is super admin
    if (!session?.profile?.id || session.profile.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const supabase = db();

    // Get feature flag
    const { data: featureFlag, error } = await supabase
      .from('FeatureFlag')
      .select('*')
      .eq('key', key)
      .single();

    if (error || !featureFlag) {
      return NextResponse.json(
        { error: 'Feature flag not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(featureFlag);
  } catch (error) {
    console.error(`Error fetching feature flag (${params.key}):`, error);
    return NextResponse.json(
      { error: 'Failed to fetch feature flag' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { key: string } }
) {
  try {
    const session = await getSession();
    const { key } = params;
    
    // Check if user is super admin
    if (!session?.profile?.id || session.profile.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    // Parse request body
    const data = await request.json();
    const { name, description, defaultValue } = data;
    
    const supabase = db();

    // Check if feature flag exists
    const { data: featureFlag } = await supabase
      .from('FeatureFlag')
      .select('*')
      .eq('key', key)
      .single();

    if (!featureFlag) {
      return NextResponse.json(
        { error: 'Feature flag not found' },
        { status: 404 }
      );
    }

    // Update feature flag
    const { data: updatedFlag, error } = await supabase
      .from('FeatureFlag')
      .update({
        name: name !== undefined ? name : featureFlag.name,
        description: description !== undefined ? description : featureFlag.description,
        defaultValue: defaultValue !== undefined ? defaultValue : featureFlag.defaultValue,
        updatedAt: new Date().toISOString()
      })
      .eq('key', key)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updatedFlag);
  } catch (error) {
    console.error(`Error updating feature flag (${params.key}):`, error);
    return NextResponse.json(
      { error: 'Failed to update feature flag' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { key: string } }
) {
  try {
    const session = await getSession();
    const { key } = params;
    
    // Check if user is super admin
    if (!session?.profile?.id || session.profile.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const supabase = db();

    // Check if feature flag exists
    const { data: featureFlag } = await supabase
      .from('FeatureFlag')
      .select('id')
      .eq('key', key)
      .single();

    if (!featureFlag) {
      return NextResponse.json(
        { error: 'Feature flag not found' },
        { status: 404 }
      );
    }

    // Delete feature flag
    const { error } = await supabase
      .from('FeatureFlag')
      .delete()
      .eq('key', key);

    if (error) throw error;

    return NextResponse.json(
      { message: 'Feature flag deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error(`Error deleting feature flag (${params.key}):`, error);
    return NextResponse.json(
      { error: 'Failed to delete feature flag' },
      { status: 500 }
    );
  }
}