/**
 * Secure Database Connection - Migrated to Supabase
 *
 * This module provides a dedicated database connection for authentication operations.
 * Migrated from Prisma to Supabase for better scalability and real-time features.
 */

import { db } from './supabase-db';

// Export Supabase client for auth operations
export const authPrisma = db();

// Re-export all Supabase utilities
export * from './supabase-db';
