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
  const accessToken = cookieStore.get('sb-access-token')?.value;
  if (accessToken) {
    return accessToken;
  }

  // Try Supabase auth cookie format
  const supabaseAuth = cookieStore.get('sb-zcpoepdmjhewkspfwhwn-auth-token')?.value;
  if (supabaseAuth) {
    try {
      const parsed = JSON.parse(supabaseAuth);
      return parsed.access_token || null;
    } catch {
      return null;
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
  try {
    const { targetPath, headers: additionalHeaders = {}, forwardBody = true } = options;

    // Determine target URL
    const url = new URL(request.url);
    const path = targetPath || url.pathname;
    const targetUrl = `${API_URL}${path}${url.search}`;

    // Get access token
    const accessToken = await getAccessToken(request);

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

    // Get response body
    const responseText = await response.text();
    let responseBody: unknown;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }

    // Return response with same status
    return NextResponse.json(responseBody, {
      status: response.status,
      headers: {
        'X-Proxied-From': 'next-api',
        'X-Backend-Status': String(response.status),
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to backend' },
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
