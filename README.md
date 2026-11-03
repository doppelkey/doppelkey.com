This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Wordlist and definitions

`public/wordlist.txt` is Doppelkey's full offline wordlist (the Letterpress-derived list, 273k words) (see
`public/wordlist.LICENSE.txt` for sources and licenses). Definitions on the
time-up screen come from the [Datamuse API](https://datamuse.com/api/) at
runtime; it is free without an API key until 2027-02-01, after which a key is
required (100,000 requests/day per key).

## Accounts, ranked rounds and leaderboards (Supabase)

- Login: Google through Supabase Auth. The browser only uses the project URL and the publishable key (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, both safe to expose; defaults are in `lib/supabase.ts`). Never add a secret key to the app or this repo.
- Database: `supabase/migrations/*.sql` holds the schema, row-level security and the functions the app calls. The day resets at midnight IST; each player gets one ranked round per day. The server records the round start, checks words against its own copy of the dictionary and computes the score.
- `scripts/load-dictionary.mjs` loads `public/wordlist.txt` into the database (needs `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` in the environment).
- Streak: consecutive IST days on which a player started a ranked round. A missed IST day resets it.
