"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AuthButton from "../AuthButton";
import { getSupabase, signInWithGoogle, type MyStats } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { NAME_RULES, saveUsername } from "@/lib/profile";

export default function Account() {
  const { ready, session } = useAuth();
  const user = session?.user;
  const userId = user?.id;
  const [stats, setStats] = useState<MyStats | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // The profile picture is the one Google sent at sign-in, kept in the user's
  // Supabase auth profile. Nothing extra is stored or made public.
  const meta = user?.user_metadata as { avatar_url?: string; picture?: string } | undefined;
  const avatarUrl = meta?.avatar_url ?? meta?.picture ?? null;

  const loadStats = useCallback(() => {
    getSupabase()
      .rpc("my_stats")
      .then(({ data }) => {
        const next = (data as MyStats | null) ?? null;
        setStats(next);
        if (next?.display_name) setNameDraft(next.display_name);
      });
  }, []);

  useEffect(() => {
    if (userId) loadStats();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears data on sign-out
    else setStats(null);
  }, [userId, loadStats]);

  const cancelEdit = () => {
    setNameDraft(stats?.display_name ?? "");
    setEditing(false);
    setMessage("");
  };

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId || saving) return;
    setSaving(true);
    setMessage("");
    setSaveError(false);
    try {
      const name = await saveUsername(nameDraft, userId);
      setStats((current) => current ? { ...current, display_name: name } : current);
      setNameDraft(name);
      setEditing(false);
      setMessage("Username saved.");
    } catch (error) {
      setSaveError(true);
      setMessage(error instanceof Error ? error.message : "Couldn't save your username. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const initial = (stats?.display_name ?? user?.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="page-shell" id="top">
      <section className="game-section">
        <header className="site-header">
          <Link className="brand" href="/">
            <img src="/doppelkey-icon.svg" alt="" className="brand-icon" />
            Doppelkey
          </Link>
          <nav className="main-nav">
            <Link href="/#how-it-works">How to play</Link>
            <Link href="/leaderboard">Leaderboard</Link>
            <AuthButton />
            <Link className="button button-small" href="/game">
              Play
            </Link>
          </nav>
        </header>
        <div className="content-wrap leaderboard-section">
          {ready && !session && (
            <p className="leaderboard-sub">
              <button className="link-button" type="button" onClick={() => signInWithGoogle()}>
                Sign in with Google
              </button>{" "}
              to see your account.
            </p>
          )}

          {session && (
            <>
              <div className="account-card">
                {avatarUrl && !avatarFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external Google avatar
                  <img
                    className="account-avatar"
                    src={avatarUrl}
                    alt="Your profile picture"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <div className="account-avatar account-avatar-fallback" aria-hidden="true">
                    {initial}
                  </div>
                )}
                <div className="account-details">
                  <div className="account-name-row">
                    <p className="account-name">{stats?.display_name ?? "Loading"}</p>
                    {stats && !editing && <button className="account-edit-button" type="button" aria-label="Edit username" aria-expanded={editing} onClick={() => {
                      setNameDraft(stats.display_name ?? "");
                      setMessage("");
                      setSaveError(false);
                      setEditing(true);
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- local SVG icon */}
                      <img src="/edit.svg" width="24" height="24" alt="" />
                    </button>}
                  </div>

                  {user?.email && <p className="account-email">{user.email}</p>}
                </div>
              </div>

              {editing && (
                <div className="account-editor">
                    <form className="account-edit-form" onSubmit={saveName} onKeyDown={(event) => {
                      if (event.key === "Escape" && !saving) cancelEdit();
                    }}>
                      <label htmlFor="account-name">Username</label>
                      <div className="account-edit-controls">
                      <input id="account-name" value={nameDraft} maxLength={24} autoFocus
                        autoComplete="nickname" disabled={saving} aria-describedby="username-rules username-message"
                        aria-invalid={saveError} onChange={(event) => {
                          setNameDraft(event.target.value);
                          setSaveError(false);
                          setMessage("");
                        }} />
                      <div className="account-edit-actions">
                        <button className="button button-small" type="submit" disabled={saving}>
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button className="button button-small button-outline" type="button" disabled={saving} onClick={cancelEdit}>Cancel</button>
                      </div>
                      </div>
                      <p className="account-help" id="username-rules">{NAME_RULES} Usernames are unique, ignoring capitalization.</p>
                    </form>
                </div>
              )}
              <p id="username-message" className={saveError ? "account-message account-error" : "account-message"} role={saveError ? "alert" : "status"}>{message}</p>

              {stats && (
                <div className="leaderboard-stats">
                  <p>
                    <strong>{stats.current_streak}</strong>Current streak
                  </p>
                  <p>
                    <strong>{stats.longest_streak}</strong>Longest streak
                  </p>
                  <p>
                    <strong>{stats.best_score}</strong>Best score
                  </p>
                  <p>
                    <strong>{stats.days_played}</strong>Days played
                  </p>
                </div>
              )}


            </>
          )}
        </div>
      </section>
    </div>
  );
}
