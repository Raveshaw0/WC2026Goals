# Architecture

How WC26 Tracker works underneath. For what it does, see [PRODUCT.md](PRODUCT.md).

## Principles

- **The browser never talks to a data source.** Everything proxies through Next.js route handlers and server components, so caching is controlled in one place and sources can be swapped.
- **All source schema knowledge lives in one adapter per source.** ESPN parsing is entirely inside `src/lib/espn.ts`; the rest of the app only sees internal types from `src/lib/types.ts`.
- **Degrade, never crash.** Upstream failures serve the last good response with a stale banner. Missing env vars disable features, not pages.
- **One upstream call no matter how many clients.** Server-side fetch revalidation makes N pollers cost one ESPN request per interval.

## Data sources

### ESPN unofficial API (scores, events, stats, standings)

| Endpoint | Used for | Revalidate |
|---|---|---|
| `scoreboard?dates=20260610-20260720&limit=200` | All 104 matches, scores, status, goal/card details | 300s |
| `scoreboard?dates=<rolling 3-day UTC window>` | Live polling source | 4s |
| `summary?event=ID` | Lineups, key events (timeline + assists), boxscore stats | 30s live, 86400s finished (immutable) |
| `apis/v2/.../standings` | Group letters + group tables (note: `apis/v2`, not `apis/site/v2`) | 300s |

Mapping notes learned the hard way:

- Group letters are NOT on scoreboard events; they come from joining standings by team id
- `keyEvents` goal participants are `[scorer, assister]`; substitution participants are `[on, off]` ("X replaces Y")
- Goal `details` carry `penaltyKick`, `ownGoal`, `shootout` flags; the stats maths excludes shootout kicks and the scorer chart excludes own goals
- A Melbourne "day" straddles two UTC days, so the live window fetch spans yesterday to tomorrow UTC

### Tournament leaders are computed, not fetched

No ESPN leaders endpoint works for `fifa.world` (`statistics/byathlete` returns an empty shell). Instead: scorers and discipline tallies come from the one cached scoreboard call (near-live), assists from per-match summary participant pairs. Finished summaries cache for a day (events are immutable), so the cost amortises to nothing. Output was validated identical to ESPN's own published stats page.

### SBS catalogue API (per-match watch links)

SBS On Demand's pages are fully client-rendered, but the World Cup hub page is backed by JSON: `catalogue.pr.sbsod.com/pages/fifa-world-cup-2026` with the public `x-api-key` baked into SBS's own browser bundle. One fetch returns named rails (Live & Upcoming, Highlights, Extended Highlights, Full Matches, Mini Matches); items map to `sbs.com.au/ondemand/watch/{mpxMediaID}`. Live links appear days before kickoff.

### SBS Sport YouTube channel (embeddable highlights)

SBS mirrors the short highlights cut to youtube.com/@SBSSportau, which CAN be embedded (SBS On Demand itself is DRM and login gated, links only). Discovery parses `ytInitialData` from the channel's Videos page (currently `lockupViewModel` items). The channel only lists ~30 recent uploads, so discovery must run within days of each match; stored ids are never deleted.

### SBS Blaze stories (in-game highlight clips)

The per-match goal/moment clips (what LiveScore syndicates) come from SBS's "Blaze" stories platform, not the catalogue or YouTube. `src/lib/clips.ts` fetches `blazesdk-prod-cdn.clipro.tv/api/blazesdk/v1.3/stories?ApiKey=<public>&labelsFilterExpression=aa-sbs-aus-wc26&maxItems=50` (works server-side, no referer). `result[]` is one story per match (`title` "Brazil vs. Morocco", `description` carrying date/group, `isLive`, `pages[]` clips). Each clip's `pages[].baseLayer.content.renditions[]` is a plain vertical MP4 on sbs.com.au (no DRM, range-supported, plays in our own `<video>`). Stories map to fixtures by team aliases (title split on " vs. ") **plus the match date** (description `dd-mm-yy` within ~1 day of kickoff UTC), which both disambiguates repeated fixtures and excludes the 2022 demo stories sitting in the feed. The SBS editorial GraphQL (`cms.sbs.com.au/graphql/delivery/sbscontentapi`) was introspected and ruled out, it only carries news/feature videos. Clips ride the 60s match poll via `/api/match/[id]`.

### Title matching

Rail and video titles match a fixture when both team names appear (via the alias map in `src/lib/aliases.ts`: Korea Republic vs South Korea, Turkiye vs Turkey, Cote d'Ivoire vs Ivory Coast, etc.), plus the word "highlights" for YouTube. No dependence on title structure, so knockout-round retitling cannot break it. The alias map was validated against SBS's own teams collection: all 42 announced teams resolve.

## Discovery pipeline (`/api/check-sbs`)

Runs the hub fetch + YouTube parse, upserts per-match links into `sbs_links`. Never overwrites a stored link with null (videos age off rails but stay watchable). Triggered lazily by every schedule page load (self-throttled to one pass per 5 minutes per instance) and by `.github/workflows/sbs-links.yml` every 15 minutes (08:00 to 20:00 UTC) as a backstop, because Vercel Hobby crons are daily-only.

## Live polling model

Live window = kickoff minus 5 minutes to kickoff plus 150 minutes (180 for knockouts). Derived from the schedule, never blind.

- Schedule page: `/api/live` every 4s while any window is open, else every 5 minutes; `visibilitychange` stops polling entirely when hidden
- Match page: the same 4s score poll, plus `/api/match/[id]` (events, stats, lineups, clips) every 60s from kickoff minus 75 minutes (lineups publish ~1hr out) until the window closes, and an immediate refresh on `visibilitychange`
- Groups and Stats pages are ISR: regenerated server-side at most every 300s / 900s
- The displayed live **minute** is interpolated client-side (`useLiveMinute`): ESPN's `clock` (seconds) only changes in chunks, so we tick locally each second and re-anchor on every poll; stoppage ("45'+3'") and HT are shown verbatim

## Lineup pitch

`src/components/LineupPitch.tsx` plots both XIs. Each starter's vertical band (GK / defence / DM / midfield / attacking-mid / forward) and left-right rank are derived from the ESPN position abbreviation (`G`, `RB`, `CD-L`, `AM-R`, `F`, ...); `formationPlace` is only a tiebreak because it is **not** line-ordered. Home occupies the top, away the bottom, each team's rows pulled back from the halfway line so the attacking lines don't collide. Per-player event icons (goal/cards/sub with minutes) are matched from the events feed by player name. No player photos, numbers only.

## No-spoilers mode

`src/hooks/useSpoiler.tsx` holds `noSpoilers` plus revealed match-ids and section-keys, persisted to `localStorage` (`wc26.spoiler.v1`). Read in a **pre-paint layout effect** so a spoiler-free visitor never sees a score flash (server + first client render show scores, matching; the effect flips to hidden before paint). `src/components/SpoilerCover.tsx` wraps any score/result: when hidden it shows an opaque cover with a reveal affordance and dissolves on tap (works inside links via `preventDefault`). Wired into match cards, the match detail score/scorers/events/stats, the pitch goal markers (`hideGoals` prop), group tables and the stats leaderboards. Reveal is per-match (shared `matchId`) or per-section (`tables`, `stats`).

## Sync model (no accounts)

Two Supabase tables (`supabase/schema.sql`), accessed server-side only through PostgREST with the service role key (no Supabase client library; RLS enabled with no policies, so only the service role can touch anything).

- `user_state`: sync_code (word + two digits, minted server-side with collision retry) -> watched, favourites, favourite_teams (jsonb arrays of ESPN ids)
- `user_state` also has `favourite_teams` (followed teams feed the Favourites view)
- `sbs_links`: match_id -> kickoff metadata, the SBS/YouTube link columns (live/highlights/extended/full/mini + `yt_highlights_id`), attempt counters

Merge semantics, the part that bit us:

- All merging is **union plus explicit removal lists**. Untoggles travel as `removed*` arrays; a plain union would resurrect them on every reconciliation
- Sync responses are **merged into current local state, never replace it**, with an in-flight guard. A response landing after a newer tap used to visually revert the toggle for a beat (the flicker bug)
- localStorage key (`wc26.state.v1`) is constant across deploys

## Visitor analytics (private, first-party)

No third party, no cookies, no consent banner, nothing user-facing.

- `Beacon.tsx` (client, in the root layout) fires once per navigation via `navigator.sendBeacon` to `/api/track`, sending path, `document.referrer`, and a stable random id kept in localStorage (`wc26.vid`). Client-side on purpose: it counts JS-executing humans, not the bots that crawl any public URL.
- `/api/track` stamps the country from Vercel's `x-vercel-ip-country` header and inserts a row into `page_views`. Fire-and-forget; any failure is swallowed.
- `page_views` table: `ts, site, path, referrer, visitor, country`. The `site` column (`wc26` here, `landing` on the landing site) lets one table and one Supabase project serve both sites.
- `computeInsights(site, days)` in `src/lib/insights.ts` aggregates: total views, unique visitors (distinct ids), returning (ids seen on 2+ distinct days), last-24h, LinkedIn referrals, and top referrers/countries/pages plus a per-day series.
- `GET /api/insights?key=...&days=N` returns that as JSON; `/insights?key=...` renders it as a dark dashboard (`InsightsPanel.tsx`). Both gated by `INSIGHTS_KEY`; the page 404s and the API 403s without it. Nothing links to either.

Caveat: uniqueness is per-browser-localStorage, so cleared storage, incognito, or a different device/browser reads as a new visitor. Fine for "are real people visiting and returning".

## Resilience

`cachedJson()` in the ESPN adapter keeps the last good payload per endpoint in module scope; failures serve it with `stale: true` and the UI shows a "data may be stale" banner with the last updated time. Malformed events are dropped individually rather than failing the batch. Rate limits (`/api/state` 30/min/IP, `/api/report` 5/min/IP) are in-memory per instance; the DB-level gates hold globally.

## UI gotchas encoded in the code

- Video popups render through `createPortal(document.body)`: dimmed (opacity) cards create stacking contexts that trap fixed overlays
- `useBackToClose` (used by the clip player and YouTube modal) pushes a throwaway history entry so the hardware Back button closes the overlay instead of navigating; closing via the UI pops the entry back off
- Tailwind `future.hoverOnlyWhenSupported` plus transparent `-webkit-tap-highlight-color`: without these, mobile taps leave buttons stuck in hover state
- Countdown and live-minute text render client-side after mount only, so server HTML never disagrees with the client clock (hydration); the no-spoilers flag uses the same pre-paint pattern
- The only external images are ESPN flags, SBS clip thumbnails, and YouTube embeds

## Open Graph share card

`src/app/opengraph-image.tsx` (`next/og` ImageResponse, edge runtime) renders the share card with the adidas Trionda ball (background removed via a sharp circular mask, base64-inlined in `src/app/ballData.ts`). `metadataBase` in `layout.tsx` makes the image URL absolute. Without this, scrapers grabbed the first on-page image (a team flag).

## Deployment

Vercel project `wc26-tracker` (functions pinned to syd1 via `vercel.json`), git-connected to `Raveshaw0/WC2026Goals` for auto-deploy on push. Custom domain `wc2026.alextestingstuff.com` via CNAME to `cname.vercel-dns.com` at VentraIP. Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (optional, report button), `INSIGHTS_KEY` (gates the analytics dashboard/endpoint), with `REPORT_TO_EMAIL` / `REPORT_FROM_EMAIL` overrides available. The landing site (`alextestingstuff.com`) runs the same analytics code with `site="landing"`, pointing `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` at this same project and sharing the `INSIGHTS_KEY`.
