import { getSession } from "@/lib/supabase-auth";
import { redirect } from "next/navigation";
import type { AppSession } from "@/lib/supabase-auth";

// Helper function to check if a user is admin
function checkIsAdmin(profile: AppSession['profile']) {
  return profile?.role === "ADMIN" ||
         profile?.role === "SUPER_ADMIN" ||
         profile?.isAdmin === true;
}

/**
 * Check if a user is an admin with customizable behavior for API routes
 *
 * @param options.redirectOnFailure - Whether to redirect on failure (default: true)
 * @param options.throwOnFailure - Whether to throw an error on failure for API routes (default: false)
 */
export async function requireAdmin(options = { redirectOnFailure: true, throwOnFailure: false }) {
  console.log('requireAdmin called with options:', options);

  const session = await getSession();

  if (!session || !session.user) {
    console.log('No session or user found');

    if (options.throwOnFailure) {
      throw new Error('Authentication required');
    }

    if (options.redirectOnFailure) {
      redirect("/sign-in");
    }

    return null;
  }

  const isAdmin = checkIsAdmin(session.profile);

  if (!isAdmin) {
    console.log('User is not an admin:', session.user.email);

    if (options.throwOnFailure) {
      throw new Error('Admin access required');
    }

    if (options.redirectOnFailure) {
      redirect("/unauthorized");
    }

    return null;
  }

  console.log('Admin access verified for:', session.user.email);
  return session;
}

/**
 * Check if a user is a super admin with customizable behavior for API routes
 *
 * @param options.redirectOnFailure - Whether to redirect on failure (default: true)
 * @param options.throwOnFailure - Whether to throw an error on failure for API routes (default: false)
 */
export async function requireSuperAdmin(options = { redirectOnFailure: true, throwOnFailure: false }) {
  console.log('requireSuperAdmin called with options:', options);

  const session = await getSession();

  if (!session || !session.user) {
    console.log('No session or user found');

    if (options.throwOnFailure) {
      throw new Error('Authentication required');
    }

    if (options.redirectOnFailure) {
      redirect("/sign-in");
    }

    return null;
  }

  const isSuperAdmin = session.profile?.role === "SUPER_ADMIN";

  if (!isSuperAdmin) {
    console.log('User is not a super admin:', session.user.email);

    if (options.throwOnFailure) {
      throw new Error('Super admin access required');
    }

    if (options.redirectOnFailure) {
      redirect("/unauthorized");
    }

    return null;
  }

  console.log('Super admin access verified for:', session.user.email);
  return session;
}