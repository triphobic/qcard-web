import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { requireAdmin } from '@/lib/admin-helpers';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/admin/subscription-plans - List all subscription plans
export async function GET() {
  try {
    const supabase = db();

    console.log('GET /api/admin/subscription-plans request received');
    
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
    
    // Get all subscription plans
    const { data: plans, error } = await supabase
      .from('SubscriptionPlan')
      .select('*')
      .order('createdAt', { ascending: true });

    if (error) throw error;

    console.log(`Found ${plans?.length || 0} subscription plans`);

    return NextResponse.json({ plans: plans || [] });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription plans', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST /api/admin/subscription-plans - Create a new subscription plan
export async function POST(request: Request) {
  try {
    console.log('POST /api/admin/subscription-plans request received');
    
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
    
    const body = await request.json();
    const { name, description, price, interval = 'month', features } = body;
    
    if (!name || price === undefined) {
      return NextResponse.json(
        { error: 'Name and price are required' },
        { status: 400 }
      );
    }
    
    // Create new subscription plan
    const { data: plan, error } = await supabase
      .from('SubscriptionPlan')
      .insert({
        id: crypto.randomUUID(),
        name,
        description: description || `${name} subscription plan`,
        price: parseFloat(price),
        interval,
        features: features || [],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Created subscription plan: ${plan.name} (${plan.id})`);

    return NextResponse.json({
      message: 'Subscription plan created successfully',
      plan
    });
  } catch (error) {
    console.error('Error creating subscription plan:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription plan', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}