/**
 * Database Client - Migrated to Supabase
 *
 * This file provides backward compatibility for code still using Prisma syntax.
 * New code should import from '@/lib/supabase-db' instead.
 */

import { db } from './supabase-db';

// Re-export Supabase client as prisma for backward compatibility
// This allows existing code to continue working during migration
export const prisma = db();

// For code that expects the Prisma namespace
export * from './supabase-db';
