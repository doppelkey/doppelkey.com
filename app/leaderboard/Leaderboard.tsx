"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AuthButton from "../AuthButton";
import { getSupabase, signInWithGoogle, type MyStats } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";

type Row = {
  rank: number;
  display_name: string;
  score: number;
  word_count: number;
  is_me: boolean;
};

// Days are IST days, matching the server.
function istToday() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function shiftDay(day: string, delta: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function dayLabel(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function Leaderboard() {
  const { ready, session } = useAuth();
  const userId = session?.user.id;
  const [today, setToday] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState<MyStats | null>(null);

  useEffect(() => {
    // Computed after mount so the server prerender does not bake in a day.
    const frame = requestAnimationFrame(() => {
      const current = istToday();
      setToday(current);
      setDay(current);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!day) return;
    let cancelled = false;
    getSupabase()
      .rpc("get_leaderboard", { p_day: day, p_limit: 50 })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return;
        if (rpcError) {
          setError(true);
          setRows(null);
          return;
        }
        setError(false);
        setRows(data as Row[]);
      });
    return () => {
      cancelled = true;
    };
  }, [day, userId]);

  const loadStats = useCallback(() => {
    getSupabase()
      .rpc("my_stats")
      .then(({ data }) => {
        const next = (data as MyStats | null) ?? null;
        setStats(next);
      });
  }, []);

  useEffect(() => {
    if (userId) loadStats();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears data on sign-out
    else setStats(null);
  }, [userId, loadStats]);


  return (
    <div className="page-shell" id="top">
      <section className="game-section">
        <header className="site-header">
          <Link className="brand" href="/">
            Doppelkey
          </Link>
          <nav className="main-nav">
            <Link href="/#how-it-works">How to play</Link>
            <Link href="/#about">About</Link>
            <AuthButton />
            <Link className="button button-small" href="/game">
              Play
            </Link>
          </nav>
        </header>
        <div className="content-wrap leaderboard-section">
          <p className="eyebrow">DAILY LEADERBOARD</p>
          <h1 className="leaderboard-title">{day ? dayLabel(day) : "Loading"}</h1>
          <p className="leaderboard-sub">
            Ranked scores only, one attempt per player. The board resets at midnight IST.
          </p>
          <div className="leaderboard-days">
            <button
              className="button button-small button-outline"
              type="button"
              disabled={!day}
              onClick={() => day && setDay(shiftDay(day, -1))}
            >
              Previous day
            </button>
            <button
              className="button button-small button-outline"
              type="button"
              disabled={!day || !today || day >= today}
              onClick={() => day && today && setDay(shiftDay(day, 1))}
            >
              Next day
            </button>
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

          {stats && (
            <p className="leaderboard-sub">
              <Link href="/account">Your account</Link>
            </p>
          )}

          {error && <p className="leaderboard-empty">Couldn&apos;t load the leaderboard. Try again in a moment.</p>}
          {!error && rows && rows.length === 0 && (
            <p className="leaderboard-empty">No ranked scores for this day yet.</p>
          )}
          {!error && rows && rows.length > 0 && (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th className="num">Words</th>
                  <th className="num">Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className={row.is_me ? "me-row" : undefined} key={`${row.rank}-${row.display_name}-${row.is_me}`}>
                    <td>{row.rank}</td>
                    <td>{row.display_name}</td>
                    <td className="num">{row.word_count}</td>
                    <td className="num">{row.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {ready && !session && (
            <p className="leaderboard-sub">
              <button className="link-button" type="button" onClick={() => signInWithGoogle()}>
                Sign in with Google
              </button>{" "}
              to play ranked rounds and appear here.
            </p>
          )}

        </div>
      </section>
    </div>
  );
}
