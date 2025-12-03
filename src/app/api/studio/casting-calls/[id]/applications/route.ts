/**
 * /api/studio/casting-calls/[id]/applications Route
 * Proxied to Backend
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { GET } = createProxyHandlers();
