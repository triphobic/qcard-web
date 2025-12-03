/**
 * Change Password Route - Proxied to Backend
 * POST /api/user/change-password -> user_service /change-password
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { POST } = createProxyHandlers();
