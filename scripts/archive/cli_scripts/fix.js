require('dotenv').config({path: '.env.local'}); 
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('query_db_execute', { sql: 'ALTER TABLE public.user_photo_matches ALTER COLUMN similarity_score TYPE FLOAT;' });
  console.log('rpc executed', error);
}
run();
