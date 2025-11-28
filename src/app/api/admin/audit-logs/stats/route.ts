import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { requireAdmin } from '@/lib/admin-helpers';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/admin/audit-logs/stats - Get audit log statistics
export async function GET() {
  try {
    const supabase = db();

    console.log('GET /api/admin/audit-logs/stats request received');
    
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
    
    // Get total count
    const { count: totalLogs } = await supabase
      .from('AuditLog')
      .select('*', { count: 'exact', head: true });

    // Get logs from last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentLogs } = await supabase
      .from('AuditLog')
      .select('*', { count: 'exact', head: true })
      .gte('createdAt', last24Hours);

    // Get top actions using RPC or manual aggregation
    // Note: Supabase doesn't have native groupBy, so we fetch all and aggregate in JS
    const { data: allLogs } = await supabase
      .from('AuditLog')
      .select('action, adminId');

    // Aggregate actions
    const actionCounts: Record<string, number> = {};
    const adminCounts: Record<string, number> = {};

    (allLogs || []).forEach((log: any) => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      adminCounts[log.adminId] = (adminCounts[log.adminId] || 0) + 1;
    });

    const actionStats = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topAdminIds = Object.entries(adminCounts)
      .map(([adminId, count]) => ({ adminId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get admin details
    const adminIds = topAdminIds.map(stat => stat.adminId);
    const { data: admins } = await supabase
      .from('User')
      .select('id, email, firstName, lastName')
      .in('id', adminIds);
    
    const adminStatsWithDetails = topAdminIds.map(stat => {
      const admin = (admins || []).find((a: any) => a.id === stat.adminId);
      return {
        adminId: stat.adminId,
        count: stat.count,
        admin: admin ? {
          email: admin.email,
          name: `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email
        } : null
      };
    });

    return NextResponse.json({
      totalLogs: totalLogs || 0,
      recentLogs: recentLogs || 0,
      actionStats,
      adminStats: adminStatsWithDetails
    });
  } catch (error) {
    console.error('Error fetching audit log stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit log stats', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}