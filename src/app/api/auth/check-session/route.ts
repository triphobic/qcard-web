import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ 
      authenticated: false,
      message: "Not authenticated"
    });
  }
  
  return NextResponse.json({ 
    authenticated: true,
    user: {
      id: session.profile?.id,
      name: session.profile?.name,
      email: session.profile?.email,
      tenantType: session.profile?.tenantType,
      role: session.profile?.role
    }
  });
}