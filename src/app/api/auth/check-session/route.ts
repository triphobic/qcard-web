/**
 * Check Session Route - Proxied to Backend
 * GET /api/auth/check-session -> auth_service /check-session
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { GET } = createProxyHandlers();
