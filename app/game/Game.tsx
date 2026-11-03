"use client";

import Link from "next/link";
import Image from "next/image";
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
// Multi-tap window: taps on the same key within this time cycle its letters;
// after it elapses the letter commits and the next tap starts a new one.
const MULTI_TAP_MS = 400;

// 4-letter word = 1 point, +1 point for each extra letter.
const wordPoints = (word: string) => Math.max(0, word.length - 3);

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

  const retryWordlist = () => {
    setWordlistState("loading");
    fetchWordlist();
  };

  const ready = mounted && wordlistState === "ready";

  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      setSecondsLeft((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [ready]);

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

  const gameOver = ready && secondsLeft <= 0;
  const showGameOverOverlay = gameOver && !overlayDismissed;
  const missedWords = gameOver
    ? possibleWords.filter((word) => !found.includes(word))
    : [];

  useEffect(() => {
    if (showGameOverOverlay) overlayButtonRef.current?.focus();
  }, [showGameOverOverlay]);

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

  const score = found.reduce((total, word) => total + wordPoints(word), 0);

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
              <p className="game-progress">
                Score: {score} {score === 1 ? "point" : "points"}
              </p>
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
                  {mounted ? digits.join(" · ") : ""}
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
                  Time&apos;s up. You scored {score} {score === 1 ? "point" : "points"} with{" "}
                  {found.length} {found.length === 1 ? "word" : "words"}. Solid letters are yours, dashed ones got away. Tap any
                  word for its definition.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
      {wordlistState !== "ready" && (
        <div className="game-loading-overlay" role="status" aria-live="polite">
          <div className="game-loading-card">
            {wordlistState === "error" ? (
              <>
                <p className="game-loading-text">Couldn&apos;t load the wordlist</p>
                <button className="button" type="button" onClick={retryWordlist}>
                  Try again
                </button>
              </>
            ) : (
              <>
                <span className="game-spinner" aria-hidden="true" />
                <p className="game-loading-text">Loading wordlist</p>
              </>
            )}
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
              Time&apos;s up!
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
