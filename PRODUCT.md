# wc26-tracker

Personal FIFA World Cup 2026 tracker. Next.js 14 App Router, TypeScript, Tailwind, Supabase. Deployed on Vercel at wc2026.alextestingstuff.com. No login: cross-device sync via a readable sync code.

## What it does

- Today's matches with live scores, polled smartly (4s during live windows, 5min otherwise, paused when tab hidden)
- Full 104-match schedule grouped by date, all times Australia/Melbourne
- Match detail with lineups, goal scorers, SBS live and highlights links
- Watched tracking and favourites, synced across devices with a sync code (e.g. TIGER-42)
- Stats: matches watched, goals seen (excluding shootout kicks) as count and percentage of all tournament goals

## Architecture

### Data source

ESPN's unofficial public JSON API, proxied through our own route handlers. The browser never calls ESPN directly. All ESPN schema knowledge lives in `src/lib/espn.ts`; the rest of the app only sees internal types from `src/lib/types.ts`, so the source can be swapped later.

Endpoints used (verified working 2026-06-12):

- Scoreboard: `site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD` (also accepts `YYYYMMDD-YYYYMMDD` ranges; the whole tournament fits in one call with `limit=200`)
- Summary (lineups, events): `.../fifa.world/summary?event=EVENT_ID`
- Standings: `.../fifa.world/standings` (used once to map teams to groups A-L; not in original spec but required because the scoreboard payload does not carry group letters)

Goal data comes from the scoreboard `details` array (per-event goal records with penalty, own goal and shootout flags), so the stats maths needs no extra requests.

### Routes

| Route | Purpose | Caching |
|---|---|---|
| `GET /api/matches` | All 104 matches + group map | fetch revalidate 300s |
| `GET /api/live` | Matches in a rolling 3-day UTC window, for polling | fetch revalidate 4s |
| `GET/POST /api/check-sbs` | SBS link discovery (live + highlights) | self-throttled, DB `last_checked` gated |
| `GET/POST /api/state` | Sync state read, create, adopt, merge-update | no store, rate limited 30/min/IP |

Server-side fetch caching means N clients polling every 4 seconds still produce at most one upstream ESPN call per 4 seconds.

### Live windows

A match is in its live window from kickoff minus 5 minutes to kickoff plus 150 minutes (180 for knockout rounds, to cover extra time and penalties). Windows are derived from the schedule. The client polls `/api/live` every 4 seconds only while at least one window is open, otherwise every 5 minutes, and stops entirely when the tab is hidden (visibilitychange).

### SBS links

SBS On Demand holds the Australian rights. `/api/check-sbs` fetches the JSON document behind SBS's own World Cup hub page (`catalogue.pr.sbsod.com/pages/fifa-world-cup-2026`, public x-api-key from their browser bundle) and reads five named rails: Live & Upcoming, Highlights, Extended Highlights, Full Matches, Mini Matches. One fetch resolves every published match at once; no scraping.

- Rail titles ("Korea Republic v Czechia: Group A") are matched to ESPN fixtures via the alias map in `src/lib/aliases.ts` (Korea Republic vs South Korea, Bosnia and Herzegovina vs Bosnia-Herzegovina, Turkiye vs Turkey, etc.)
- Watch URLs are `sbs.com.au/ondemand/watch/{mpxMediaID}`
- Stored links are never overwritten with nulls when a video ages off a rail

Triggering: the home page fires a non-blocking call on load (self-throttled to one hub fetch per 5 minutes), and `.github/workflows/sbs-links.yml` curls the deployed endpoint every 15 minutes between 08:00 and 20:00 UTC as a backstop (Vercel Hobby crons are daily-only, so GitHub Actions does the scheduling).

The UI never depends on discovery succeeding: during the live window the button falls back to the SBS hub page, and finished matches show a prefilled SBS search link until the per-cut buttons activate. Match detail shows Highlights, Extended and Full Match buttons in that order under an "SBS links" heading; finished match cards get a compact highlights button. Clicking any SBS video link auto-marks the match watched.

### YouTube highlights embed

SBS Sport mirrors the short highlights cut to YouTube (@SBSSportau), which can be embedded (SBS On Demand itself is DRM gated, links only). The same check-sbs run parses the channel's Videos page (`ytInitialData`), matches titles on both team names plus "highlights" (knockout-proof: no dependence on title structure), and stores the video id. Finished matches embed the player above the SBS links on the detail page via youtube-nocookie.com.

### Issue reporting

A red flag button in the header opens a "Something is broken" box; reports POST to `/api/report` and are emailed to raveshaw@gmail.com via Resend (requires `RESEND_API_KEY`, from the verified send.alextestingstuff.com domain). Rate limited 5/min/IP.

No SBS audio or video is embedded. SBS playback is DRM and account gated; we link out only.

### Sync state (no login)

Supabase `user_state` table keyed by sync code (readable word + two digits, generated server-side with collision check). localStorage caches the state for instant render and offline tolerance; every change is mirrored to Supabase through `/api/state`. Merging is union-based and never deletes entries except explicit untoggles, which the client sends as explicit removal lists. Entering a code on a second device merges that device's arrays into the row (union, no data loss) and then adopts the code. The localStorage key is constant (`wc26.state.v1`), never namespaced by build, so state survives redeploys.

### Resilience

`src/lib/espn.ts` keeps the last good response per endpoint in module scope. On upstream error or unexpected shape, the API serves the last good data with `stale: true` and `lastUpdated`, and the UI shows a small stale banner. Pages never crash on upstream failure. Logging is console only.

### Database

Two tables, SQL in `supabase/schema.sql` (run it in the Supabase SQL editor). Supabase is accessed server-side only, via PostgREST REST calls with the service role key. No Supabase client library is shipped to the browser; no extra runtime dependencies at all beyond Next and React.

### Design

Dark theme, system font stack, mobile-first with desktop grid layouts. Only images are team flags from ESPN's CDN. No analytics, no cookies.

## Environment

`.env.local` (and Vercel project env):

```
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
RESEND_API_KEY=YOUR-RESEND-KEY   # optional, powers the issue report button
```

Both are server-side only and never exposed to the client. The app runs without them (matches work, sync and SBS link storage degrade gracefully), but set both for full functionality.

## Repo layout

```
src/app/                pages and route handlers
src/components/         match cards, panels, toggles, lineups
src/hooks/              polling and user state hooks
src/lib/                ESPN adapter, types, db, time, aliases, windows, words
supabase/schema.sql     run in Supabase SQL editor
.github/workflows/      SBS link discovery backstop
```
