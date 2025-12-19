export const revalidate = 0;
export const runtime = "nodejs";

import AdminContent from "./AdminContent";
import { getSupabaseServer } from "@/app/events/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

export default async function AdminPage() {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("events")
    .select("id, name")
    .order("id", { ascending: true });
  const events = data || [];
  return <AdminContent events={events} />;
}
