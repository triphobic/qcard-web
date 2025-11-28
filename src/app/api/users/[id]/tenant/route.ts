import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  
  // Only allow authenticated users to access their own data
  if (!session?.profile?.id || session.profile.id !== params.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const supabase = db();

    // Get user with tenant information
    const { data: user, error: userError } = await supabase
      .from('User')
      .select(`
        id,
        email,
        firstName,
        lastName,
        tenantId,
        Tenant!inner(type)
      `)
      .eq('id', params.id)
      .single();

    if (userError || !user) {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Extract tenant type
    const tenant = Array.isArray(user.Tenant) ? user.Tenant[0] : user.Tenant;
    const tenantType = tenant?.type || 'TALENT';
    
    // Return user with tenant information
    return NextResponse.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: user.tenantId,
      tenantType: tenantType,
    });
  } catch (error) {
    console.error("Error fetching user tenant info:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch user information",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}