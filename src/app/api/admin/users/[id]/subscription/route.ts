/**
 * /api/admin/users/[id]/subscription Route
 * Proxied to Backend
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { POST, PUT, DELETE } = createProxyHandlers();
