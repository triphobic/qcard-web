import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Test endpoint to debug sign-in issues
 * Usage: POST /api/auth/test-signin with { email, password }
 */
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    console.log('🔍 Testing sign-in for:', email);

    // Create Supabase client for server-side
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Try to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ Sign-in error:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        errorCode: error.status,
        details: {
          name: error.name,
          status: error.status,
        }
      }, { status: 400 });
    }

    if (data?.user) {
      console.log('✅ Sign-in successful:', {
        userId: data.user.id,
        email: data.user.email,
      });

      return NextResponse.json({
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          emailConfirmed: data.user.email_confirmed_at !== null,
        },
        session: {
          hasAccessToken: !!data.session?.access_token,
          expiresAt: data.session?.expires_at,
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Sign-in failed for unknown reason'
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Test sign-in error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : null,
    }, { status: 500 });
  }
}

/**
 * GET endpoint to check auth configuration
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  return NextResponse.json({
    configured: {
      supabaseUrl: !!supabaseUrl,
      anonKey: hasAnonKey,
      serviceRoleKey: hasServiceKey,
    },
    supabaseUrl: supabaseUrl || 'NOT SET',
  });
}
