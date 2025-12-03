/**
 * Feature Access Route - Proxied to Backend
 * GET /api/user/features/[featureKey] -> user_service /features/[featureKey]
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { GET } = createProxyHandlers();
