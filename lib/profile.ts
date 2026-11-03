import { getSupabase } from "./supabase";

export const PROFILE_NAME_CHANGED = "doppelkey:profile-name-changed";
export const NAME_RULES = "Use 2 to 24 letters, numbers, spaces or . _ - ', including at least one letter or number.";

export function validateUsername(value: string): string | null {
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length >= 2 && cleaned.length <= 24 &&
    /^[\p{L}\p{N} ._'\-]+$/u.test(cleaned) && /[\p{L}\p{N}]/u.test(cleaned)
    ? null : NAME_RULES;
}

export async function saveUsername(value: string, userId: string): Promise<string> {
  const invalid = validateUsername(value);
  if (invalid) throw new Error(invalid);
  const { data, error } = await getSupabase().rpc("set_display_name", { p_name: value });
  if (error) {
    if (error.code === "23505" || error.message.includes("username_taken")) {
      throw new Error("That username is already taken. Choose another (capitalization does not make it different).");
    }
    if (error.message.includes("invalid_name")) throw new Error(NAME_RULES);
    if (error.code === "28000" || error.code === "PGRST301") {
      throw new Error("Your session expired. Sign in again to save your username.");
    }
    throw new Error("Couldn't save your username. Please try again.");
  }
  if (typeof data !== "string") throw new Error("Couldn't confirm the saved username. Please try again.");
  window.dispatchEvent(new CustomEvent(PROFILE_NAME_CHANGED, { detail: { userId, name: data } }));
  return data;
}
