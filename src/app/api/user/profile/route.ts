import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for updating user profile
const userProfileSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required" }).optional(),
  lastName: z.string().min(1, { message: "Last name is required" }).optional(),
  email: z.string().email({ message: "Invalid email address" }).optional(),
});

// GET /api/user/profile - Get the authenticated user's profile
export async function GET() {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();

    const userResult = await supabase
      .from('User')
      .select('*')
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Return user data without sensitive information
    return NextResponse.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
  }
}

// PATCH /api/user/profile - Update the authenticated user's profile
export async function PATCH(request: Request) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const body = await request.json();

    // Validate input data
    const result = userProfileSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const { firstName, lastName, email } = result.data;

    // Check if email is already taken (if trying to change it)
    if (email) {
      const existingUserResult = await supabase
        .from('User')
        .select('id')
        .eq('email', email)
        .single();

      const existingUser = handleDbOptional(existingUserResult);

      if (existingUser && existingUser.id !== session.profile.id) {
        return NextResponse.json(
          { error: "Email is already in use" },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;

    // Update user
    const updatedUserResult = await supabase
      .from('User')
      .update(updateData)
      .eq('id', session.profile.id)
      .select()
      .single();

    const updatedUser = handleDbResult(updatedUserResult);

    // Return updated user data without sensitive information
    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
      tenantId: updatedUser.tenantId,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json({ error: "Failed to update user profile" }, { status: 500 });
  }
}