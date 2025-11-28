import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { z } from 'zod';
import bcrypt from 'bcrypt';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for password change
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required" }),
  newPassword: z.string().min(8, { message: "New password must be at least 8 characters" }),
});

// POST /api/user/change-password - Change the authenticated user's password
export async function POST(request: Request) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const body = await request.json();

    // Validate input data
    const result = passwordChangeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = result.data;

    // Get user with password
    const userResult = await supabase
      .from('User')
      .select('id, password')
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user || !user.password) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await supabase
      .from('User')
      .update({
        password: hashedPassword,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', session.profile.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error changing password:", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}