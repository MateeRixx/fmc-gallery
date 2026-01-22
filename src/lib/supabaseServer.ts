import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    throw new Error(`Supabase environment variables are missing: URL=${!!url}, ANON_KEY=${!!anonKey}`);
  }
  
  const cookieStore = await cookies();
  
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookies) => cookies.forEach(c => cookieStore.set(c.name, c.value))
    }
  });
  
  return client;
}
