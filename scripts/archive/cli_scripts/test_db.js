const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: profiles, error: pErr } = await supabase.from('visitor_profiles').select('*');
  console.log('Profiles:', profiles, pErr);

  if (profiles && profiles.length > 0) {
    const { data: matches, error: mErr } = await supabase.from('user_photo_matches').select('*').eq('visitor_profile_id', profiles[0].id);
    console.log(`Matches for ${profiles[0].id}:`, matches, mErr);
  }

  const { data: faces, error: fErr } = await supabase.from('face_embeddings').select('id, aws_face_id').limit(5);
  console.log('Faces (embeddings):', faces, fErr);
}
run();
