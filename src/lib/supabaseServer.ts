import { createClient } from "@supabase/supabase-js";

export function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log("getSupabaseServer called with:");
  console.log("  URL exists:", !!url);
  console.log("  Service role key exists:", !!key);
  console.log("  Key starts with 'eyJ':", key?.startsWith("eyJ"));
  
  if (!url || !key) {
    throw new Error(`Supabase environment variables are missing: URL=${!!url}, KEY=${!!key}`);
  }
  
  const client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  console.log("✓ Supabase server client initialized with service role key");
  return client;
}
