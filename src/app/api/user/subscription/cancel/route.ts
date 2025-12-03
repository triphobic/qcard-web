/**
 * Subscription Cancel Route - Proxied to Backend
 * POST /api/user/subscription/cancel -> user_service /subscription/cancel
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { POST } = createProxyHandlers();
