/**
 * /api/studio/external-actors/projects Route
 * Proxied to Backend
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { POST, PATCH, DELETE } = createProxyHandlers();
