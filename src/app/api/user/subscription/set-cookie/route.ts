/**
 * Set Subscription Cookie Route
 * This route must stay in the frontend because it manages cookies.
 * It fetches subscription status from the backend and sets cookies accordingly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';

/**
 * Get access token from cookies
 */
async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();

  // Try Supabase auth cookie format
  const supabaseAuth = cookieStore.get('sb-zcpoepdmjhewkspfwhwn-auth-token')?.value;
  if (supabaseAuth) {
    try {
      const parsed = JSON.parse(supabaseAuth);
      return parsed.access_token || null;
    } catch {
      return null;
    }
  }

  return cookieStore.get('sb-access-token')?.value || null;
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch subscription status from backend
    const response = await fetch(`${API_URL}/api/user/subscription`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch subscription status');
    }

    const subscriptionInfo = await response.json();
    const cookieStore = await cookies();

    if (subscriptionInfo.isSubscribed) {
      // Set cookie to expire when subscription ends
      const expiryDate = subscriptionInfo.currentPeriodEnd
        ? new Date(subscriptionInfo.currentPeriodEnd)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default

      cookieStore.set('subscription_status', 'active', {
        expires: expiryDate,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
      });
    } else {
      // Remove subscription cookie if no active subscription
      cookieStore.delete('subscription_status');
    }

    return NextResponse.json({
      success: true,
      isSubscribed: subscriptionInfo.isSubscribed
    });
  } catch (error) {
    console.error('Error setting subscription cookie:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
