/**
 * /api/talent/profile/images/[id] Route
 * Proxied to Backend
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { DELETE } = createProxyHandlers();
