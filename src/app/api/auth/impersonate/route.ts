import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { createAuditLog, extractRequestInfo, AUDIT_ACTIONS } from '@/lib/audit-log';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/auth/impersonate
export async function GET(request: Request) {
  try {
    const supabase = db();

    // Get the current session
    const session = await getSession();
    if (!session || !session.profile || session.profile.role !== 'ADMIN' && session.profile.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Get user ID from query params
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const adminId = url.searchParams.get('adminId');

    // Validate parameters
    if (!userId || !adminId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Verify the admin ID matches the current user
    if (session.profile.id !== adminId) {
      return NextResponse.json(
        { error: 'Admin ID mismatch - session may have expired' },
        { status: 403 }
      );
    }

    // Get the user to impersonate
    const userResult = await supabase
      .from('User')
      .select('*, Tenant(*)')
      .eq('id', userId)
      .single();

    const userToImpersonate = handleDbOptional(userResult);

    if (!userToImpersonate) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Extract request information for audit logging
    const { ipAddress, userAgent } = extractRequestInfo(request);
    
    // Create audit log entry for the actual login
    await createAuditLog({
      action: AUDIT_ACTIONS.USER_IMPERSONATE_LOGIN,
      adminId,
      targetId: userId,
      details: {
        adminEmail: session.profile.email,
        targetEmail: userToImpersonate.email,
        targetName: `${userToImpersonate.firstName || ''} ${userToImpersonate.lastName || ''}`.trim(),
        tenantType: userToImpersonate.Tenant?.type
      },
      ipAddress,
      userAgent
    });

    // Set cookie or session for impersonation
    // This would integrate with your NextAuth setup
    
    // Determine where to redirect the user based on their role
    let redirectUrl = '/role-redirect';
    
    // Redirect to appropriate dashboard
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  } catch (error) {
    console.error('Error in impersonation endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Impersonation failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}