export const revalidate = 0;
export const runtime = "nodejs";

import AdminContent from "./AdminContent";
import { createClient } from "@supabase/supabase-js";

export default async function AdminPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data } = await supabase
    .from("events")
    .select("id, name")
    .order("id", { ascending: true });
  const events = data || [];
  return <AdminContent events={events} />;
}
