/**
 * Subscription Resume Route - Proxied to Backend
 * POST /api/user/subscription/resume -> user_service /subscription/resume
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { POST } = createProxyHandlers();
