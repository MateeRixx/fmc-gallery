const { createClient } = require("@supabase/supabase-js");

async function check() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, key);

  // Imagine the request for someone not in DB
  const { data: existingUser } = await supabase
      .from("invitations")
      .select("id")
      .eq("email", "mohitkumar2512@gmail.com")
      .maybeSingle();
      
  console.log("Existing for mohitkumar2512@gmail.com:", existingUser ? "EXISTS" : "NOT EXISTS");
}

check();
