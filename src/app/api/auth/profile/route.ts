/**
 * Auth Profile Route - Proxied to Backend
 * GET /api/auth/profile -> auth_service /profile
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { GET } = createProxyHandlers();
