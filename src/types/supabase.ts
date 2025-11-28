/**
 * Supabase Database Types
 *
 * This file contains TypeScript types for the Supabase database schema.
 *
 * To regenerate this file with the latest schema:
 * npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts
 *
 * For now, we use a simplified Database type that works with Supabase Auth.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
      }
    }
    Views: {
      [key: string]: {
        Row: Record<string, any>
      }
    }
    Functions: {
      [key: string]: any
    }
    Enums: {
      [key: string]: string
    }
  }
}

// You can regenerate precise types with:
// npx supabase gen types typescript --project-id <your-project-id>
