import type { Metadata } from "next";
import Link from "next/link";
import AuthButton from "../AuthButton";

export const metadata: Metadata = {
  title: "Doppelkey | Privacy policy",
  description: "What Doppelkey collects, why, and how your information is handled.",
};

export default function PrivacyPage() {
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
        <div className="content-wrap privacy-section">
          <h1 className="leaderboard-title">Privacy policy</h1>
          <p className="privacy-updated">Last updated November 3, 2026</p>

          <p>
            Doppelkey is a daily digit word puzzle. This policy explains what
            information the site collects, why it collects it, and the choices
            you have. It is short because the site collects very little.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Google account details.</strong> If you sign in with
              Google, Google shares your name, email address and profile
              picture with us. Sign-in is handled by Supabase, our
              authentication and database provider. You can play the daily
              puzzle without signing in.
            </li>
            <li>
              <strong>Username.</strong> The display name you choose on your
              account page.
            </li>
            <li>
              <strong>Game activity.</strong> The rounds you play: the day,
              your score, the words you found, and your streaks and best
              score. This powers your stats and the leaderboard.
            </li>
            <li>
              <strong>Information stored on your device.</strong> Your browser
              keeps your sign-in session and your found words for the current
              puzzle in local storage. That data stays on your device.
            </li>
            <li>
              <strong>Technical information.</strong> Our hosting and DNS
              providers, Vercel and Cloudflare, process standard technical
              details such as your IP address and browser type to serve the
              site.
            </li>
          </ul>

          <h2>How we use it</h2>
          <p>
            We use this information to run the game: keeping you signed in,
            showing your stats and streaks, and publishing the leaderboard. We
            do not show ads, sell your information, or use analytics trackers.
          </p>

          <h2>The leaderboard is public</h2>
          <p>
            When you finish a ranked round, your username, score and word
            count appear on the daily leaderboard, which anyone can see. Pick
            a username you are comfortable sharing.
          </p>

          <h2>Services we rely on</h2>
          <ul>
            <li>
              <strong>Google</strong> handles sign-in.{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
                Google privacy policy
              </a>
            </li>
            <li>
              <strong>Supabase</strong> stores accounts, usernames and game
              data.{" "}
              <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">
                Supabase privacy policy
              </a>
            </li>
            <li>
              <strong>Vercel</strong> hosts the site and{" "}
              <strong>Cloudflare</strong> provides DNS.{" "}
              <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">
                Vercel
              </a>{" "}
              and{" "}
              <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">
                Cloudflare
              </a>{" "}
              privacy policies
            </li>
            <li>
              <strong>Datamuse</strong> supplies word definitions. Your browser
              asks the Datamuse API about words from the puzzle.{" "}
              <a href="https://datamuse.com/api/" target="_blank" rel="noreferrer">
                About the Datamuse API
              </a>
            </li>
          </ul>

          <h2>Cookies and storage</h2>
          <p>
            Doppelkey does not set advertising or tracking cookies. The site
            uses browser local storage only for your sign-in session and your
            progress on the current puzzle.
          </p>

          <h2>Keeping and deleting your data</h2>
          <p>
            We keep your account and game history while your account exists.
            You can change your username at any time on the account page. To
            delete your account and game history, contact us using the link
            below and we will remove them. Clearing your browser storage
            removes the data kept on your device.
          </p>

          <h2>Changes to this policy</h2>
          <p>
            If this policy changes, the updated version will be posted on this
            page with a new date.
          </p>

          <h2>Contact</h2>
          <p>
            Questions, or want your data deleted? Open an issue on{" "}
            <a
              href="https://github.com/doppelkey/doppelkey.com/issues"
              target="_blank"
              rel="noreferrer"
            >
              our GitHub repository
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
