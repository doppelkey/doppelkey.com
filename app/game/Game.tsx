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
  const inputRef = useRef<HTMLInputElement>(null);

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

  const letterBank = useMemo(
    () =>
      digits.flatMap((digit) =>
        [...KEY_LETTERS[digit]].map((letter) => ({ digit, letter }))
      ),
    [digits]
  );

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

  const appendLetter = (letter: string) => {
    if (gameOver) return;
    setInput((value) => value + letter);
    inputRef.current?.focus();
  };

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
        <div className="content-wrap game-layout">
          <div className="game-copy">
            <p className="eyebrow">TODAY&apos;S PUZZLE</p>
            <h1 className="game-digits">
              {mounted ? digits.join(" · ") : "· · · ·"}
            </h1>
            <p className="game-date">{mounted ? dateLabel : "Loading"}</p>
            <p className="game-timer">{formatTime(secondsLeft)}</p>
            <p className="game-progress">
              {found.length} of {possibleWords.length || "…"} words found
            </p>
            <p className="game-rules">
              Words need four or more letters. Reuse any letter as often as you
              like.
            </p>
          </div>
          <div className="puzzle-card game-card">
            <div className="puzzle-header">
              <div className="puzzle-meta">Today&apos;s digits</div>
              <p className="key-summary">
                {mounted ? digits.join(" · ") : ""}
              </p>
            </div>
            <div className="keypad">
              {KEYS.map(([number, letters]) => (
                <div
                  className={`key ${digits.includes(number) ? "key-active" : ""}`}
                  key={number}
                >
                  <strong>{number}</strong>
                  <span>{letters}</span>
                </div>
              ))}
            </div>
            <form className="word-form" onSubmit={submitWord}>
              <input
                ref={inputRef}
                className="word-input"
                type="text"
                value={input}
                onChange={(event) =>
                  setInput(event.target.value.replace(/[^a-zA-Z]/g, ""))
                }
                placeholder={gameOver ? "Time is up" : "Build a word"}
                autoComplete="off"
                autoCapitalize="characters"
                disabled={!mounted || gameOver}
                aria-label="Word built from today's digits"
              />
              <button className="button" type="submit" disabled={!mounted || gameOver}>
                Add
              </button>
            </form>
            <div className="letter-bank" aria-label="Letters available today">
              {letterBank.map(({ digit, letter }) => (
                <button
                  type="button"
                  className="letter-chip"
                  key={`${digit}-${letter}`}
                  onClick={() => appendLetter(letter)}
                  disabled={!mounted || gameOver}
                >
                  {letter}
                </button>
              ))}
            </div>
            {feedback && (
              <p className={`game-feedback game-feedback-${feedback.tone}`} aria-live="polite">
                {feedback.text}
              </p>
            )}
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
            {gameOver && (
              <p className="found-copy">
                Time&apos;s up. You found {found.length} of {possibleWords.length}{" "}
                words. Solid letters are yours, dashed ones got away.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
