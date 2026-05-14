import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_POS_SUPABASE_URL || "https://ihqknqvnkjgcdtcsiwed.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_POS_SUPABASE_ANON_KEY || "sb_publishable_i1g9-5I3yhXT6OLA92tbew_79zOIxd9";
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
