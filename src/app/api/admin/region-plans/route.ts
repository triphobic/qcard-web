import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Helper function to check if user is an admin
async function requireAdmin() {
  const session = await getSession();
  
  if (!session || !session.profile) {
    return { authorized: false, status: 401, message: "Unauthorized" };
  }
  
  if (session.profile.role !== 'ADMIN' && session.profile.role !== 'SUPER_ADMIN') {
    return { authorized: false, status: 403, message: "Forbidden - Admin access required" };
  }
  
  return { authorized: true, session };
}

// GET /api/admin/region-plans - Get all region plans
export async function GET(request: Request) {
  try {
    const supabase = db();

    // Check admin authorization
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const regionId = searchParams.get('regionId');

    // Fetch all region plans
    console.log('Fetching region plans with Supabase');

    let query = supabase
      .from('RegionSubscriptionPlan')
      .select('*, region:Region(*)');

    if (regionId) {
      query = query.eq('regionId', regionId);
    }

    const { data: regionPlans, error } = await query.order('region(name)', { ascending: true });

    if (error) throw error;

    return NextResponse.json(regionPlans || []);
  } catch (error) {
    console.error("Error fetching region plans:", error);
    return NextResponse.json({ error: "Failed to fetch region plans" }, { status: 500 });
  }
}

// POST /api/admin/region-plans - Create a new region plan
export async function POST(request: Request) {
  try {
    // Check admin authorization
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    
    const data = await request.json();
    
    // Validate required fields
    if (!data.regionId || !data.name || data.price === undefined) {
      return NextResponse.json({ 
        error: "Missing required fields: regionId, name, price" 
      }, { status: 400 });
    }
    
    // Check if the region exists
    const { data: region } = await supabase
      .from('Region')
      .select('id')
      .eq('id', data.regionId)
      .single();

    if (!region) {
      return NextResponse.json({ error: "Region not found" }, { status: 404 });
    }

    // Create the new region plan
    const { data: newPlan, error } = await supabase
      .from('RegionSubscriptionPlan')
      .insert({
        id: crypto.randomUUID(),
        regionId: data.regionId,
        name: data.name,
        description: data.description || null,
        price: parseFloat(data.price),
        isActive: data.isActive !== undefined ? data.isActive : true,
        stripePriceId: data.stripePriceId || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select('*, region:Region(*)')
      .single();

    if (error) throw error;

    return NextResponse.json(newPlan);
  } catch (error) {
    console.error("Error creating region plan:", error);
    return NextResponse.json({ error: "Failed to create region plan" }, { status: 500 });
  }
}