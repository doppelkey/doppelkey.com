import type { Metadata } from "next";
import Link from "next/link";
import AuthButton from "../AuthButton";

export const metadata: Metadata = {
  title: "Doppelkey | Archive",
  description: "Replay past Doppelkey puzzles. Coming soon.",
};

export default function ArchivePage() {
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
        <div className="content-wrap privacy-section">
          <p className="eyebrow">ARCHIVE</p>
          <h1 className="leaderboard-title">Past puzzles</h1>
          <p className="privacy-updated">Coming soon</p>
          <p>
            The archive is on its way. You will be able to replay previous
            days&apos; digits and look back at earlier leaderboards here.
          </p>
          <p>
            <Link className="button" href="/game">
              Play today&apos;s puzzle
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
