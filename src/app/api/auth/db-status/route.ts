import { NextResponse } from "next/server";
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * API endpoint to check database connectivity
 * Used for diagnosing connection issues that might affect authentication
 */
export async function GET() {
  try {
    const supabase = db();

    console.log("Database status check requested");

    // Simple query to test database connection
    const startTime = Date.now();
    const testQuery = await supabase.rpc('test_connection');
    const queryTime = Date.now() - startTime;

    console.log(`Database test query completed in ${queryTime}ms`);

    // Count users to check data access
    const countResult = await supabase
      .from('User')
      .select('*', { count: 'exact', head: true });

    const userCount = countResult.count || 0;

    // Get database information
    const dbInfo = [{ version: 'PostgreSQL via Supabase', database: 'supabase' }];
    
    return NextResponse.json({
      status: "connected",
      queryTime: `${queryTime}ms`,
      userCount,
      databaseInfo: dbInfo
    });
  } catch (error) {
    console.error("Database connection error:", error);
    
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      type: error instanceof Error ? error.name : "Unknown",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}