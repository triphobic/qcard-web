'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Official Supabase Browser Client with Runtime Configuration
 * Based on Supabase's recommended pattern with runtime config loading
 */

// Runtime configuration
let runtimeConfig: { supabaseUrl?: string; supabaseAnonKey?: string } | null = null;
let configPromise: Promise<void> | null = null;
let supabaseInstance: SupabaseClient | null = null;

// Load runtime configuration from server
async function loadConfig() {
  if (runtimeConfig) return;
  if (configPromise) return configPromise;

  console.log('[Supabase Browser] Fetching config from /api/config...');

  configPromise = fetch('/api/config')
    .then(res => res.json())
    .then(config => {
      console.log('[Supabase Browser] Config loaded:', {
        hasUrl: !!config.supabaseUrl,
        hasKey: !!config.supabaseAnonKey,
        url: config.supabaseUrl,
      });
      runtimeConfig = config;
    })
    .catch(err => {
      console.error('[Supabase Browser] Failed to load config:', err);
      throw err;
    });

  return configPromise;
}

/**
 * Get or create Supabase browser client
 * Must be called after config is loaded
 */
export async function getSupabaseBrowser(): Promise<SupabaseClient> {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Load config first
  await loadConfig();

  if (!runtimeConfig?.supabaseUrl || !runtimeConfig?.supabaseAnonKey) {
    throw new Error('Supabase configuration not available');
  }

  console.log('[Supabase Browser] Creating client with URL:', runtimeConfig.supabaseUrl);

  // Use official createBrowserClient from @supabase/ssr
  supabaseInstance = createBrowserClient(
    runtimeConfig.supabaseUrl,
    runtimeConfig.supabaseAnonKey
  );

  console.log('[Supabase Browser] Client created successfully');
  return supabaseInstance;
}

// Start loading config immediately when module is imported
if (typeof window !== 'undefined') {
  console.log('🔵 SUPABASE-BROWSER v2.0 - Using official @supabase/ssr with runtime config');
  loadConfig().catch(err => console.error('[Supabase Browser] Config load failed:', err));
}
