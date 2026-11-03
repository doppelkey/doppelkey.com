"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AuthButton from "../AuthButton";
import { getSupabase, signInWithGoogle, type MyStats } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";

export default function Account() {
  const { ready, session } = useAuth();
  const user = session?.user;
  const userId = user?.id;
  const [stats, setStats] = useState<MyStats | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [message, setMessage] = useState("");
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

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    getSupabase()
      .rpc("set_display_name", { p_name: nameDraft })
      .then(({ error }) => {
        if (error) {
          setMessage("Use 2 to 24 letters, numbers, spaces or . _ - '");
          return;
        }
        setMessage("Saved.");
        loadStats();
      });
  };

  const initial = (stats?.display_name ?? user?.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="page-shell" id="top">
      <section className="game-section">
        <header className="site-header">
          <Link className="brand" href="/">
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
                <div>
                  <p className="account-name">{stats?.display_name ?? "Loading"}</p>
                  {user?.email && <p className="account-email">{user.email}</p>}
                </div>
              </div>

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

              <form className="leaderboard-name-form" onSubmit={saveName}>
                <label htmlFor="account-name">Username</label>
                <input
                  id="account-name"
                  value={nameDraft}
                  maxLength={24}
                  onChange={(event) => setNameDraft(event.target.value)}
                />
                <button className="button button-small" type="submit">
                  Save
                </button>
                {message && <span>{message}</span>}
              </form>
              <p className="leaderboard-sub">
                Only your username, rank, score and word count are shown on the public leaderboard. Your
                picture and email stay private.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
