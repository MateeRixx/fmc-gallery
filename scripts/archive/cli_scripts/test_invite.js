require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function test() {
  const { data: existingUser } = await supabase.from("users").select("id").eq("email", "fake123@gmail.com").maybeSingle();
  console.log("existingUser for fake123@gmail.com:", existingUser);
  const { data: existingUser2 } = await supabase.from("users").select("id").eq("email", "mohitkumar2512@gmail.com").maybeSingle();
  console.log("existingUser for mohitkumar2512@gmail.com:", existingUser2);
  const { data: existingUser3 } = await supabase.from("users").select("id").eq("email", "23it3028@rgipt.ac.in").maybeSingle();
  console.log("existingUser for 23it3028@rgipt.ac.in:", existingUser3);
}

test();
