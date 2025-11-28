import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from "next/server";
import { z } from "zod";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schema for registration
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phoneNumber: z.string().optional(),
  userType: z.enum(["TALENT", "STUDIO"]),
});

export async function POST(req: Request) {
  try {
    console.log("📝 REGISTRATION: API request received");
    const body = await req.json();
    console.log("📝 REGISTRATION: Request body parsed", { email: body.email, userType: body.userType });

    // Validate input data
    const result = registerSchema.safeParse(body);
    if (!result.success) {
      console.log("📝 REGISTRATION ERROR: Invalid input data", result.error.flatten());
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, confirmPassword, firstName, lastName, phoneNumber, userType } = result.data;
    console.log(`📝 REGISTRATION: Validated data for ${email}, type: ${userType}`);

    // Verify passwords match if confirmPassword was provided
    if (confirmPassword && password !== confirmPassword) {
      console.log("📝 REGISTRATION ERROR: Passwords do not match");
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      );
    }

    // Create user in Supabase Auth
    // A database trigger will automatically create Tenant, User, and Profile/Studio records
    console.log(`📝 REGISTRATION: Creating Supabase Auth user for ${email}`);
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        firstName,
        lastName,
        phoneNumber,
        userType
      }
    });

    if (authError || !authData.user) {
      console.error(`📝 REGISTRATION ERROR: Failed to create Supabase Auth user:`, authError);

      // Check for duplicate email error
      if (authError?.message?.includes('already registered') || authError?.message?.includes('already been registered')) {
        return NextResponse.json(
          { error: "User with this email already exists" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: authError?.message || "Failed to create authentication account" },
        { status: 500 }
      );
    }

    console.log(`📝 REGISTRATION: Supabase Auth user created with ID: ${authData.user.id}`);
    console.log(`📝 REGISTRATION: Database trigger will automatically create Tenant, User, and ${userType === 'TALENT' ? 'Profile' : 'Studio'} records`);
    console.log(`📝 REGISTRATION: Successfully completed registration for ${email}`);

    // Return success - client will automatically sign in with the credentials
    return NextResponse.json({
      id: authData.user.id,
      email: authData.user.email,
      message: "Registration successful. Signing you in...",
      autoSignIn: true, // Signal to client to auto sign-in
    });

  } catch (error) {
    console.error("📝 REGISTRATION ERROR: Unhandled error during registration:", error);

    const errorDetails = error instanceof Error ? error.message : String(error);
    console.error("📝 REGISTRATION ERROR DETAILS:", errorDetails);

    return NextResponse.json(
      {
        error: "An error occurred during registration",
        details: errorDetails
      },
      { status: 500 }
    );
  }
}
