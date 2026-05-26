const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function sanitize(u) { return (u || "").trim().replace(/\)+$/, ""); }

async function run() {
  const { data: dbPhotos } = await supabase.from('photos').select('id, path').limit(50);
  
  let mismatches = dbPhotos.filter(p => p.path !== sanitize(p.path));
  console.log("Mismatches between DB and Sanitize:\n", mismatches);
}
run();
