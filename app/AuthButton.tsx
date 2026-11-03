"use client";

import { useEffect, useState } from "react";
import { getSupabase, signInWithGoogle, type MyStats } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";

export default function AuthButton() {
  const { ready, session } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getSupabase()
      .rpc("my_stats")
      .then(({ data }) => {
        if (!cancelled) setName((data as MyStats | null)?.display_name ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!ready) return null;

  if (!session) {
    return (
      <button
        className="button button-small button-outline"
        type="button"
        onClick={() => signInWithGoogle()}
      >
        Sign in
      </button>
    );
  }

  return (
    <>
      <a href="/account">Account</a>
      <button
        className="button button-small button-outline"
        type="button"
        onClick={() => getSupabase().auth.signOut()}
        title="Sign out"
      >
        {name && <span className="auth-name">{name} · </span>}Sign out
      </button>
    </>
  );
}
