const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function clean() {
  console.log("Wiping dummy data...");
  const { error: e1 } = await supabase.from('visitor_profiles').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
  console.log("visitor_profiles cleaned", e1);

  const { error: e2 } = await supabase.from('face_clusters').delete().neq('id', 0);
  console.log("face_clusters cleaned", e2);

  const { error: e3 } = await supabase.from('otp_codes').delete().neq('id', 0);
  console.log("otp_codes cleaned", e3);

  const { error: e4 } = await supabase.from('users').delete().eq('role', 'member');
  console.log("member users cleaned", e4);

  const { error: e5 } = await supabase.from('users').delete().eq('role', 'visitor');
  console.log("visitor users cleaned", e5);
}

clean();
