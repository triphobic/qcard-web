import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import stripe from '@/lib/stripe';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabase = db();

    const session = await getSession();
    const { planId, locationIds } = await req.json();
    
    if (!session || !session.profile?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.profile.id;

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('User')
      .select(`
        id,
        email,
        firstName,
        lastName,
        tenantId,
        Profile(*),
        Tenant(*)
      `)
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get subscription plan details
    const { data: plan, error: planError } = await supabase
      .from('SubscriptionPlan')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      console.error('Error fetching plan:', planError);
      return NextResponse.json({ error: 'Subscription plan not found' }, { status: 404 });
    }

    if (!plan.stripePriceId) {
      return NextResponse.json({ error: 'Subscription plan has no associated Stripe price' }, { status: 400 });
    }

    // Check if user already has a Stripe customer ID
    let customerId = '';

    // Get existing subscription if any
    const { data: existingSubscription } = await supabase
      .from('Subscription')
      .select('*')
      .eq('userId', userId)
      .in('status', ['ACTIVE', 'TRIALING'])
      .limit(1)
      .single();

    if (existingSubscription?.stripeCustomerId) {
      customerId = existingSubscription.stripeCustomerId;
    } else {
      // Create or retrieve a Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
        metadata: {
          userId: user.id,
          tenantType: user.Tenant?.type || 'UNKNOWN'
        }
      });
      
      customerId = customer.id;
    }

    // Get tenant type and ID (studio or talent)
    const tenant = Array.isArray(user.Tenant) ? user.Tenant[0] : user.Tenant;
    const tenantType = tenant?.type || 'UNKNOWN';

    let studioId = undefined;
    if (tenantType === 'STUDIO' && user.tenantId) {
      const { data: studio } = await supabase
        .from('Studio')
        .select('id')
        .eq('tenantId', user.tenantId)
        .limit(1)
        .single();
      studioId = studio?.id;
    }
    
    // Create checkout session
    // Using 'as any' to work around TypeScript issues with Stripe SDK
    const checkoutSession = await (stripe.checkout.sessions.create as any)({
      payment_method_types: ['card'],
      customer: customerId,
      line_items: plan.stripePriceId ? [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ] : [],
      mode: 'subscription',
      subscription_data: {
        metadata: {
          userId: user.id,
          planId: plan.id,
          locations: JSON.stringify(locationIds),
          studioId: studioId
        },
        trial_period_days: 7, // Optional: Give users a 7-day free trial
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscription=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription?canceled=true`,
      metadata: {
        userId: user.id,
        planId: plan.id,
        tenantType
      },
    });
    
    return NextResponse.json({ 
      url: checkoutSession.url,
      sessionId: checkoutSession.id
    });
  } catch (error) {
    console.error('Error creating subscription checkout session:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}