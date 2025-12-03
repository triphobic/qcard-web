/**
 * Delete Account Route - Proxied to Backend
 * DELETE /api/user/delete-account -> user_service /delete-account
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { DELETE } = createProxyHandlers();
