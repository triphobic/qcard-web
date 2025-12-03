/**
 * /api/studio/projects/[id]/members/[memberId] Route
 * Proxied to Backend
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { GET, PATCH, DELETE } = createProxyHandlers();
