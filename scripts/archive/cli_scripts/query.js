require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('user_photo_matches').select('similarity_score, photos!inner(id, path, events!inner(id, title))').eq('visitor_profile_id', 'fedac796-57d2-4ff6-b865-215765c7d834').order('similarity_score', { ascending: false }).then(res => console.log(JSON.stringify(res.data, null, 2)));
