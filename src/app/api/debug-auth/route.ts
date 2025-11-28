import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = db();

    // Check if this is allowed in the current environment
    if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_AUTH_DEBUG) {
      return NextResponse.json(
        { error: 'Auth debugging is disabled in production' },
        { status: 403 }
      );
    }

    // Get all users in the database
    const usersResult = await supabase
      .from('User')
      .select(`
        id,
        email,
        firstName,
        lastName,
        role,
        createdAt,
        updatedAt,
        tenantId,
        tenant:Tenant(
          id,
          type,
          name
        )
      `)
      .order('updatedAt', { ascending: false });

    const users = handleDbResult(usersResult);

    // Get environment information
    const environment = {
      nodeEnv: process.env.NODE_ENV,
      nextBuildSkipDb: process.env.NEXT_BUILD_SKIP_DB === 'true',
      nextAuthUrl: process.env.NEXTAUTH_URL,
      buildTime: process.env.NEXT_BUILD_SKIP_DB === 'true',
      databaseUrl: (process.env.DATABASE_URL || '')
        .replace(/\/\/(.+?):(.+?)@/, '//***:***@') // Mask credentials
        .substring(0, 50) + '...',
    };

    // Get database status
    const dbStatus = {
      userCount: users.length,
      connectionStatus: 'connected', // If we got this far, we're connected
      queryTimestamp: new Date().toISOString()
    };

    // Get bcrypt information
    let bcryptInfo;
    try {
      const bcrypt = require('@/lib/bcrypt-wrapper');
      const testHash = await bcrypt.hash('test', 10);
      const testVerify = await bcrypt.compare('test', testHash);
      
      bcryptInfo = {
        isReal: testVerify === true,
        hashTest: testHash.substring(0, 10) + '...',
        verifyTest: testVerify
      };
    } catch (e) {
      bcryptInfo = {
        error: e instanceof Error ? e.message : String(e)
      };
    }

    return NextResponse.json({
      status: 'success',
      environment,
      database: dbStatus,
      bcrypt: bcryptInfo,
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        role: user.role,
        tenantType: user.tenant?.type,
        updatedAt: user.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error in debug-auth route:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve auth debug information',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}