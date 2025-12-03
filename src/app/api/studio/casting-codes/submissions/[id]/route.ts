/**
 * /api/studio/casting-codes/submissions/[id] Route
 * Proxied to Backend
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { PATCH } = createProxyHandlers();
