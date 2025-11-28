import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { requireAdmin } from '@/lib/admin-helpers';
import { z } from 'zod';
import bcrypt from '@/lib/bcrypt-wrapper';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for user updates
const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

// GET /api/admin/users/[id]
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`GET /api/admin/users/${params.id} request received`);
    
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
    
    const supabase = db();

    // Get user with tenant and subscriptions
    const { data: user, error } = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*),
        subscriptions:Subscription (
          id,
          status,
          planId,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          createdAt,
          plan:SubscriptionPlan (
            name
          )
        )
      `)
      .eq('id', params.id)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Format and return user data (excluding password)
    const { password, ...userWithoutPassword } = user;
    const userData = {
      ...userWithoutPassword,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      tenantType: user.Tenant?.type,
      tenantName: user.Tenant?.name,
      subscriptions: (user.subscriptions || []).map((sub: any) => ({
        id: sub.id,
        status: sub.status,
        planId: sub.planId,
        planName: sub.plan?.name || 'Unknown',
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        createdAt: sub.createdAt
      }))
    };

    return NextResponse.json(userData);
  } catch (error) {
    console.error(`Error fetching user ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/users/[id]
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`PUT /api/admin/users/${params.id} request received`);
    
    // Check admin access
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
    
    const supabase = db();

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('User')
      .select('*, Tenant(*)')
      .eq('id', params.id)
      .single();

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateUserSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid user data',
          details: validationResult.error.flatten()
        },
        { status: 400 }
      );
    }

    const { email, firstName, lastName, role, password } = validationResult.data;

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    // Only update provided fields
    if (email !== undefined) updateData.email = email;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (role !== undefined) updateData.role = role;

    // If password is provided, hash it
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update user
    const { data: updatedUser, error } = await supabase
      .from('User')
      .update(updateData)
      .eq('id', params.id)
      .select('*, Tenant(*)')
      .single();

    if (error || !updatedUser) {
      throw new Error('Failed to update user');
    }

    // Format and return user data (excluding password)
    const { password: _, ...userWithoutPassword } = updatedUser;
    const userData = {
      ...userWithoutPassword,
      name: `${updatedUser.firstName || ''} ${updatedUser.lastName || ''}`.trim() || updatedUser.email,
      tenantType: updatedUser.Tenant?.type,
      tenantName: updatedUser.Tenant?.name,
    };

    return NextResponse.json(userData);
  } catch (error) {
    console.error(`Error updating user ${params.id}:`, error);
    return NextResponse.json(
      { 
        error: 'Failed to update user',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`DELETE /api/admin/users/${params.id} request received`);
    
    // Check admin access
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
    
    const supabase = db();

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('User')
      .select('id, email')
      .eq('id', params.id)
      .single();

    if (!existingUser) {
      console.log(`User not found with ID: ${params.id}`);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent deleting your own account
    if (session.profile.id === params.id) {
      console.log(`Admin attempted to delete their own account: ${params.id}`);
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    console.log(`Deleting user: ${existingUser.email} (${existingUser.id})`);

    // Delete user
    const { error } = await supabase
      .from('User')
      .delete()
      .eq('id', params.id);

    if (error) {
      throw new Error('Failed to delete user');
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting user ${params.id}:`, error);
    return NextResponse.json(
      { 
        error: 'Failed to delete user',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}