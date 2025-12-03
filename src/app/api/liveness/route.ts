import { NextResponse } from 'next/server';

// Simple liveness check - just confirms the server is running
// Does NOT check database or external dependencies
export async function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
