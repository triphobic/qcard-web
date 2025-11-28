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

// GET /api/admin/discounts - Get all discount tiers
export async function GET(request: Request) {
  try {
    const supabase = db();

    // Check admin authorization
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    
    // Fetch all discount tiers
    const { data: discounts, error } = await supabase
      .from('MultiRegionDiscount')
      .select('*')
      .order('regionCount', { ascending: true });

    if (error) throw error;

    return NextResponse.json(discounts || []);
  } catch (error) {
    console.error("Error fetching discounts:", error);
    return NextResponse.json({ error: "Failed to fetch discount tiers" }, { status: 500 });
  }
}

// POST /api/admin/discounts - Create a new discount tier
export async function POST(request: Request) {
  try {
    // Check admin authorization
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    
    const data = await request.json();
    
    // Validate required fields
    if (!data.regionCount || data.discountPercentage === undefined) {
      return NextResponse.json({ 
        error: "Missing required fields: regionCount, discountPercentage" 
      }, { status: 400 });
    }
    
    // Validate discount percentage is between 0 and 100
    if (data.discountPercentage < 0 || data.discountPercentage > 100) {
      return NextResponse.json({ 
        error: "Discount percentage must be between 0 and 100" 
      }, { status: 400 });
    }
    
    const supabase = db();

    // Check if a discount tier for this region count already exists
    const { data: existingDiscount } = await supabase
      .from('MultiRegionDiscount')
      .select('id')
      .eq('regionCount', parseInt(data.regionCount))
      .single();

    if (existingDiscount) {
      return NextResponse.json({
        error: `A discount tier for ${data.regionCount} regions already exists`
      }, { status: 400 });
    }

    // Create the new discount tier
    const { data: newDiscount, error } = await supabase
      .from('MultiRegionDiscount')
      .insert({
        id: crypto.randomUUID(),
        regionCount: parseInt(data.regionCount),
        discountPercentage: parseFloat(data.discountPercentage),
        active: data.active !== undefined ? data.active : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(newDiscount);
  } catch (error) {
    console.error("Error creating discount tier:", error);
    return NextResponse.json({ error: "Failed to create discount tier" }, { status: 500 });
  }
}