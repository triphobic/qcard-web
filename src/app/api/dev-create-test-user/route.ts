import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// This endpoint is for development purposes only!
// It should be removed in production or secured behind an admin authentication

export async function POST(request: Request) {
  // Only allow this in development mode
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: "This endpoint is only available in development mode" }, { status: 403 });
  }
  
  try {
    const body = await request.json();
    const { email, password, firstName, lastName, tenantType } = body;
    
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const supabase = db();

    // Check if user already exists
    const existingUserResult = await supabase
      .from('User')
      .select('id, email')
      .eq('email', email)
      .single();

    const existingUser = handleDbOptional(existingUserResult);

    if (existingUser) {
      return NextResponse.json({
        message: "User already exists",
        user: { id: existingUser.id, email: existingUser.email }
      });
    }

    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Create tenant
    const tenantResult = await supabase
      .from('Tenant')
      .insert({
        id: tenantId,
        name: `${firstName || ''} ${lastName || ''}`.trim() || email,
        type: tenantType || 'TALENT',
        createdAt: now,
        updatedAt: now
      })
      .select()
      .single();

    const tenant = handleDbResult(tenantResult);

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUserResult = await supabase
      .from('User')
      .insert({
        id: userId,
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        tenantId: tenant.id,
        role: 'USER',
        createdAt: now,
        updatedAt: now
      })
      .select()
      .single();

    const newUser = handleDbResult(newUserResult);
    
    return NextResponse.json({
      message: "Test user created successfully",
      user: { 
        id: newUser.id,
        email: newUser.email,
        name: `${newUser.firstName || ''} ${newUser.lastName || ''}`.trim() || null,
        tenantId: tenant.id,
        tenantType: tenant.type
      }
    });
  } catch (error) {
    console.error("Create test user error:", error);
    return NextResponse.json({ 
      error: "Failed to create test user", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}