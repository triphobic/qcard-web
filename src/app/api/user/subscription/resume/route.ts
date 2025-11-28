import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import stripe from '@/lib/stripe';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * API route to resume a canceled subscription
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
      .eq('cancelAtPeriodEnd', true)
      .limit(1)
      .single();

    if (fetchError || !dbSubscription?.stripeSubscriptionId) {
      console.error('Error fetching subscription:', fetchError);
      return NextResponse.json(
        { error: 'No canceled subscription found' },
        { status: 404 }
      );
    }

    // Resume the subscription in Stripe
    await stripe.subscriptions.update(dbSubscription.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    // Update the subscription in our database
    const { error: updateError } = await supabase
      .from('Subscription')
      .update({
        cancelAtPeriodEnd: false,
        updatedAt: new Date().toISOString()
      })
      .eq('id', dbSubscription.id);

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      throw updateError;
    }
    
    return NextResponse.json({
      message: 'Subscription has been resumed'
    });
  } catch (error) {
    console.error('Error resuming subscription:', error);
    return NextResponse.json(
      { error: 'Failed to resume subscription' },
      { status: 500 }
    );
  }
}