'use client';

import { useRouter } from 'next/navigation';

/**
 * Client-side navigation utilities for authenticated routes
 * These help handle routing issues that can occur after authentication
 */

/**
 * Navigate to a path with the option to force a full page refresh
 * This helps when client-side navigation breaks after authentication
 *
 * Note: This function uses window.location for navigation instead of useRouter
 * to avoid React hooks rule violations (hooks can only be called in components)
 */
export function navigateTo(path: string, options: { forceRefresh?: boolean } = {}) {
  const { forceRefresh = false } = options;

  // Always use window.location for navigation to avoid hooks rule violation
  // This ensures navigation works consistently without requiring a component context
  window.location.href = path;
}

/**
 * Navigate based on user role/tenant type
 * Used to route users to the correct dashboard after authentication
 */
export function navigateByRole(user: any, options: { forceRefresh?: boolean } = {}) {
  if (!user) {
    navigateTo('/sign-in', options);
    return;
  }
  
  if (user.isAdmin || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.tenantType === 'ADMIN') {
    navigateTo('/admin/dashboard', options);
  } else if (user.tenantType === 'STUDIO') {
    navigateTo('/studio/dashboard', options);
  } else {
    navigateTo('/talent/dashboard', options);
  }
}

/**
 * A hook to determine if we should force page refreshes for navigation
 * This helps with authentication state issues in Next.js
 */
export function useForceRefreshStrategy() {
  // Default to using force refresh in production for reliability
  // This ensures authentication state is always fresh
  const shouldForceRefresh = process.env.NODE_ENV === 'production';
  
  return {
    shouldForceRefresh,
    navigateTo: (path: string) => navigateTo(path, { forceRefresh: shouldForceRefresh }),
    navigateByRole: (user: any) => navigateByRole(user, { forceRefresh: shouldForceRefresh }),
  };
}