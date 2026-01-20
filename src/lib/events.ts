// lib/events.ts
import { supabase } from "@/lib/supabaseClient";

export async function createEvent(title: string, description = "") {
  const { error } = await supabase
    .from("events")
    .insert({ title, description });

  if (error) throw error;
}
