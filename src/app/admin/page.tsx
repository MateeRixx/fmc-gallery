export const revalidate = 0;
export const runtime = "nodejs";

import AdminContent from "./AdminContent";
import { getSupabaseServer } from "@/lib/supabaseServer";

export default async function AdminPage() {
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from("events")
      .select("id, title, slug")
      .order("id", { ascending: true });
    
    if (error) {
      console.error("Failed to fetch events:", error);
      return <AdminContent events={[]} />;
    }
    
    const events = data || [];
    return <AdminContent events={events} />;
  } catch (err) {
    console.error("Admin page error:", err);
    // Return empty events - AdminContent will handle auth check
    return <AdminContent events={[]} />;
  }
}
