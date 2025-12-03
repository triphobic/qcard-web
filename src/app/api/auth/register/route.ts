/**
 * User Registration Route - Proxied to Backend
 * POST /api/auth/register -> auth_service /register
 *
 * Creates application-specific user profile after Supabase Auth user creation.
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { POST } = createProxyHandlers();
