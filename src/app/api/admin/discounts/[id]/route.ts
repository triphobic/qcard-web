import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';

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

// GET /api/admin/discounts/[id] - Get a specific discount tier
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authorization
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    
    const id = params.id;
    
    const supabase = db();

    // Fetch the discount tier with the given ID
    const { data: discount, error } = await supabase
      .from('MultiRegionDiscount')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !discount) {
      return NextResponse.json({ error: "Discount tier not found" }, { status: 404 });
    }

    return NextResponse.json(discount);
  } catch (error) {
    console.error("Error fetching discount tier:", error);
    return NextResponse.json({ error: "Failed to fetch discount tier" }, { status: 500 });
  }
}

// PUT /api/admin/discounts/[id] - Update a discount tier
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authorization
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    
    const id = params.id;
    const data = await request.json();
    
    const supabase = db();

    // Check if the discount tier exists
    const { data: existingDiscount } = await supabase
      .from('MultiRegionDiscount')
      .select('id')
      .eq('id', id)
      .single();

    if (!existingDiscount) {
      return NextResponse.json({ error: "Discount tier not found" }, { status: 404 });
    }

    // Validate discount percentage is between 0 and 100 if provided
    if (data.discountPercentage !== undefined) {
      if (data.discountPercentage < 0 || data.discountPercentage > 100) {
        return NextResponse.json({
          error: "Discount percentage must be between 0 and 100"
        }, { status: 400 });
      }
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (data.discountPercentage !== undefined) {
      updateData.discountPercentage = parseFloat(data.discountPercentage);
    }

    if (data.active !== undefined) {
      updateData.active = data.active;
    }

    // Update the discount tier
    const { data: updatedDiscount, error } = await supabase
      .from('MultiRegionDiscount')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updatedDiscount);
  } catch (error) {
    console.error("Error updating discount tier:", error);
    return NextResponse.json({ error: "Failed to update discount tier" }, { status: 500 });
  }
}

// DELETE /api/admin/discounts/[id] - Delete a discount tier
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin authorization
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    
    const id = params.id;
    
    const supabase = db();

    // Check if the discount tier exists
    const { data: existingDiscount } = await supabase
      .from('MultiRegionDiscount')
      .select('id')
      .eq('id', id)
      .single();

    if (!existingDiscount) {
      return NextResponse.json({ error: "Discount tier not found" }, { status: 404 });
    }

    // Delete the discount tier
    const { error } = await supabase
      .from('MultiRegionDiscount')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Discount tier deleted successfully" });
  } catch (error) {
    console.error("Error deleting discount tier:", error);
    return NextResponse.json({ error: "Failed to delete discount tier" }, { status: 500 });
  }
}