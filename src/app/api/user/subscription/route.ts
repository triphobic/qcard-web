import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { getUserSubscription } from '@/lib/subscription-helpers';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * API endpoint to get the current user's subscription status
 */
export async function GET() {
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
    
    return NextResponse.json(subscriptionInfo);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}