require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: recentPhotos, error: errP } = await supabase.from("photos").select("id, path, created_at").order('created_at', { ascending: false }).limit(3);
  console.log("RECENT PHOTOS:", recentPhotos, errP);
  
  const { data: recentFaces, error: errF } = await supabase.from("face_embeddings").select("id, photo_id, cluster_id, created_at").order('created_at', { ascending: false }).limit(5);
  console.log("RECENT FACES:", recentFaces, errF);

  const { data: clusterCount, count, error: errC } = await supabase.from("face_clusters").select("*", { count: 'exact', head: true });
  console.log("TOTAL CLUSTERS:", count, errC);
}

check();
