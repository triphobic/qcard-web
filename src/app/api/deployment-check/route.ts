import { NextResponse } from 'next/server';

// Force dynamic to ensure this is not cached
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    deploymentVersion: '2024-11-16-21:15-PST',
    buildInfo: {
      message: 'If you see this exact timestamp, the NEW code is deployed',
      deletedFiles: [
        'supabase-client-auth.ts - DELETED',
        'supabase-client-simple.ts - DELETED'
      ],
      newFiles: [
        'supabase-browser.ts - NEW with runtime config'
      ],
      expectedLogs: [
        'Should see: [Supabase Browser] logs',
        'Should NOT see: [Supabase Client] logs',
        'Should NOT see: placeholder.supabase.co'
      ]
    },
    timestamp: new Date().toISOString()
  });
}