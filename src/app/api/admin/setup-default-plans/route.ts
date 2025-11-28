import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { requireAdmin } from '@/lib/admin-helpers';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// POST /api/admin/setup-default-plans - Create default subscription plans
export async function POST() {
  try {
    const supabase = db();

    console.log('POST /api/admin/setup-default-plans request received');
    
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
    
    // Check if plans already exist
    const { data: existingPlans, count } = await supabase
      .from('SubscriptionPlan')
      .select('*', { count: 'exact' });

    if (count && count > 0) {
      return NextResponse.json({
        message: 'Default subscription plans already exist',
        plans: existingPlans
      });
    }

    // Create default subscription plans
    const defaultPlans = [
      {
        id: crypto.randomUUID(),
        name: 'Basic',
        description: 'Basic subscription plan',
        price: 9.99,
        interval: 'month',
        features: ['basic_features', 'standard_support'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: 'Pro',
        description: 'Professional subscription plan',
        price: 19.99,
        interval: 'month',
        features: ['all_features', 'priority_support', 'advanced_analytics'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: 'Lifetime',
        description: 'Lifetime subscription plan',
        price: 499.99,
        interval: 'lifetime',
        features: ['all_features', 'priority_support', 'advanced_analytics', 'lifetime_access'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const { data: createdPlans, error } = await supabase
      .from('SubscriptionPlan')
      .insert(defaultPlans)
      .select();

    if (error) throw error;

    console.log(`Created ${createdPlans?.length || 0} default subscription plans`);

    return NextResponse.json({
      message: 'Default subscription plans created successfully',
      plans: createdPlans
    });
  } catch (error) {
    console.error('Error creating default subscription plans:', error);
    return NextResponse.json(
      { error: 'Failed to create default subscription plans', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}