import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { requireAdmin } from '@/lib/admin-helpers';
import bcrypt from '@/lib/bcrypt-wrapper';
import crypto from 'crypto';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for user creation
const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']),
  tenantType: z.enum(['TALENT', 'STUDIO', 'ADMIN']),
});

// GET /api/admin/users
export async function GET(request: Request) {
  try {
    const supabase = db();

    // Log the request for debugging
    console.log('GET /api/admin/users request received');
    
    // Check admin access with API-friendly options (throw instead of redirect)
    const session = await requireAdmin({ 
      redirectOnFailure: false, 
      throwOnFailure: true 
    });
    
    if (!session) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    console.log('Admin access granted to:', session?.profile?.email);

    // Get query params
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const tenantType = searchParams.get('tenantType');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;
    
    console.log('Query params:', { search, role, tenantType, limit, page });

    // Build query
    let query = supabase
      .from('User')
      .select(`
        id,
        email,
        firstName,
        lastName,
        role,
        createdAt,
        updatedAt,
        Tenant!inner (
          id,
          type,
          name
        )
      `, { count: 'exact' });

    // Add search filter
    if (search) {
      query = query.or(`email.ilike.%${search}%,firstName.ilike.%${search}%,lastName.ilike.%${search}%`);
    }

    // Add role filter
    if (role) {
      query = query.eq('role', role);
    }

    // Add tenant type filter
    if (tenantType) {
      query = query.eq('Tenant.type', tenantType);
    }

    // Add pagination and ordering
    query = query
      .order('createdAt', { ascending: false })
      .range(skip, skip + limit - 1);

    // Execute query
    console.log('Fetching users with Supabase');
    const { data: users, error, count: totalCount } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }

    console.log(`Found ${users?.length || 0} users, total: ${totalCount}`);

    // Format response
    const formattedUsers = (users || []).map(user => {
      const tenant = Array.isArray(user.Tenant) ? user.Tenant[0] : user.Tenant;
      return {
        id: user.id,
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        role: user.role,
        tenantType: tenant?.type || null,
        tenantName: tenant?.name || null,
        tenantId: tenant?.id || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    });

    return NextResponse.json({
      users: formattedUsers,
      pagination: {
        total: totalCount || 0,
        page,
        limit,
        pages: Math.ceil((totalCount || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/admin/users
export async function POST(request: Request) {
  try {
    console.log('POST /api/admin/users request received');
    
    // Check admin access with API-friendly options
    const session = await requireAdmin({ 
      redirectOnFailure: false, 
      throwOnFailure: true 
    });
    
    if (!session) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    console.log('Admin access granted for user creation to:', session?.profile?.email);
    
    // Parse and validate request body
    const body = await request.json();
    console.log('Received user creation request:', { ...body, password: '[REDACTED]' });
    
    const validationResult = createUserSchema.safeParse(body);

    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.flatten());
      return NextResponse.json(
        { 
          error: 'Invalid user data', 
          details: validationResult.error.flatten() 
        },
        { status: 400 }
      );
    }

    const { email, password, firstName, lastName, role, tenantType } = validationResult.data;

    // Check if user with this email already exists
    const { data: existingUser } = await supabase
      .from('User')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password with our wrapped bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Password hashed successfully');

    // Create user with tenant using sequential operations
    console.log('Creating user with tenant');

    // Generate IDs once to ensure consistency
    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const profileId = crypto.randomUUID();
    const studioId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Format tenant name
    const tenantName = `${firstName || ''} ${lastName || ''}`.trim() || email;

    try {
      // Create tenant
      const { data: tenant, error: tenantError } = await supabase
        .from('Tenant')
        .insert({
          id: tenantId,
          name: tenantName,
          type: tenantType,
          createdAt: now,
          updatedAt: now
        })
        .select()
        .single();

      if (tenantError) throw tenantError;
      console.log(`Tenant created with ID: ${tenant.id}`);

      // Create user
      const { data: user, error: userError } = await supabase
        .from('User')
        .insert({
          id: userId,
          email,
          password: hashedPassword,
          firstName: firstName || null,
          lastName: lastName || null,
          role,
          tenantId: tenant.id,
          createdAt: now,
          updatedAt: now
        })
        .select()
        .single();

      if (userError) throw userError;
      console.log(`User created with ID: ${user.id}`);

      // If tenant type is TALENT, create profile
      if (tenantType === 'TALENT') {
        const { error: profileError } = await supabase
          .from('Profile')
          .insert({
            id: profileId,
            userId: user.id,
            availability: true,
            createdAt: now,
            updatedAt: now
          });

        if (profileError) throw profileError;
        console.log(`Profile created with ID: ${profileId}`);
      }

      // If tenant type is STUDIO, create studio
      if (tenantType === 'STUDIO') {
        const { error: studioError } = await supabase
          .from('Studio')
          .insert({
            id: studioId,
            name: tenantName,
            tenantId: tenant.id,
            description: `Studio for ${tenantName}`,
            createdAt: now,
            updatedAt: now
          });

        if (studioError) throw studioError;
        console.log(`Studio created with ID: ${studioId}`);
      }

      // Return created user (without password)
      return NextResponse.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantType,
        tenantId: user.tenantId,
      });
    } catch (createError) {
      console.error('Error during user creation:', createError);
      throw createError;
    }
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create user',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}