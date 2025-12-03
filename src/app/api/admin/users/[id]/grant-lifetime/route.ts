/**
 * /api/admin/users/[id]/grant-lifetime Route
 * Proxied to Backend
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { POST } = createProxyHandlers();
