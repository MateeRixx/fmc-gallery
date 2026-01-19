// lib/events.ts
import { supabase } from "@/lib/supabaseClient";

export async function createEvent(name: string, description = "") {
  const { error } = await supabase
    .from("events")
    .insert({ name, description });

  if (error) throw error;
}
