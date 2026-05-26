import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  for (const r of ['co-head', 'co_head', 'executive', 'member', 'inactive', 'HEAD']) {
    const res = await supabase.from('users').insert({id: crypto.randomUUID(), email: r+'3@x.com', role: r, full_name: 'Test', user_type: 'ADMIN'});
    if (!res.error) console.log('SUCCESS:', r);
    else console.log('FAIL:', r, res.error.message);
  }
}
run();
