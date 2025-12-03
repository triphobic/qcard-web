/**
 * User Profile Route - Proxied to Backend
 * GET/PATCH /api/user/profile -> user_service /profile
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { GET, PATCH } = createProxyHandlers();
