/**
 * /api/studio/projects/[id]/scenes/[sceneId]/external-actors/[actorId] Route
 * Proxied to Backend
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { GET, PATCH, DELETE } = createProxyHandlers();
