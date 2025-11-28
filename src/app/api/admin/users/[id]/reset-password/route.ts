import { NextResponse } from 'next/server';
import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { requireAdmin } from '@/lib/admin-helpers';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// POST /api/admin/users/[id]/reset-password
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`POST /api/admin/users/${params.id}/reset-password request received`);
    
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

    // Check if user exists
    const { data: user } = await supabase
      .from('User')
      .select('id, email, firstName, lastName')
      .eq('id', params.id)
      .single();

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate a random temporary password
    const tempPassword = crypto.randomBytes(12).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Update user with new password
    const { error } = await supabase
      .from('User')
      .update({
        password: hashedPassword,
        updatedAt: new Date().toISOString()
      })
      .eq('id', params.id);

    if (error) throw error;
    
    // In a real application, you would send an email with the reset link
    // For this demo, we'll return the temporary password directly
    
    return NextResponse.json({
      success: true,
      message: 'Password has been reset',
      // In a real app, you should NOT return the password in the response
      // This is just for demonstration purposes
      temporaryPassword: tempPassword,
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
    });
  } catch (error) {
    console.error(`Error resetting password for user ${params.id}:`, error);
    return NextResponse.json(
      { 
        error: 'Failed to reset password',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}