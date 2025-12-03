/**
 * /api/studio/notes/[id] Route
 * Proxied to Backend
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { GET, POST, DELETE } = createProxyHandlers();
