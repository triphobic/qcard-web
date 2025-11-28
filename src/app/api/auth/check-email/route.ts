import { NextResponse } from "next/server";
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * API endpoint to check if an email exists in the database
 * Used by the sign-in page to provide more helpful error messages
 */
export async function GET(request: Request) {
  try {
    const supabase = db();

    // Get email from query string
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    if (!email) {
      return NextResponse.json({ 
        error: "Email parameter is required" 
      }, { status: 400 });
    }
    
    console.log(`Checking if email exists: ${email}`);
    
    // Check if the email exists with exact match
    const userResult = await supabase
      .from('User')
      .select('id, email')
      .eq('email', email)
      .single();

    let user = handleDbOptional(userResult);

    // If not found, try case-insensitive search
    if (!user) {
      console.log(`No exact match for ${email}, trying case-insensitive search`);

      const usersResult = await supabase
        .from('User')
        .select('id, email')
        .ilike('email', email)
        .limit(1)
        .single();

      user = handleDbOptional(usersResult);
    }
    
    // Return result with actual email if found (for case correction)
    return NextResponse.json({
      exists: !!user,
      email: user ? user.email : null
    });
  } catch (error) {
    console.error("Error checking email:", error);
    // Return true by default to avoid exposing user existence through errors
    // This means the client will show "incorrect password" instead of "user not found"
    // which is safer from a security perspective
    return NextResponse.json({ 
      exists: true,
      error: "Error checking email"
    });
  }
}