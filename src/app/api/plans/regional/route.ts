import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = db();

    const session = await getSession();
    
    if (!session?.profile?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Get the URL parameters
    const { searchParams } = new URL(request.url);
    const regionId = searchParams.get('regionId');
    
    // Build the query
    const where = regionId 
      ? { isActive: true, regionId }
      : { isActive: true };
    
    // Fetch all regional subscription plans with region data
    let query = supabase
      .from('RegionSubscriptionPlan')
      .select(`
        id,
        name,
        description,
        price,
        regionId,
        isActive,
        region:Region(*)
      `)
      .eq('isActive', true)
      .order('price', { ascending: true });

    // Add region filter if specified
    if (regionId) {
      query = query.eq('regionId', regionId);
    }

    const { data: plans, error } = await query;

    if (error) {
      console.error('Error fetching regional subscription plans:', error);
      throw error;
    }
    
    // Format the plans for the frontend
    const formattedPlans = (plans || []).map(plan => {
      const region = Array.isArray(plan.region) ? plan.region[0] : plan.region;
      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        region: region,
        features: [
          `Access to ${region?.name || 'region'} casting calls`,
          `Opportunity to work in ${region?.name || 'region'}`,
          'Apply to unlimited casting calls',
          'Access to basic features'
        ]
      };
    });
    
    return NextResponse.json(formattedPlans);
  } catch (error) {
    console.error("Error fetching regional subscription plans:", error);
    return NextResponse.json({ error: "Failed to fetch subscription plans" }, { status: 500 });
  }
}

/**
 * Get discount information based on number of regions
 */
export async function POST(request: Request) {
  try {
    const supabase = db();
    const session = await getSession();

    if (!session?.profile?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { regionCount } = body;

    if (!regionCount || typeof regionCount !== 'number') {
      return NextResponse.json({ error: "Invalid region count" }, { status: 400 });
    }

    // Find the applicable discount
    const { data: discount, error } = await supabase
      .from('MultiRegionDiscount')
      .select('*')
      .eq('active', true)
      .lte('regionCount', regionCount)
      .order('regionCount', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Error fetching discount:', error);
    }
    
    // If no discount is found (e.g., for 1 region), return 0%
    if (!discount) {
      return NextResponse.json({
        regionCount,
        discountPercentage: 0,
        discountAmount: 0
      });
    }
    
    return NextResponse.json({
      regionCount,
      discountPercentage: discount.discountPercentage,
      discountAmount: discount.discountPercentage / 100
    });
  } catch (error) {
    console.error("Error calculating discount:", error);
    return NextResponse.json({ error: "Failed to calculate discount" }, { status: 500 });
  }
}