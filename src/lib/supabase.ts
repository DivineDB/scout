import { createClient } from "@supabase/supabase-js";

// Make sure to add these to your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Client for authenticated / public operations (if we have RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for server-side trusted operations (e.g., our pipeline)
// Only use this server-side!
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : supabase;
