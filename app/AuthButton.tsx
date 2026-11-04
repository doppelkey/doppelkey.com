"use client";

import { useEffect, useState } from "react";
import { getSupabase, type MyStats } from "@/lib/supabase";
import { openAuthOverlay } from "@/lib/auth-overlay";
import { useAuth } from "@/lib/useAuth";
import { PROFILE_NAME_CHANGED } from "@/lib/profile";

export default function AuthButton() {
  const { ready, session } = useAuth();
  const [profile, setProfile] = useState<{ userId: string; name: string | null } | null>(null);
  const userId = session?.user.id;
  const name = profile?.userId === userId ? profile?.name : null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getSupabase()
      .rpc("my_stats")
      .then(({ data }) => {
        if (!cancelled) setProfile({ userId, name: (data as MyStats | null)?.display_name ?? null });
      });
    const onNameChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; name: string }>).detail;
      if (detail.userId === userId) {
        cancelled = true; // Ignore an older in-flight stats response.
        setProfile({ userId, name: detail.name });
      }
    };
    window.addEventListener(PROFILE_NAME_CHANGED, onNameChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_NAME_CHANGED, onNameChanged);
    };
  }, [userId]);

  if (!ready) return null;

  if (!session) {
    return (
      <>
        <button
          className="button button-small button-outline"
          type="button"
          onClick={() => openAuthOverlay("signin")}
        >
          Sign in
        </button>
        <button
          className="button button-small"
          type="button"
          onClick={() => openAuthOverlay("signup")}
        >
          Sign up
        </button>
      </>
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
