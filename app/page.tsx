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

function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#top">
        Doppelkey
      </a>
      <nav className="main-nav">
        <a href="#how-it-works">How to play</a>
        <a href="#archive">Archive</a>
        <a href="#about">About</a>
        <a className="button button-small" href="#puzzle">
          Play today
        </a>
      </nav>
    </header>
  );
}

function PuzzleCard() {
  return (
    <div className="puzzle-card" id="puzzle">
      <div className="puzzle-meta">Puzzle No. 42</div>
      <h2>HOLE</h2>
      <p className="key-summary">Keys 4 · 6 · 5 · 3</p>
      <div className="keypad">
        {keys.map(([number, letters]) => (
          <div
            className={`key ${["3", "4", "5", "6"].includes(number) ? "key-active" : ""}`}
            key={number}
          >
            <strong>{number}</strong>
            <span>{letters}</span>
          </div>
        ))}
      </div>
      <div className="puzzle-footer">
        <span className="status status-teal">GOLF</span>
        <span className="status status-teal">HOLD</span>
        <span className="status status-missing">?</span>
        <span className="found-copy">2 of 3 twins found</span>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    [
      "1",
      "See today's word",
      "A new word appears each day, along with the phone keys that spell it.",
    ],
    [
      "2",
      "Read the keys",
      "Each key stands for three or four letters. Work out what else those keys can spell.",
    ],
    [
      "3",
      "Find the twins",
      "Type every other real word that uses the same keys. Find them all to finish the day.",
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
            <p className="eyebrow">A DAILY KEYPAD WORD PUZZLE</p>
            <h1>
              Find the words
              <br />
              that share a<br />
              keypad
            </h1>
            <p className="hero-description">
              Every day brings one word. Find every other real word typed with
              the same phone keys. It takes about a minute.
            </p>
            <div className="hero-actions">
              <a className="button" href="#puzzle">
                Play today's puzzle
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
            <h2>Same keys, different words</h2>
            <p>
              Press 4, 6, 5, 3 and you can spell hole, hold, gold, or golf. That
              is a twin set, and your job is to find them all.
            </p>
          </div>
          <div className="word-example">
            <strong>4 · 6 · 5 · 3</strong>
            <div className="word-list">
              <span>HOLE</span>
              <span>HOLD</span>
              <span>GOLD</span>
              <span>GOLF</span>
            </div>
          </div>
        </div>
      </section>
      <section className="cta-section" id="about">
        <div className="content-wrap cta-content">
          <h2>Ready for today's puzzle?</h2>
          <a className="button" href="#puzzle">
            Play today
          </a>
        </div>
      </section>
      <footer className="site-footer">
        <div className="content-wrap footer-content">
          <div>
            <strong>Doppelkey</strong>
            <small>© 2026 Doppelkey. A daily keypad word puzzle.</small>
          </div>
          <nav>
            <a href="#how-it-works">How to play</a>
            <a href="#archive">Archive</a>
            <a href="#about">About</a>
            <a href="#privacy">Privacy</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
