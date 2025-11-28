import Stripe from 'stripe';

const isDevelopment = process.env.NODE_ENV === 'development';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// Check if we're in build time
const isBuildTime = typeof window === 'undefined' && (
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME
);

// Stripe is required in production, optional in development and build time
if (!stripeSecretKey && !isDevelopment && !isBuildTime) {
  const errorMessage = `
❌ STRIPE CONFIGURATION REQUIRED ❌

The following environment variables must be set for production:
  - STRIPE_SECRET_KEY
  - STRIPE_WEBHOOK_SECRET
  - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

Get these from: Stripe Dashboard → Developers → API Keys

For development: Stripe is optional. The app will build without it.
For production: Stripe is REQUIRED for payment processing.
`;

  console.error(errorMessage);
  throw new Error('Stripe credentials are required in production.');
} else if (! stripeSecretKey && isBuildTime) {
  console.warn('⚠️ Stripe credentials not provided during build. App will not function without real credentials.');
}

// Create Stripe client only if key is available
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-04-10',
    })
  : null;

// Helper to ensure Stripe is available when needed
export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
  }
  return stripe;
}

export default stripe;