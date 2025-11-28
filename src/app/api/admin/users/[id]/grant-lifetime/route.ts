import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { requireAdmin } from '@/lib/admin-helpers';
import { createAuditLog, extractRequestInfo, AUDIT_ACTIONS } from '@/lib/audit-log';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// POST /api/admin/users/[id]/grant-lifetime - Grant lifetime access to user
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`POST /api/admin/users/${params.id}/grant-lifetime request received`);
    
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
    
    const supabase = db();

    // Find the user
    const { data: user } = await supabase
      .from('User')
      .select(`
        id,
        email,
        firstName,
        lastName,
        subscriptions:Subscription!inner (
          id,
          status
        )
      `)
      .eq('id', params.id)
      .eq('subscriptions.status', 'ACTIVE')
      .single();

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user already has an active subscription
    if (user.subscriptions && user.subscriptions.length > 0) {
      // Update existing subscription to lifetime
      const existingSubscription = user.subscriptions[0];

      const { data: updatedSubscription, error } = await supabase
        .from('Subscription')
        .update({
          currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          cancelAtPeriodEnd: false,
          status: 'ACTIVE',
          updatedAt: new Date().toISOString()
        })
        .eq('id', existingSubscription.id)
        .select('*, plan:SubscriptionPlan(*)')
        .single();

      if (error) throw error;
      
      console.log(`Updated existing subscription to lifetime for user ${params.id}`);
      
      // Create audit log entry
      const { ipAddress, userAgent } = extractRequestInfo(request);
      await createAuditLog({
        action: AUDIT_ACTIONS.SUBSCRIPTION_GRANT_LIFETIME,
        adminId: session.profile.id,
        targetId: params.id,
        details: {
          adminEmail: session.profile.email,
          targetEmail: user.email,
          targetName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          subscriptionId: updatedSubscription.id,
          planName: updatedSubscription.plan.name,
          actionType: 'update_existing'
        },
        ipAddress,
        userAgent
      });
      
      return NextResponse.json({
        message: 'User granted lifetime access (updated existing subscription)',
        subscription: updatedSubscription
      });
    } else {
      // Create new lifetime subscription
      
      // Find or create lifetime plan
      const { data: lifetimePlans } = await supabase
        .from('SubscriptionPlan')
        .select('*')
        .or('name.ilike.%Lifetime%,interval.eq.lifetime')
        .limit(1);

      let lifetimePlan = lifetimePlans?.[0];

      if (!lifetimePlan) {
        // Create lifetime plan if it doesn't exist
        const { data: newPlan } = await supabase
          .from('SubscriptionPlan')
          .insert({
            id: crypto.randomUUID(),
            name: 'Lifetime Access',
            description: 'Lifetime access to all features - Admin granted',
            price: 0,
            interval: 'lifetime',
            features: ['all_features', 'priority_support', 'advanced_analytics', 'lifetime_access'],
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          .select()
          .single();
        lifetimePlan = newPlan!;
        console.log(`Created lifetime plan: ${lifetimePlan.id}`);
      }

      // Create lifetime subscription
      const { data: subscription, error: subError } = await supabase
        .from('Subscription')
        .insert({
          id: crypto.randomUUID(),
          userId: user.id,
          planId: lifetimePlan.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          cancelAtPeriodEnd: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .select('*, plan:SubscriptionPlan(*)')
        .single();

      if (subError || !subscription) throw subError;
      
      console.log(`Created lifetime subscription for user ${params.id}:`, subscription);
      
      // Create audit log entry
      const { ipAddress, userAgent } = extractRequestInfo(request);
      await createAuditLog({
        action: AUDIT_ACTIONS.SUBSCRIPTION_GRANT_LIFETIME,
        adminId: session.profile.id,
        targetId: params.id,
        details: {
          adminEmail: session.profile.email,
          targetEmail: user.email,
          targetName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          subscriptionId: subscription.id,
          planName: subscription.plan.name,
          actionType: 'create_new'
        },
        ipAddress,
        userAgent
      });
      
      return NextResponse.json({
        message: 'User granted lifetime access',
        subscription
      });
    }
    
  } catch (error) {
    console.error(`Error granting lifetime access to user ${params.id}:`, error);
    console.error('Full error object:', JSON.stringify(error, null, 2));
    return NextResponse.json(
      { 
        error: 'Failed to grant lifetime access', 
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}