/**
 * Simplified Supabase Client with Runtime Configuration
 * This version ensures config is always loaded before use
 */

'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Runtime configuration
let runtimeConfig: { supabaseUrl?: string; supabaseAnonKey?: string } | null = null;
let configPromise: Promise<void> | null = null;
let supabaseInstance: SupabaseClient | null = null;

// Load runtime configuration from server
async function loadConfig() {
  if (runtimeConfig) return;
  if (configPromise) return configPromise;

  console.log('[Supabase] Fetching config from /api/config...');

  configPromise = fetch('/api/config')
    .then(res => res.json())
    .then(config => {
      console.log('[Supabase] Config loaded:', {
        hasUrl: !!config.supabaseUrl,
        hasKey: !!config.supabaseAnonKey,
        url: config.supabaseUrl,
      });
      runtimeConfig = config;
    })
    .catch(err => {
      console.error('[Supabase] Failed to load config:', err);
      throw err;
    });

  return configPromise;
}

// Get or create Supabase client
export async function getSupabase(): Promise<SupabaseClient> {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Load config first
  await loadConfig();

  if (!runtimeConfig?.supabaseUrl || !runtimeConfig?.supabaseAnonKey) {
    throw new Error('Supabase configuration not available');
  }

  console.log('[Supabase] Creating client with URL:', runtimeConfig.supabaseUrl);

  supabaseInstance = createClient(
    runtimeConfig.supabaseUrl,
    runtimeConfig.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    }
  );

  console.log('[Supabase] Client created successfully');
  return supabaseInstance;
}

// Start loading config immediately
if (typeof window !== 'undefined') {
  loadConfig().catch(err => console.error('[Supabase] Config load failed:', err));
}
