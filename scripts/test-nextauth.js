import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from("users").select("*").limit(1);
  console.log("public.users:", !error);
  // test next_auth.users
  const { error: err2 } = await supabase.schema("next_auth").from("users").select("*").limit(1);
  console.log("next_auth.users:", !err2 ? "exists" : err2.message);
}
run();
