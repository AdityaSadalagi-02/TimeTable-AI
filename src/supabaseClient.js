import { createClient } from "@supabase/supabase-js";

// Replace these with your actual Project URL and Anon Key from your Supabase Dashboard Settings
const supabaseUrl = "https://wxotepnidoehjtiyuwow.supabase.co";
const supabaseKey = "sb_publishable_ynqf6TNPBey69ddzO3aUPQ_K_A0KVBS";

export const supabase = createClient(supabaseUrl, supabaseKey);