"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthButton from "../AuthButton";
import {
  getSupabase,
  signInWithGoogle,
  type MyStats,
  type RankedRound,
} from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";

const KEYS: [string, string][] = [
  ["1", ""],
  ["2", "ABC"],
  ["3", "DEF"],
  ["4", "GHI"],
  ["5", "JKL"],
  ["6", "MNO"],
  ["7", "PQRS"],
  ["8", "TUV"],
  ["9", "WXYZ"],
];
const KEY_LETTERS: Record<string, string> = Object.fromEntries(KEYS);
const ROUND_SECONDS = 180;
// Multi-tap window: taps on the same key within this time cycle its letters;
// after it elapses the letter commits and the next tap starts a new one.
const MULTI_TAP_MS = 400;

// 4-letter word = 1 point, +1 point for each extra letter.
const wordPoints = (word: string) => Math.max(0, word.length - 3);

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Ranked rounds keep their found words here so a page reload mid-round does
// not lose them. The server still validates every word when the round ends.
const foundStorageKey = (roundId: string) => `doppelkey-found-${roundId}`;

function dayLabel(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function Game() {
  const { ready: authReady, session } = useAuth();
  const ranked = Boolean(session);
  const userId = session?.user.id;
  const [digits, setDigits] = useState<string[]>([]);
  const [dateLabel, setDateLabel] = useState("");
  const [puzzleState, setPuzzleState] = useState<"loading" | "ready" | "error">("loading");
  const [round, setRound] = useState<RankedRound | null>(null);
  const [roundState, setRoundState] = useState<"loading" | "ready" | "error">("loading");
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "error">("idle");
  const [stats, setStats] = useState<MyStats | null>(null);
  const [dictionary, setDictionary] = useState<Set<string> | null>(null);
  const [wordlistState, setWordlistState] = useState<"loading" | "ready" | "error">("loading");
  const [input, setInput] = useState("");
  const [found, setFound] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ tone: "info" | "good" | "bad"; text: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [keypadSelection, setKeypadSelection] = useState<{ digit: string; index: number } | null>(null);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [definition, setDefinition] = useState<{
    word: string;
    status: "loading" | "ready" | "missing" | "error";
    text: string;
  } | null>(null);
  const overlayButtonRef = useRef<HTMLButtonElement>(null);
  const typingRef = useRef<HTMLDivElement>(null);
  const keypadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPuzzle = useCallback(() => {
    setPuzzleState("loading");
    getSupabase()
      .rpc("get_daily_puzzle")
      .then(({ data, error }) => {
        const puzzle = data as { day: string; digits: string } | null;
        if (error || !puzzle) {
          setPuzzleState("error");
          return;
        }
        setDigits(puzzle.digits.split("").sort());
        setDateLabel(dayLabel(puzzle.day));
        setPuzzleState("ready");
      });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads data from the server
    loadPuzzle();
  }, [loadPuzzle]);

  const applyRound = useCallback((next: RankedRound) => {
    // Use the server's clock for the deadline so a wrong device clock cannot
    // stretch or shorten the round.
    const offset = Date.parse(next.server_now) - Date.now();
    setDeadlineMs(Date.parse(next.deadline) - offset);
    setRound(next);
  }, []);

  const loadStats = useCallback(() => {
    getSupabase()
      .rpc("my_stats")
      .then(({ data }) => setStats((data as MyStats | null) ?? null));
  }, []);

  const loadRound = useCallback(() => {
    setRoundState("loading");
    getSupabase()
      .rpc("get_my_round")
      .then(({ data, error }) => {
        if (error) {
          setRoundState("error");
          return;
        }
        const existing = data as RankedRound | null;
        if (existing) {
          applyRound(existing);
          if (existing.status === "started") {
            try {
              const saved = localStorage.getItem(foundStorageKey(existing.id));
              if (saved) setFound(JSON.parse(saved));
            } catch {}
          } else {
            setFound(existing.words);
          }
        } else {
          setRound(null);
        }
        setRoundState("ready");
      });
    loadStats();
  }, [applyRound, loadStats]);

  useEffect(() => {
    if (!authReady) return;
    if (userId) {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads data from the server
      loadRound();
    } else {
      setRound(null);
      setStats(null);
      setFound([]);
      setRoundState("ready");
    }
  }, [authReady, userId, loadRound]);

  const startRankedRound = () => {
    setStarting(true);
    getSupabase()
      .rpc("start_round")
      .then(({ data, error }) => {
        setStarting(false);
        if (error || !data) {
          setFeedback({ tone: "bad", text: "Couldn't start the round. Try again." });
          return;
        }
        const next = data as RankedRound;
        applyRound(next);
        setSecondsLeft(
          Math.max(0, Math.ceil((Date.parse(next.deadline) - Date.parse(next.server_now)) / 1000))
        );
        loadStats();
      });
  };

  const fetchWordlist = () =>
    fetch("/wordlist.txt")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const words = text
          .split("\n")
          .map((word) => word.trim())
          .filter((word) => /^[a-z]{4,}$/.test(word));
        if (words.length < 100000) throw new Error("Wordlist failed validation");
        setDictionary(new Set(words));
        setWordlistState("ready");
      })
      .catch(() => setWordlistState("error"));

  useEffect(() => {
    fetchWordlist();
  }, []);

  const retryLoad = () => {
    if (wordlistState === "error") {
      setWordlistState("loading");
      fetchWordlist();
    }
    if (puzzleState === "error") loadPuzzle();
    if (roundState === "error" && userId) loadRound();
  };

  const loadReady =
    authReady &&
    puzzleState === "ready" &&
    wordlistState === "ready" &&
    roundState === "ready";
  const rankedLive = ranked && round?.status === "started";
  // True while the player may type: a practice round (signed out) or an open
  // ranked round.
  const ready = loadReady && (!ranked || rankedLive);

  useEffect(() => {
    // Practice timer starts only once the wordlist and puzzle have loaded.
    if (!ready || ranked) return;
    const timer = setInterval(() => {
      setSecondsLeft((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [ready, ranked]);

  useEffect(() => {
    // Ranked timer follows the server-issued deadline.
    if (!rankedLive || deadlineMs === null) return;
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [rankedLive, deadlineMs]);

  useEffect(() => {
    if (!rankedLive || !round) return;
    try {
      localStorage.setItem(foundStorageKey(round.id), JSON.stringify(found));
    } catch {}
  }, [found, rankedLive, round]);

  const submitRound = useCallback(() => {
    if (!round || submitState === "submitting") return;
    setSubmitState("submitting");
    getSupabase()
      .rpc("finish_round", { p_words: found })
      .then(({ data, error }) => {
        if (error || !data) {
          // Too early by a hair, or a dropped connection: retry shortly.
          setSubmitState("error");
          return;
        }
        const finished = data as RankedRound;
        setRound(finished);
        setFound(finished.words);
        setSubmitState("idle");
        try {
          localStorage.removeItem(foundStorageKey(finished.id));
        } catch {}
        loadStats();
      });
  }, [round, found, submitState, loadStats]);

  useEffect(() => {
    if (!rankedLive || secondsLeft > 0 || submitState !== "idle") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads data from the server
    submitRound();
  }, [rankedLive, secondsLeft, submitState, submitRound]);

  useEffect(() => {
    if (submitState !== "error" || !rankedLive) return;
    const retry = setTimeout(() => setSubmitState("idle"), 3000);
    return () => clearTimeout(retry);
  }, [submitState, rankedLive]);

  const allowedLetters = useMemo(() => {
    const letters = new Set<string>();
    digits.forEach((digit) => {
      for (const letter of KEY_LETTERS[digit]) letters.add(letter.toLowerCase());
    });
    return letters;
  }, [digits]);

  const possibleWords = useMemo(() => {
    if (!dictionary || allowedLetters.size === 0) return [];
    const matches: string[] = [];
    dictionary.forEach((word) => {
      if ([...word].every((letter) => allowedLetters.has(letter)))
        matches.push(word);
    });
    return matches;
  }, [dictionary, allowedLetters]);

  const rankedDone = ranked && round !== null && round.status !== "started";
  const gameOver = rankedDone || (ready && secondsLeft <= 0);
  const showGameOverOverlay =
    gameOver && !overlayDismissed && !rankedLive;
  const missedWords = gameOver
    ? possibleWords.filter((word) => !found.includes(word))
    : [];

  useEffect(() => {
    if (showGameOverOverlay) overlayButtonRef.current?.focus();
  }, [showGameOverOverlay]);

  const submitWord = (event: FormEvent) => {
    event.preventDefault();
    if (gameOver || !ready) return;
    const word = input.trim().toLowerCase();
    setInput("");
    if (word.length < 4) {
      setFeedback({ tone: "bad", text: "Words need at least four letters." });
      return;
    }
    if (![...word].every((letter) => allowedLetters.has(letter))) {
      setFeedback({ tone: "bad", text: "Only use letters on today's digits." });
      return;
    }
    if (found.includes(word)) {
      setFeedback({ tone: "info", text: "Already found that one." });
      return;
    }
    if (!dictionary) {
      setFeedback({ tone: "info", text: "Wordlist is still loading, try again." });
      return;
    }
    if (!dictionary.has(word)) {
      setFeedback({ tone: "bad", text: "Not in today's wordlist." });
      return;
    }
    setFound((words) => [...words, word].sort());
    setFeedback({ tone: "good", text: `${word.toUpperCase()} added.` });
  };

  useEffect(() => {
    return () => {
      if (keypadTimerRef.current) clearTimeout(keypadTimerRef.current);
    };
  }, []);

  const pressKeypadKey = (digit: string) => {
    if (!ready || gameOver) return;
    const letters = KEY_LETTERS[digit];
    if (!letters) return;

    const isSameKey = keypadSelection?.digit === digit;
    const nextIndex = isSameKey ? (keypadSelection.index + 1) % letters.length : 0;
    const nextLetter = letters[nextIndex];

    setInput((value) => (isSameKey ? value.slice(0, -1) : value) + nextLetter);
    setKeypadSelection({ digit, index: nextIndex });
    if (keypadTimerRef.current) clearTimeout(keypadTimerRef.current);
    keypadTimerRef.current = setTimeout(() => setKeypadSelection(null), MULTI_TAP_MS);
  };

  useEffect(() => {
    // Keep the caret end of the scrolling typing display in view.
    const el = typingRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [input]);

  const backspaceWord = () => {
    if (!ready || gameOver) return;
    setInput((value) => value.slice(0, -1));
    setKeypadSelection(null);
  };

  // Definitions come from the Datamuse API (https://datamuse.com/api/). Free
  // without a key until 2027-02-01, after which an API key is required
  // (100,000 requests/day per key).
  const fetchDefinition = (word: string) => {
    setDefinition({ word, status: "loading", text: "" });
    fetch(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&max=5&md=d`
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((entries: { word?: string; defs?: string[] }[]) => {
        const match = entries?.find(
          (entry) => entry.word?.toLowerCase() === word
        );
        const defs = match?.defs;
        if (!defs || defs.length === 0) {
          setDefinition({ word, status: "missing", text: "No definition found." });
          return;
        }
        const text = defs
          .slice(0, 2)
          .map((def) => {
            const [pos, ...rest] = def.split("\t");
            return `(${pos}) ${rest.join(" ").trim()}`;
          })
          .join(" ");
        setDefinition({ word, status: "ready", text });
      })
      .catch(() =>
        setDefinition({
          word,
          status: "error",
          text: "Couldn't load the definition. Tap the word to retry.",
        })
      );
  };

  const localScore = found.reduce((total, word) => total + wordPoints(word), 0);
  // After a ranked round the server's score is the one that counts.
  const score = rankedDone && round ? round.score : localScore;
  const rankedNote =
    rankedDone && round?.status === "expired"
      ? "Your ranked round ended without a result, so it has no score today."
      : rankedDone && round?.status === "rejected"
        ? "That round couldn't be verified, so it has no score today."
        : null;
  const streakLabel = stats
    ? `${stats.current_streak} day${stats.current_streak === 1 ? "" : "s"}`
    : null;

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
            <Link href="/#archive">Examples</Link>
            <Link href="/#about">About</Link>
            <Link href="/leaderboard">Leaderboard</Link>
            <AuthButton />
            <Link className="button button-small" href="/">
              Home
            </Link>
          </nav>
        </header>
        <div className="content-wrap">
          <div className="game-hero">
            <p className="eyebrow">
              {ranked ? "TODAY'S RANKED PUZZLE" : "TODAY'S PUZZLE"}
            </p>
            <h1 className="game-digits">
              {puzzleState === "ready" ? digits.join(" · ") : "· · · ·"}
            </h1>
            <p className="game-date">{puzzleState === "ready" ? dateLabel : "Loading"}</p>
            {authReady && !ranked && (
              <p className="game-mode-note">
                Practice round, not saved.{" "}
                <button className="link-button" type="button" onClick={() => signInWithGoogle()}>
                  Sign in with Google
                </button>{" "}
                to play your one ranked round today, keep a streak and join the
                leaderboard.
              </p>
            )}
          </div>
          <div className="game-board">
            <div className="game-panel panel-status">
              <p className="panel-label">Time left</p>
              <p className="game-timer">{formatTime(secondsLeft)}</p>
              <p className="game-progress">
                Score: {score} {score === 1 ? "point" : "points"}
              </p>
              {ranked && streakLabel && (
                <p className="game-streak">Streak: {streakLabel}</p>
              )}
              <p className="game-rules">
                Words need four or more letters. A four-letter word is worth 1
                point, and each extra letter adds 1 more. Reuse any letter as
                often as you like.
              </p>
            </div>
            <div className="game-panel panel-keypad">
              <div className="puzzle-header">
                <p className="panel-label">Today&apos;s keypad</p>
                <p className="key-summary">
                  {puzzleState === "ready" ? digits.join(" · ") : ""}
                </p>
              </div>
              <form className="keypad-form" onSubmit={submitWord}>
                <div className="typing-shell">
                  <div
                    className="typing-word"
                    ref={typingRef}
                    aria-label={input ? `Current word: ${input}` : "No letters entered yet"}
                  >
                    {gameOver ? (
                      <span className="typing-placeholder">Time&rsquo;s up!</span>
                    ) : input ? (
                      [...input].map((letter, index) => (
                        <span
                          className={`typing-letter${allowedLetters.has(letter.toLowerCase()) ? "" : " typing-letter-faded"}`}
                          key={`${index}-${letter}`}
                          aria-hidden="true"
                        >
                          {letter.toUpperCase()}
                        </span>
                      ))
                    ) : null}
                    {!gameOver && <span className="typing-caret" aria-hidden="true" />}
                  </div>
                </div>
                <div className="keypad">
                  {KEYS.map(([number, letters]) =>
                    letters ? (
                      <button
                        className={`key key-interactive ${digits.includes(number) ? "key-active" : ""}`}
                        key={number}
                        type="button"
                        onClick={() => pressKeypadKey(number)}
                      >
                        <strong>{number}</strong>
                        <span>{letters}</span>
                      </button>
                    ) : (
                      <div className="key" key={number}>
                        <strong>{number}</strong>
                        <span>{letters}</span>
                      </div>
                    )
                  )}
                </div>
                <div className="game-actions">
                  <button
                    className="button game-add"
                    type="submit"
                    disabled={!ready || gameOver}
                  >
                    Add word
                  </button>
                  <button
                    className="button game-backspace"
                    type="button"
                    onClick={backspaceWord}
                    disabled={!ready || gameOver || input.length === 0}
                    aria-label="Delete last letter"
                  >
                    <Image
                      src="/backspace.svg"
                      alt=""
                      aria-hidden="true"
                      width={24}
                      height={24}
                    />
                  </button>
                </div>
              </form>
              {feedback && (
                <p className={`game-feedback game-feedback-${feedback.tone}`} aria-live="polite">
                  {feedback.text}
                </p>
              )}
            </div>
            <div className="game-panel panel-found">
              <p className="panel-label">Found words</p>
              <div className="found-words">
                {found.map((word) =>
                  gameOver ? (
                    <button
                      className="status status-teal"
                      key={word}
                      type="button"
                      onClick={() => fetchDefinition(word)}
                    >
                      {word.toUpperCase()}
                    </button>
                  ) : (
                    <span className="status status-teal" key={word}>
                      {word.toUpperCase()}
                    </span>
                  )
                )}
                {gameOver &&
                  missedWords.map((word) => (
                    <button
                      className="status status-missing"
                      key={word}
                      type="button"
                      onClick={() => fetchDefinition(word)}
                    >
                      {word.toUpperCase()}
                    </button>
                  ))}
              </div>
              {gameOver && definition && (
                <p className="word-definition" aria-live="polite">
                  <strong>{definition.word.toUpperCase()}</strong>{" "}
                  {definition.status === "loading"
                    ? "Loading definition..."
                    : definition.text}
                </p>
              )}
              {found.length === 0 && !gameOver && (
                <p className="found-empty">Words you find will land here.</p>
              )}
              {gameOver && (
                <p className="found-copy">
                  {rankedNote ? `${rankedNote} ` : ""}Time&apos;s up. You scored {score} {score === 1 ? "point" : "points"} with{" "}
                  {found.length} {found.length === 1 ? "word" : "words"}. Solid letters are yours, dashed ones got away. Tap any
                  word for its definition.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
      {!loadReady && (
        <div className="game-loading-overlay" role="status" aria-live="polite">
          <div className="game-loading-card">
            {wordlistState === "error" || puzzleState === "error" || roundState === "error" ? (
              <>
                <p className="game-loading-text">
                  {puzzleState === "error"
                    ? "Couldn't load today's puzzle"
                    : roundState === "error"
                      ? "Couldn't load your round"
                      : "Couldn't load the wordlist"}
                </p>
                <button className="button" type="button" onClick={retryLoad}>
                  Try again
                </button>
              </>
            ) : (
              <>
                <span className="game-spinner" aria-hidden="true" />
                <p className="game-loading-text">
                  {wordlistState === "loading" ? "Loading wordlist" : "Loading today's puzzle"}
                </p>
              </>
            )}
          </div>
        </div>
      )}
      {loadReady && ranked && round === null && (
        <div className="game-loading-overlay" role="dialog" aria-modal="true" aria-labelledby="ranked-start-title">
          <div className="game-loading-card game-over-card">
            <p className="game-over-title" id="ranked-start-title">
              Ranked round
            </p>
            <p className="game-over-copy">
              You get one ranked attempt per day. The 3 minutes start the
              moment you tap the button. A new puzzle drops at midnight IST.
            </p>
            <button className="button" type="button" onClick={startRankedRound} disabled={starting}>
              {starting ? "Starting..." : "Start today's round"}
            </button>
            {feedback?.tone === "bad" && <p className="game-over-copy">{feedback.text}</p>}
          </div>
        </div>
      )}
      {rankedLive && secondsLeft <= 0 && (
        <div className="game-loading-overlay" role="status" aria-live="polite">
          <div className="game-loading-card">
            <span className="game-spinner" aria-hidden="true" />
            <p className="game-loading-text">
              {submitState === "error" ? "Retrying score submission" : "Checking your words"}
            </p>
          </div>
        </div>
      )}
      {showGameOverOverlay && (
        <div
          className="game-loading-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-over-title"
        >
          <div className="game-loading-card game-over-card">
            <p className="game-over-title" id="game-over-title">
              {ranked ? "Ranked score" : "Time\u2019s up!"}
            </p>
            <p className="game-over-score">
              {score}
              <span className="game-over-score-label">
                {score === 1 ? "point" : "points"}
              </span>
            </p>
            <p className="game-over-copy">
              You found {found.length}{" "}
              {found.length === 1 ? "word" : "words"}.
            </p>
            {rankedNote && <p className="game-over-copy">{rankedNote}</p>}
            {ranked && streakLabel && (
              <p className="game-over-copy">Streak: {streakLabel}</p>
            )}
            {ranked && (
              <Link className="button button-outline" href="/leaderboard">
                See the leaderboard
              </Link>
            )}
            <button
              className="button"
              type="button"
              ref={overlayButtonRef}
              onClick={() => setOverlayDismissed(true)}
            >
              See the words
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
