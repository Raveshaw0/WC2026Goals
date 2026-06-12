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

SBS On Demand holds the Australian rights. Per-match URLs only exist once SBS publishes them, so `/api/check-sbs`:

- For matches kicking off within 90 minutes or currently live: searches SBS for a live stream page, stores `sbs_live_url`
- For matches finished within 48 hours with no highlights link and `last_checked` older than 15 minutes: searches for highlights, stores `sbs_highlights_url`
- Team names matched loosely via the alias map in `src/lib/aliases.ts` (Korea Republic vs South Korea, USA vs United States, Turkiye vs Turkey, etc.)
- Gives up after 20 attempts per match per link type (tracked in `attempts_live` / `attempts_highlights`; the spec's single `attempts` column is kept as a total but per-type caps required per-type counters)

Triggering: the home page fires a non-blocking call on load, and `.github/workflows/sbs-links.yml` curls the deployed endpoint every 15 minutes between 08:00 and 20:00 UTC as a backstop (Vercel Hobby crons are daily-only, so GitHub Actions does the scheduling).

The UI never depends on discovery succeeding: the live button falls back to the SBS World Cup collection page and the highlights button falls back to a prefilled SBS search, so both always work. See KNOWN_ISSUES.md for the current state of SBS scraping.

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
