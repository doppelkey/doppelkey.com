import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Both values are public by design: the project URL and the publishable key
// ship to every browser. Row-level security and the database functions decide
// what a signed-in or anonymous visitor can do. Never put a secret key here.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://wpzaulezyuokvtboqlvv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_3_DWsQr7Ay6AaeCTPeN0sA_wMrmmCpW";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { flowType: "pkce", detectSessionInUrl: true },
    });
  }
  return client;
}

export type RankedRound = {
  id: string;
  day: string;
  digits: string;
  status: "started" | "finished" | "expired" | "rejected";
  started_at: string;
  deadline: string;
  server_now: string;
  score: number;
  words: string[];
  word_count: number;
};

export type MyStats = {
  current_streak: number;
  longest_streak: number;
  days_played: number;
  best_score: number;
  played_today: boolean;
  display_name: string | null;
};

export function signInWithGoogle() {
  return getSupabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
  });
}
