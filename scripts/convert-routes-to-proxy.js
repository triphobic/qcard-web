#!/usr/bin/env node

/**
 * Script to convert Next.js API routes to proxy to backend
 * Run with: node scripts/convert-routes-to-proxy.js
 */

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '../src/app/api');

// Routes that should NOT be converted (need to stay as-is)
const KEEP_ROUTES = [
  // Auth routes that handle Supabase-specific auth
  '/api/auth/register',
  '/api/auth/profile',
  '/api/auth/check-session',
  '/api/auth/clear-cookies',
  '/api/auth/auth-error',
  '/api/auth/test-signin', // Test route

  // Health/liveness (no DB)
  '/api/liveness',
  '/api/health', // Keep for now, uses DB but is informational

  // Config (frontend-specific)
  '/api/config',

  // Cookie management (must be on frontend)
  '/api/user/subscription/set-cookie',

  // Already converted
  '/api/user/theme',
  '/api/user/profile',
  '/api/user/subscription',
  '/api/user/subscription/cancel',
  '/api/user/subscription/resume',
  '/api/user/change-password',
  '/api/user/delete-account',
  '/api/user/features/[featureKey]',
];

// Template for proxy route
const PROXY_TEMPLATE = `/**
 * {{DESCRIPTION}}
 * Proxied to Backend
 */

import { createProxyHandlers } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

export const { {{METHODS}} } = createProxyHandlers();
`;

// Parse route file to extract exported HTTP methods
function parseRouteFile(content) {
  const methods = [];

  if (/export\s+(async\s+)?function\s+GET/i.test(content)) methods.push('GET');
  if (/export\s+(async\s+)?function\s+POST/i.test(content)) methods.push('POST');
  if (/export\s+(async\s+)?function\s+PUT/i.test(content)) methods.push('PUT');
  if (/export\s+(async\s+)?function\s+PATCH/i.test(content)) methods.push('PATCH');
  if (/export\s+(async\s+)?function\s+DELETE/i.test(content)) methods.push('DELETE');

  // Also check for const exports like: export const GET = ...
  if (/export\s+const\s+GET\s*=/i.test(content) && !methods.includes('GET')) methods.push('GET');
  if (/export\s+const\s+POST\s*=/i.test(content) && !methods.includes('POST')) methods.push('POST');
  if (/export\s+const\s+PUT\s*=/i.test(content) && !methods.includes('PUT')) methods.push('PUT');
  if (/export\s+const\s+PATCH\s*=/i.test(content) && !methods.includes('PATCH')) methods.push('PATCH');
  if (/export\s+const\s+DELETE\s*=/i.test(content) && !methods.includes('DELETE')) methods.push('DELETE');

  return methods;
}

// Get API path from file path
function getApiPath(filePath) {
  const relativePath = path.relative(API_DIR, filePath);
  const dirPath = path.dirname(relativePath);
  return '/api/' + dirPath.replace(/\\/g, '/');
}

// Check if route should be kept
function shouldKeepRoute(apiPath) {
  return KEEP_ROUTES.some(keepPath => {
    // Exact match or starts with (for nested routes)
    return apiPath === keepPath || apiPath.startsWith(keepPath + '/');
  });
}

// Check if file is already converted
function isAlreadyConverted(content) {
  return content.includes('createProxyHandlers') || content.includes('proxyToBackend');
}

// Find all route.ts files
function findRouteFiles(dir) {
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === 'route.ts') {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

// Main conversion
function main() {
  const routeFiles = findRouteFiles(API_DIR);

  let converted = 0;
  let skipped = 0;
  let alreadyDone = 0;

  console.log(`Found ${routeFiles.length} route files\n`);

  for (const filePath of routeFiles) {
    const apiPath = getApiPath(filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    // Skip routes that should stay
    if (shouldKeepRoute(apiPath)) {
      console.log(`SKIP (keep): ${apiPath}`);
      skipped++;
      continue;
    }

    // Skip already converted
    if (isAlreadyConverted(content)) {
      console.log(`SKIP (already converted): ${apiPath}`);
      alreadyDone++;
      continue;
    }

    // Parse methods
    const methods = parseRouteFile(content);

    if (methods.length === 0) {
      console.log(`SKIP (no methods found): ${apiPath}`);
      skipped++;
      continue;
    }

    // Generate new content
    const description = `${apiPath} Route`;
    const newContent = PROXY_TEMPLATE
      .replace('{{DESCRIPTION}}', description)
      .replace('{{METHODS}}', methods.join(', '));

    // Write file
    fs.writeFileSync(filePath, newContent);
    console.log(`CONVERTED: ${apiPath} (${methods.join(', ')})`);
    converted++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`Converted: ${converted}`);
  console.log(`Skipped (keep): ${skipped}`);
  console.log(`Already done: ${alreadyDone}`);
  console.log(`Total: ${routeFiles.length}`);
}

main();
