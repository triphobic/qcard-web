import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-helpers";
import { getSession } from "@/lib/supabase-auth";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('Admin access check requested');

    // Get the auth session without redirect
    const session = await getSession();

    if (!session || !session.profile) {
      console.error('No session found for admin check');
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required"
        },
        { status: 401 }
      );
    }

    // Check if user is admin
    const isAdmin = session.profile.isAdmin;

    if (!isAdmin) {
      console.error('User is not an admin:', session.profile.email);
      return NextResponse.json(
        {
          success: false,
          error: "Admin privileges required",
          user: {
            email: session.profile.email,
            role: session.profile.role
          }
        },
        { status: 403 }
      );
    }

    console.log('Admin access confirmed for:', session.profile.email);
    return NextResponse.json({
      success: true,
      user: {
        id: session.profile.id,
        name: `${session.profile.firstName || ''} ${session.profile.lastName || ''}`.trim() || null,
        email: session.profile.email,
        role: session.profile.role,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin access check failed with error:', error);
    return NextResponse.json(
      {
        success: false,
        error: "Admin access check failed",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}