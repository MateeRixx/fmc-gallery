require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: users, error: errU } = await supabase.from("users").select("id, email").limit(5);
  console.log("USERS:", users, errU);
  
  const { data: clusters, error: errC } = await supabase.from("face_clusters").select("id, user_id").limit(5);
  console.log("CLUSTERS:", clusters, errC);
}

check();
