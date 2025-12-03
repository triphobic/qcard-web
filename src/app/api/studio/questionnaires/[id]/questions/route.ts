/**
 * /api/studio/questionnaires/[id]/questions Route
 * Proxied to Backend
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { GET, POST } = createProxyHandlers();
