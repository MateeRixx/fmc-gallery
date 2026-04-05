const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
fetch(`${url}/rest/v1/face_clusters?select=id,user_id&limit=1`, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`
  }
}).then(r => r.json()).then(d => console.log("DB RESULT:", d)).catch(console.error);
