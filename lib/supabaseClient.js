import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Browser Supabase client.
 * Returns null when env vars aren't set so the app still runs on
 * demo data without crashing. Once you add the two env vars in Vercel
 * (and locally in .env.local), this becomes a live client.
 */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseReady = Boolean(supabase);
