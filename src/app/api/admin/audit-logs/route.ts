import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { requireAdmin } from '@/lib/admin-helpers';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/admin/audit-logs - Retrieve audit logs
export async function GET(request: Request) {
  try {
    const supabase = db();

    console.log('GET /api/admin/audit-logs request received');
    
    // Check admin access
    const session = await requireAdmin({ 
      redirectOnFailure: false, 
      throwOnFailure: true 
    });
    
    if (!session) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Max 100 per page
    const action = searchParams.get('action');
    const adminId = searchParams.get('adminId');
    const targetId = searchParams.get('targetId');
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: any = {};
    if (action) where.action = action;
    if (adminId) where.adminId = adminId;
    if (targetId) where.targetId = targetId;
    
    // Build Supabase query
    let query = supabase
      .from('AuditLog')
      .select(`
        *,
        admin:User!adminId (
          id,
          email,
          firstName,
          lastName,
          role
        ),
        target:User!targetId (
          id,
          email,
          firstName,
          lastName,
          role
        )
      `, { count: 'exact' });

    if (action) query = query.eq('action', action);
    if (adminId) query = query.eq('adminId', adminId);
    if (targetId) query = query.eq('targetId', targetId);

    const { data: auditLogs, error, count: totalCount } = await query
      .order('createdAt', { ascending: false })
      .range(skip, skip + limit - 1);

    if (error) throw error;
    
    console.log(`Found ${auditLogs.length} audit logs (page ${page})`);
    
    return NextResponse.json({
      auditLogs: auditLogs || [],
      pagination: {
        total: totalCount || 0,
        page,
        limit,
        pages: Math.ceil((totalCount || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}