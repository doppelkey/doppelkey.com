// Loads public/wordlist.txt into public.dictionary through the Supabase
// Management API. Needs SUPABASE_ACCESS_TOKEN (never commit it) and
// SUPABASE_PROJECT_REF. Safe to re-run.
import { readFileSync } from "node:fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) throw new Error("Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF");

const words = readFileSync(new URL("../public/wordlist.txt", import.meta.url), "utf8")
  .split("\n")
  .map((w) => w.trim())
  .filter((w) => /^[a-z]{4,}$/.test(w));

const CHUNK = 20000;
for (let i = 0; i < words.length; i += CHUNK) {
  const values = words.slice(i, i + CHUNK).map((w) => `('${w}')`).join(",");
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: `insert into public.dictionary (word) values ${values} on conflict do nothing;` }),
  });
  if (!res.ok) throw new Error(`chunk ${i}: HTTP ${res.status} ${await res.text()}`);
  console.log(`loaded ${Math.min(i + CHUNK, words.length)} / ${words.length}`);
}
