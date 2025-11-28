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
    const { regionIds, discount } = await req.json();
    
    if (!session || !session.profile?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    
    if (!regionIds || !Array.isArray(regionIds) || regionIds.length === 0) {
      return new NextResponse('Invalid regions selected', { status: 400 });
    }
    
    const userId = session.profile.id;
    

    console.log(`Fetching user ${userId} using Supabase SDK`);
    const userResult = await supabase
      .from('User')
      .select('*, Profile(*)')
      .eq('id', userId)
      .single();

    const user = handleDbOptional(userResult);

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }
    

    console.log('Fetching region plans using Supabase SDK');
    const regionPlansResult = await supabase
      .from('RegionSubscriptionPlan')
      .select('*, region:Region(*)')
      .in('regionId', regionIds)
      .eq('isActive', true);

    const regionPlans = handleDbResult(regionPlansResult);
    
    if (regionPlans.length === 0) {
      return new NextResponse('No active plans found for selected regions', { status: 404 });
    }
    
    // Calculate prices and apply discount if multiple regions
    let subtotal = regionPlans.reduce((sum, plan) => sum + plan.price, 0);
    let discountAmount = 0;
    let discountPercentage = 0;
    
    // Apply discount if provided and valid
    if (regionIds.length > 1 && discount && typeof discount.percentage === 'number') {
      discountPercentage = discount.percentage;
      discountAmount = (subtotal * (discountPercentage / 100));
    } else if (regionIds.length > 1) {

      console.log(`Fetching discount tier for ${regionIds.length} regions using Supabase SDK`);
      const discountTierResult = await supabase
        .from('MultiRegionDiscount')
        .select('*')
        .eq('regionCount', regionIds.length)
        .limit(1)
        .single();

      const discountTier = handleDbOptional(discountTierResult);
      
      if (discountTier) {
        discountPercentage = discountTier.discountPercentage;
        discountAmount = (subtotal * (discountPercentage / 100));
      }
    }
    
    const totalAmount = Math.round((subtotal - discountAmount) * 100); // Convert to cents
    
    // Create line items for each region
    const lineItems = regionPlans.map(plan => ({
      // @ts-ignore - Stripe types issue with recurring
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${plan.region.name} Region Subscription`,
          description: plan.description || `Access to casting opportunities in the ${plan.region.name} region`,
        },
        unit_amount: Math.round(plan.price * 100), // Convert to cents
        recurring: {
          interval: 'month',
        },
      },
      quantity: 1,
    }));
    
    // If there's a discount, add it as a coupon
    let discountOptions = {};
    if (discountAmount > 0) {
      // Create a one-time coupon for this specific checkout
      const coupon = await stripe.coupons.create({
        percent_off: discountPercentage,
        duration: 'forever',
        name: `${discountPercentage}% Multi-Region Discount`,
      });
      
      discountOptions = {
        discounts: [{
          coupon: coupon.id,
        }]
      };
    }
    
    // Create subscription checkout session
    // @ts-ignore - Stripe API type issues
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription?canceled=true`,
      metadata: {
        userId: user.id,
        regionIds: JSON.stringify(regionIds),
        discountPercentage: discountPercentage.toString(),
      },
      subscription_data: {
        trial_period_days: 7, // 7-day free trial
        metadata: {
          userId: user.id,
          regionIds: JSON.stringify(regionIds),
          discountPercentage: discountPercentage.toString(),
        },
      },
      ...discountOptions
    });
    

    console.log(`Creating payment record for checkout ${checkoutSession.id} using Supabase SDK`);
    await supabase
      .from('Payment')
      .insert({
        id: crypto.randomUUID(),
        amount: totalAmount / 100, // Convert to dollars
        userId: userId,
        stripeId: checkoutSession.id,
        status: 'PENDING',
        // Type safety workaround
        updatedAt: new Date(),
      });
    
    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Error creating region checkout session:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}