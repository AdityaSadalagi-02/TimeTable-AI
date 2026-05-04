import { createClient } from "@supabase/supabase-js";

// Replace these with your actual Project URL and Anon Key from your Supabase Dashboard Settings
const supabaseUrl = "https://wxotepnidoehjtiyuwow.supabase.co";
const supabaseKey = "sb_publishable_QHAEh1Qzf7OCnQjDUtkwmA_h5ebO9Zq";

export const supabase = createClient(supabaseUrl, supabaseKey);
