"use client";

import { useEffect, useState } from "react";

const keys = [
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
const puzzleDigits = ["2", "4", "7", "9"];
const wordBank = [
  "AIRY",
  "WAYS",
  "WIRY",
  "HAIR",
  "AIRWAY",
  "AIRWAYS",
  "HAIRY",
  "RAYS",
  "WARY",
  "HAYS",
];

function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#top">
        Doppelkey
      </a>
      <nav className="main-nav">
        <a href="#how-it-works">How to play</a>
        <a href="#archive">Examples</a>
        <a href="#about">About</a>
        <a className="button button-small" href="#puzzle">
          Play today
        </a>
      </nav>
    </header>
  );
}

function PuzzleCard() {
  const [typedWord, setTypedWord] = useState("");
  const [wordList, setWordList] = useState(wordBank);

  useEffect(() => {
    let letterIndex = 0;
    let timer: ReturnType<typeof setTimeout>;

    const typeWord = (word: string) => {
      if (letterIndex < word.length) {
        letterIndex += 1;
        setTypedWord(word.slice(0, letterIndex));
        timer = setTimeout(() => typeWord(word), 180);
        return;
      }

      const nextList = [word, ...wordListRef.current.slice(0, -1)];
      wordListRef.current = nextList;
      setWordList(nextList);
      timer = setTimeout(() => {
        letterIndex = 0;
        setTypedWord("");
        typeWord(nextList[nextList.length - 1]);
      }, 900);
    };

    const wordListRef = { current: [...wordBank] };
    typeWord(wordListRef.current[wordListRef.current.length - 1]);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="puzzle-card" id="puzzle">
      <div className="puzzle-header">
        <div className="puzzle-meta">Today's digits</div>
        <p className="key-summary">2 4 7 9</p>
      </div>
      <h2 className="typing-word" aria-live="polite">
        {typedWord}
        <span className="typing-caret" aria-hidden="true" />
      </h2>
      <div className="keypad">
        {keys.map(([number, letters]) => (
          <div
            className={`key ${puzzleDigits.includes(number) ? "key-active" : ""}`}
            key={number}
          >
            <strong>{number}</strong>
            <span>{letters}</span>
          </div>
        ))}
      </div>
      <div className="puzzle-footer">
        {wordList.map((word, index) => (
          <span className="status status-teal" key={`${word}-${index}`}>
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    [
      "1",
      "Get four digits",
      "Each puzzle starts with four unique digits chosen from the keypad.",
    ],
    [
      "2",
      "Read the letters",
      "Use the letters attached to those digits. Every letter and digit can be used more than once.",
    ],
    [
      "3",
      "Build your words",
      "Make real words with four or more letters. Find as many as you can before time runs out.",
    ],
  ];
  return (
    <section className="how-section" id="how-it-works">
      <div className="content-wrap">
        <h2>How it works</h2>
        <div className="steps-grid">
          {steps.map(([number, title, copy]) => (
            <article className="step" key={number}>
              <span className="step-number">{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="page-shell" id="top">
      <section className="hero-section">
        <Header />
        <div className="content-wrap hero-content">
          <div className="hero-copy">
            <p className="eyebrow">A DAILY DIGIT WORD PUZZLE</p>
            <h1>
              Build words
              <br />
              from four<br />
              digits
            </h1>
            <p className="hero-description">
              Four unique digits are your only clues. Use their letters to
              build words of four or more letters, reusing any letter as often
              as you like.
            </p>
            <div className="hero-actions">
              <a className="button" href="#puzzle">
                Try today's digits
              </a>
              <a className="button button-outline" href="#how-it-works">
                How it works
              </a>
            </div>
          </div>
          <PuzzleCard />
        </div>
      </section>
      <HowItWorks />
      <section className="example-section" id="archive">
        <div className="content-wrap example-layout">
          <div className="example-copy">
            <h2>Four digits, many words</h2>
            <p>
              Start with 2, 4, 7, and 9. Their letters can make airy, ways,
              wiry, hair, and more. Repeat letters and digits freely, but every word must
              be at least four letters long.
            </p>
          </div>
          <div className="word-example">
            <strong>2 4 7 9</strong>
            <div className="word-list">
              <span>AIRY</span>
              <span>WAYS</span>
              <span>WIRY</span>
              <span>HAIR</span>
            </div>
          </div>
        </div>
      </section>
      <section className="cta-section" id="about">
        <div className="content-wrap cta-content">
          <h2>Ready to find your words?</h2>
          <a className="button" href="#puzzle">
            Play today
          </a>
        </div>
      </section>
      <footer className="site-footer">
        <div className="content-wrap footer-content">
          <div>
            <strong>Doppelkey</strong>
            <small>© 2026 Doppelkey. A daily digit word puzzle.</small>
          </div>
          <nav>
            <a href="#how-it-works">How to play</a>
            <a href="#archive">Examples</a>
            <a href="#about">About</a>
            <a href="#privacy">Privacy</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
