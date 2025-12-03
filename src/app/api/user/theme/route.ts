/**
 * User Theme Route - Proxied to Backend
 * GET/PATCH /api/user/theme -> user_service /theme
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { GET, PATCH } = createProxyHandlers();
