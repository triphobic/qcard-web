/**
 * User Subscription Route - Proxied to Backend
 * GET /api/user/subscription -> user_service /subscription
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { GET } = createProxyHandlers();
