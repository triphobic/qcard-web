import { NextResponse } from "next/server";
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = db();

    console.log("DB Debug: Testing database connection...");

    // Test basic database connectivity
    const testResult = await supabase.rpc('test_connection');
    console.log("DB Debug: Basic connectivity test result:", testResult);

    // Count users (a simple query that should work)
    const countResult = await supabase
      .from('User')
      .select('*', { count: 'exact', head: true });

    const userCount = countResult.count || 0;
    console.log(`DB Debug: Found ${userCount} users in database`);

    // Sample user info (without exposing sensitive data)
    const usersResult = await supabase
      .from('User')
      .select(`
        id,
        email,
        role,
        tenantId,
        Tenant:Tenant(
          id,
          type
        )
      `)
      .limit(3);

    const users = handleDbResult(usersResult);
    
    // Sanitize the data before returning
    const sanitizedUsers = users.map(user => ({
      id: user.id,
      emailDomain: user.email.split('@')[1],
      hasEmail: !!user.email,
      role: user.role,
      hasTenant: !!user.tenantId,
      tenantType: user.Tenant?.type || 'none'
    }));
    
    return NextResponse.json({
      connected: true,
      databaseUrl: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'),
      userCount,
      sampleUsers: sanitizedUsers,
      env: {
        nodeEnv: process.env.NODE_ENV,
        platform: process.platform,
      }
    });
  } catch (error) {
    console.error("DB Debug: Error connecting to database:", error);
    return NextResponse.json({ 
      connected: false,
      error: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      databaseUrl: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'),
    }, { status: 500 });
  }
}