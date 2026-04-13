import { createClient } from "@supabase/supabase-js";

// Replace these with your actual Project URL and Anon Key from your Supabase Dashboard Settings
const supabaseUrl = "https://wxotepnidoehjtiyuwow.supabase.co";
const supabaseKey = "sb_publishable_ynqf6TNPBey69ddzO3aUPQ_K_A0KVBS";

export const supabase = createClient(supabaseUrl, supabaseKey);

// Akash's API
// const genAI = new GoogleGenerativeAI("AIzaSyC8wavSBXW4dcx6NruQSDO-1LLymrqwxhU");

// Aditya S's API

// const genAI = new GoogleGenerativeAI("AIzaSyB2d6sybRJ_xe4LH7YD4-eb4Qdsim5-iyM");
