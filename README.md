# Doppelkey

A daily digit word puzzle at [doppelkey.com](https://doppelkey.com).

Every day you get four unique digits. Each digit maps to letters on a
phone-style keypad (2 = ABC, 3 = DEF, and so on). Build as many real words
of four or more letters as you can in three minutes, reusing any letter or
digit as often as you like. Longer words score more: a four-letter word is
1 point, and every extra letter adds 1 more (AIRY = 1, HAIRY = 2,
AIRWAYS = 4).

## Playing

- **Practice** - just open the site and play. Words are checked in the
  browser against the bundled dictionary.
- **Ranked** - sign in with Google to play the day's ranked round. One
  attempt per player per day: the server issues the digits and the deadline,
  checks each word against its own copy of the dictionary and computes the
  score. Ranked scores feed the daily leaderboard, which resets at midnight
  IST.
- **Streaks** - starting a ranked round on consecutive IST days builds your
  streak; a missed day resets it.
- **Account** - pick a unique username for the leaderboard and edit it any
  time.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- Supabase: Google sign-in (Auth), Postgres with row-level security, and RPC
  functions for rounds, stats and the leaderboard
- Production hosting on Vercel, DNS managed in Cloudflare

## Project structure

- `app/` - routes and components: the landing page, `/game`, `/leaderboard`,
  `/account` and `/privacy`
- `lib/` - Supabase client (`lib/supabase.ts`), auth hook and username helpers
- `supabase/migrations/` - schema, row-level security and database functions
- `scripts/load-dictionary.mjs` - loads the wordlist into the database
- `public/wordlist.txt` - the full offline dictionary (Letterpress-derived,
  ~273k words; sources and licenses in `public/wordlist.LICENSE.txt`)

Definitions on the time-up screen come from the
[Datamuse API](https://datamuse.com/api/) at runtime; it is free without an
API key until 2027-02-01, after which a key is required (100,000 requests/day
per key).

## Running locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). Other scripts:
`npm run build`, `npm start`, `npm run lint`.

## Environment variables

The browser only needs the Supabase project URL and publishable key:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Both are public by design and have working defaults in `lib/supabase.ts`, so
local development needs no setup. Row-level security and the database
functions decide what signed-in and anonymous visitors can do. Never add a
secret (service-role) key to the app or this repo.

`scripts/load-dictionary.mjs` additionally needs `SUPABASE_ACCESS_TOKEN` and
`SUPABASE_PROJECT_REF` in the environment.

## Database

`supabase/migrations/` holds the schema (`dictionary`, `profiles`,
`daily_puzzles`, `rounds`), row-level security and the functions the app
calls: `get_daily_puzzle`, `start_round`, `finish_round`, `my_stats`,
`get_leaderboard`, `set_display_name`. The day boundary is midnight IST.

Signed-in players get today's puzzle from `get_daily_puzzle`; signed-out
visitors get yesterday's, so today's ranked digits stay unmemorable until
played. `get_puzzle(day)` and `get_archive_days()` read past puzzles for the
archive: past days only, and only days that already exist.

## Privacy

The privacy policy lives at [/privacy](https://doppelkey.com/privacy) and
covers what the app stores: Google sign-in details, your username, game
activity and the public leaderboard.

## Contact

Open an issue on this repo. Issues are public, so please don't include your
email address or other account details.
