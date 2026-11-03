"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dailyDigits(date: Date): string[] {
  const seed =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const rand = mulberry32(seed);
  const pool = KEYS.map(([digit]) => digit).filter((digit) => digit !== "1");
  const picks: string[] = [];
  while (picks.length < 4) {
    const digit = pool[Math.floor(rand() * pool.length)];
    if (!picks.includes(digit)) picks.push(digit);
  }
  return picks.sort();
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function Game() {
  const [mounted, setMounted] = useState(false);
  const [digits, setDigits] = useState<string[]>([]);
  const [dateLabel, setDateLabel] = useState("");
  const [dictionary, setDictionary] = useState<Set<string> | null>(null);
  const [input, setInput] = useState("");
  const [found, setFound] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ tone: "info" | "good" | "bad"; text: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [keypadSelection, setKeypadSelection] = useState<{ digit: string; index: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const keypadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Date-seeded digits differ between server prerender and the player's
    // local day, so compute them after mount inside an async callback.
    const frame = requestAnimationFrame(() => {
      const now = new Date();
      setDigits(dailyDigits(now));
      setDateLabel(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      );
      setMounted(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/words.txt")
      .then((res) => res.text())
      .then((text) => {
        if (cancelled) return;
        setDictionary(new Set(text.split("\n").filter(Boolean)));
      })
      .catch(() => {
        if (!cancelled) setDictionary(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const timer = setInterval(() => {
      setSecondsLeft((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [mounted]);

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

  const gameOver = mounted && secondsLeft <= 0;
  const missedWords = gameOver
    ? possibleWords.filter((word) => !found.includes(word))
    : [];

  const submitWord = (event: FormEvent) => {
    event.preventDefault();
    if (gameOver) return;
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
      setFeedback({ tone: "info", text: "Word list is still loading, try again." });
      return;
    }
    if (!dictionary.has(word)) {
      setFeedback({ tone: "bad", text: "Not in the offline word list." });
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
    if (gameOver) return;
    const letters = KEY_LETTERS[digit];
    if (!letters) return;

    const isSameKey = keypadSelection?.digit === digit;
    const nextIndex = isSameKey ? (keypadSelection.index + 1) % letters.length : 0;
    const nextLetter = letters[nextIndex];

    setInput((value) => (isSameKey ? value.slice(0, -1) : value) + nextLetter);
    setKeypadSelection({ digit, index: nextIndex });
    if (keypadTimerRef.current) clearTimeout(keypadTimerRef.current);
    keypadTimerRef.current = setTimeout(() => setKeypadSelection(null), 900);
    inputRef.current?.focus();
  };

  const handleInputChange = (value: string) => {
    setInput(value.replace(/[^a-zA-Z]/g, ""));
    setKeypadSelection(null);
  };

  const progressPct = possibleWords.length
    ? Math.round((found.length / possibleWords.length) * 100)
    : 0;

  return (
    <div className="page-shell" id="top">
      <section className="game-section">
        <header className="site-header">
          <Link className="brand" href="/">
            Doppelkey
          </Link>
          <nav className="main-nav">
            <Link href="/#how-it-works">How to play</Link>
            <Link href="/#archive">Examples</Link>
            <Link href="/#about">About</Link>
            <Link className="button button-small" href="/">
              Home
            </Link>
          </nav>
        </header>
        <div className="content-wrap">
          <div className="game-hero">
            <p className="eyebrow">TODAY&apos;S PUZZLE</p>
            <h1 className="game-digits">
              {mounted ? digits.join(" · ") : "· · · ·"}
            </h1>
            <p className="game-date">{mounted ? dateLabel : "Loading"}</p>
          </div>
          <div className="game-board">
            <div className="game-panel panel-status">
              <p className="panel-label">Time left</p>
              <p className="game-timer">{formatTime(secondsLeft)}</p>
              <div className="progress-track" aria-hidden="true">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="game-progress">
                {found.length} of {possibleWords.length || "…"} words found
              </p>
              <p className="game-rules">
                Words need four or more letters. Reuse any letter as often as
                you like.
              </p>
            </div>
            <div className="game-panel panel-keypad">
              <div className="puzzle-header">
                <p className="panel-label">Today&apos;s keypad</p>
                <p className="key-summary">
                  {mounted ? digits.join(" · ") : ""}
                </p>
              </div>
              <form className="keypad-form" onSubmit={submitWord}>
                <div className="typing-shell">
                  <div className="typing-word" aria-hidden="true">
                    {input ? (
                      input.toUpperCase()
                    ) : gameOver ? (
                      <span className="typing-placeholder">Time is up</span>
                    ) : null}
                    <span className="typing-caret" aria-hidden="true" />
                  </div>
                  <input
                    ref={inputRef}
                    className="typing-input"
                    type="text"
                    value={input}
                    onChange={(event) => handleInputChange(event.target.value)}
                    autoComplete="off"
                    autoCapitalize="characters"
                    disabled={!mounted || gameOver}
                    aria-label="Word built from today's digits"
                  />
                </div>
                <div className="keypad">
                  {KEYS.map(([number, letters]) => (
                    <div
                      className={`key ${digits.includes(number) ? "key-active" : ""} ${letters ? "key-interactive" : ""}`}
                      key={number}
                      role={letters ? "button" : undefined}
                      tabIndex={letters ? 0 : undefined}
                      onClick={() => pressKeypadKey(number)}
                      onKeyDown={(event) => {
                        if (
                          letters &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          pressKeypadKey(number);
                        }
                      }}
                    >
                      <strong>{number}</strong>
                      <span>{letters}</span>
                    </div>
                  ))}
                </div>
                <button
                  className="button game-add"
                  type="submit"
                  disabled={!mounted || gameOver}
                >
                  Add word
                </button>
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
                {found.map((word) => (
                  <span className="status status-teal" key={word}>
                    {word.toUpperCase()}
                  </span>
                ))}
                {gameOver &&
                  missedWords.map((word) => (
                    <span className="status status-missing" key={word}>
                      {word.toUpperCase()}
                    </span>
                  ))}
              </div>
              {found.length === 0 && !gameOver && (
                <p className="found-empty">Words you find will land here.</p>
              )}
              {gameOver && (
                <p className="found-copy">
                  Time&apos;s up. You found {found.length} of {possibleWords.length}{" "}
                  words. Solid letters are yours, dashed ones got away.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
