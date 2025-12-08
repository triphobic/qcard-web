/**
 * Backend API Proxy Utility
 *
 * Proxies requests from Next.js API routes to the backend API gateway.
 * This allows gradual migration from direct Supabase calls to backend services.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';

interface ProxyOptions {
  /** Override the target path (defaults to request path) */
  targetPath?: string;
  /** Additional headers to send */
  headers?: Record<string, string>;
  /** Whether to forward the request body */
  forwardBody?: boolean;
}

/**
 * Parse a Supabase auth cookie value (handles both base64 and JSON formats)
 */
function parseSupabaseCookie(value: string): { access_token?: string } | null {
  try {
    // Check if it's base64 encoded (Supabase SSR uses "base64-" prefix)
    if (value.startsWith('base64-')) {
      const base64Data = value.slice(7); // Remove "base64-" prefix
      const decoded = Buffer.from(base64Data, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    }
    // Try parsing as regular JSON
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Extract the project reference from a Supabase URL
 * e.g., "https://abcdefgh.supabase.co" -> "abcdefgh"
 */
function getSupabaseProjectRef(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const url = new URL(supabaseUrl);
    // Extract project ref from hostname (e.g., "abcdefgh.supabase.co" -> "abcdefgh")
    const hostParts = url.hostname.split('.');
    if (hostParts.length >= 1) {
      return hostParts[0];
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Reassemble chunked Supabase cookies
 * Supabase splits large tokens across multiple cookies: name.0, name.1, etc.
 */
function reassembleChunkedCookie(
  allCookies: { name: string; value: string }[],
  baseName: string
): string | null {
  // Find all chunks for this cookie
  const chunks: { index: number; value: string }[] = [];

  for (const cookie of allCookies) {
    // Match pattern: baseName.0, baseName.1, etc.
    const match = cookie.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\d+)$`));
    if (match) {
      chunks.push({ index: parseInt(match[1], 10), value: cookie.value });
    }
  }

  if (chunks.length === 0) {
    return null;
  }

  // Sort by index and concatenate
  chunks.sort((a, b) => a.index - b.index);
  return chunks.map(c => c.value).join('');
}

/**
 * Get the access token from the request cookies or Authorization header
 */
async function getAccessToken(request: NextRequest): Promise<string | null> {
  // Try Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Try cookies
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  const accessToken = cookieStore.get('sb-access-token')?.value;
  if (accessToken) {
    return accessToken;
  }

  // Try Supabase auth cookie format with dynamic project ref
  const projectRef = getSupabaseProjectRef();
  if (projectRef) {
    const cookieName = `sb-${projectRef}-auth-token`;

    // First try non-chunked cookie
    const supabaseAuth = cookieStore.get(cookieName)?.value;
    if (supabaseAuth) {
      try {
        const parsed = parseSupabaseCookie(supabaseAuth);
        if (parsed?.access_token) return parsed.access_token;
      } catch {
        // Continue to try chunked
      }
    }

    // Try chunked cookies (name.0, name.1, etc.)
    const chunkedValue = reassembleChunkedCookie(allCookies, cookieName);
    if (chunkedValue) {
      try {
        const parsed = parseSupabaseCookie(chunkedValue);
        if (parsed?.access_token) return parsed.access_token;
      } catch {
        // Continue to fallback
      }
    }
  }

  // Fallback: search for any sb-*-auth-token cookie (chunked or not)
  // First, find all unique base names
  const baseNames = new Set<string>();
  for (const cookie of allCookies) {
    // Match sb-*-auth-token or sb-*-auth-token.N
    const match = cookie.name.match(/^(sb-[^.]+?-auth-token)(?:\.\d+)?$/);
    if (match) {
      baseNames.add(match[1]);
    }
  }

  for (const baseName of baseNames) {
    // Try non-chunked first
    const singleCookie = allCookies.find(c => c.name === baseName);
    if (singleCookie) {
      try {
        const parsed = parseSupabaseCookie(singleCookie.value);
        if (parsed?.access_token) return parsed.access_token;
      } catch {
        // Continue
      }
    }

    // Try chunked
    const chunkedValue = reassembleChunkedCookie(allCookies, baseName);
    if (chunkedValue) {
      try {
        const parsed = parseSupabaseCookie(chunkedValue);
        if (parsed?.access_token) return parsed.access_token;
      } catch {
        // Continue
      }
    }
  }

  return null;
}

/**
 * Proxy a request to the backend API gateway
 */
export async function proxyToBackend(
  request: NextRequest,
  options: ProxyOptions = {}
): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  try {
    const { targetPath, headers: additionalHeaders = {}, forwardBody = true } = options;

    // Determine target URL
    const url = new URL(request.url);
    const path = targetPath || url.pathname;
    const targetUrl = `${API_URL}${path}${url.search}`;

    // Get access token
    const accessToken = await getAccessToken(request);

    console.log(`[Proxy ${requestId}] ${request.method} ${path} -> ${targetUrl}`);
    console.log(`[Proxy ${requestId}] Has token: ${!!accessToken}, API_URL: ${API_URL}`);

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Forward request
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    };

    // Forward body for non-GET requests
    if (forwardBody && request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const body = await request.text();
        if (body) {
          fetchOptions.body = body;
        }
      } catch {
        // No body to forward
      }
    }

    const response = await fetch(targetUrl, fetchOptions);
    const duration = Date.now() - startTime;

    // Get response body
    const responseText = await response.text();
    let responseBody: unknown;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }

    console.log(`[Proxy ${requestId}] Response: ${response.status} (${duration}ms)`);

    // Log error responses for debugging
    if (response.status >= 400) {
      console.error(`[Proxy ${requestId}] Error response:`, responseText.substring(0, 500));
    }

    // Return response with same status
    return NextResponse.json(responseBody, {
      status: response.status,
      headers: {
        'X-Proxied-From': 'next-api',
        'X-Backend-Status': String(response.status),
        'X-Proxy-Duration': String(duration),
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Proxy ${requestId}] Fatal error after ${duration}ms:`, error);
    return NextResponse.json(
      { error: 'Failed to proxy request to backend', details: String(error) },
      { status: 502 }
    );
  }
}

/**
 * Create a simple proxy handler for a route
 * Usage: export const GET = createProxyHandler();
 */
export function createProxyHandler(options: ProxyOptions = {}) {
  return async (request: NextRequest) => proxyToBackend(request, options);
}

/**
 * Create proxy handlers for all methods
 * Usage: export const { GET, POST, PATCH, DELETE } = createProxyHandlers();
 */
export function createProxyHandlers(options: ProxyOptions = {}) {
  const handler = (request: NextRequest) => proxyToBackend(request, options);
  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    PATCH: handler,
    DELETE: handler,
  };
}
