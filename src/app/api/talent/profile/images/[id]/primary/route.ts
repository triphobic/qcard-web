/**
 * /api/talent/profile/images/[id]/primary Route
 * Proxied to Backend
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { PATCH } = createProxyHandlers();
