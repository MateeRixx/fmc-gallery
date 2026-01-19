// lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast during server start / build if env is missing
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.');
}

/**
 * Client-side Supabase instance.
 * Use this in React components and pages (browser).
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
