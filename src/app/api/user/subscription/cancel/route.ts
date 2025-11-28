import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import stripe from '@/lib/stripe';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * API route to cancel a user's subscription
 */
export async function POST() {
  try {
    const supabase = db();

    const session = await getSession();
    
    // Check authentication
    if (!session?.profile?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.profile.id;

    // Get the subscription from the database
    const { data: dbSubscription, error: fetchError } = await supabase
      .from('Subscription')
      .select('*')
      .eq('userId', userId)
      .in('status', ['ACTIVE', 'TRIALING'])
      .limit(1)
      .single();

    if (fetchError || !dbSubscription?.stripeSubscriptionId) {
      console.error('Error fetching subscription:', fetchError);
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Cancel the subscription at period end in Stripe
    await stripe.subscriptions.update(dbSubscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    // Update the subscription in our database
    const { error: updateError } = await supabase
      .from('Subscription')
      .update({
        cancelAtPeriodEnd: true,
        updatedAt: new Date().toISOString()
      })
      .eq('id', dbSubscription.id);

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      throw updateError;
    }
    
    return NextResponse.json({
      message: 'Subscription will be canceled at the end of the billing period'
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}