# WC26 Tracker

A personal FIFA World Cup 2026 companion, live at [wc2026.alextestingstuff.com](https://wc2026.alextestingstuff.com).

Built in one night (June 12, 2026, day two of the tournament) to solve one problem: **never miss a goal**. Every match tracked, every highlight one tap away, watched progress synced across devices without a login.

## What it does

- **Live scores** polling every 4 seconds during matches, with kickoff countdowns, all times Australia/Melbourne
- **Full 104-match schedule** centered on today, with group tables, tournament top scorers, assists and discipline
- **Match pages** with a LiveScore-style events timeline, stat bars, lineups, all updating live
- **Highlights without leaving the app**: SBS Sport's YouTube highlights embedded in popups and match pages, discovered automatically within minutes of upload
- **SBS On Demand links** per match: live stream, highlights, extended highlights, full replay, discovered from SBS's own catalogue API
- **Watched tracking and stats**: tick off matches (auto-ticked when you play highlights), see goals-seen percentage, follow teams, favourite matches
- **Cross-device sync** via a readable code (TIGER-42 style), no accounts
- **Issue reporting** straight to email from the header flag button

## Docs

| File | Contents |
|---|---|
| [PRODUCT.md](PRODUCT.md) | Features and behaviour, page by page |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Data sources, caching, sync model, discovery pipelines |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | Limitations and risks, with mitigations |
| [CHANGELOG.md](CHANGELOG.md) | How it got built, commit by commit |

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind on Vercel (syd1), Supabase (Postgres via PostgREST) for the two tables, zero runtime dependencies beyond React. Data from ESPN's unofficial public API, SBS's catalogue API, and SBS Sport's YouTube channel, all proxied server-side.

## Running it

```
npm install
cp .env.example .env.local   # fill in Supabase URL + service role key
npm run dev
```

Run `supabase/schema.sql` in the Supabase SQL editor once. The app degrades gracefully without the database (scores work, sync and SBS links do not). `RESEND_API_KEY` is optional and powers the report button.
