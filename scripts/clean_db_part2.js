const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function clean() {
  console.log("Wiping dummy data part 2...");

  // Delete all users whose role is NULL or normal member/visitor/inactive
  const { data: usersToDelete, error: selErr } = await supabase
    .from('users')
    .select('id, email')
    .or('role.is.null,role.eq.member,role.eq.visitor,role.eq.inactive');
  
  if (usersToDelete && usersToDelete.length > 0) {
    const ids = usersToDelete.map(u => u.id);
    const { error: e1 } = await supabase.from('users').delete().in('id', ids);
    console.log(`Deleted ${ids.length} non-head users (role=null/member/visitor)`, e1);
  } else {
    console.log("No null/member users found to delete.");
  }
  
  const { error: e2 } = await supabase.from('invitations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("Cleared old invitations", e2);
  
  // Let's ensure otp codes are completely clear
  const { error: e3 } = await supabase.from('otp_codes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("Cleared old otp_codes", e3);
}

clean();
