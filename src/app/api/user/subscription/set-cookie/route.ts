import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { cookies } from 'next/headers';
import { getUserSubscription } from '@/lib/subscription-helpers';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * API endpoint to set the subscription cookie for middleware usage
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    
    // Check if user is authenticated
    if (!session || !session.profile?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userId = session.profile.id;
    
    // Get subscription info
    const subscriptionInfo = await getUserSubscription(userId);
    
    // Set cookie based on subscription status
    const cookieStore = cookies();
    
    if (subscriptionInfo.isSubscribed) {
      // Set cookie to expire when subscription ends
      cookieStore.set('subscription_status', 'active', {
        expires: subscriptionInfo.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days if no expiry date
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
      });
    } else {
      // Remove subscription cookie if no active subscription
      cookieStore.delete('subscription_status');
    }
    
    return NextResponse.json({ success: true, isSubscribed: subscriptionInfo.isSubscribed });
  } catch (error) {
    console.error('Error setting subscription cookie:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}