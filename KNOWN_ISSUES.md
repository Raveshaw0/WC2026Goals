# Known issues

## SBS auto-detection is best-effort, fallbacks are the primary path

Verified 2026-06-12: SBS On Demand search (`sbs.com.au/ondemand/search`) and the World Cup collection page are fully client-rendered SPAs. The server HTML contains no result titles, no watch links, no `__NEXT_DATA__` payload, and the legacy `api/v3` JSON endpoints now return the SPA shell. `/api/check-sbs` still runs its scrape attempts (HTML anchors, JSON-LD, embedded JSON heuristics) in case SBS ships server rendering or markup changes, but in practice per-match links are rarely discovered automatically.

Impact: low. The UI was built for this case per spec: the live button falls back to the SBS World Cup collection page and the highlights button falls back to a prefilled SBS search with both team names, so both buttons always work. If a working SBS JSON search endpoint is found later, drop it into `searchSbs()` in `src/app/api/check-sbs/route.ts` and everything downstream lights up.

Manual override: you can paste a URL directly into the `sbs_links` row in Supabase and the UI will use it.

## Rate limiting and throttles are per-instance

`/api/state` rate limiting (30 req/min/IP) and the `/api/check-sbs` self-throttle use in-memory maps. On Vercel, each serverless instance has its own map, so the effective limit is per instance, not global. Acceptable for a personal app; the DB-level `last_checked` gate on SBS checks holds regardless of instance count.

## ESPN API is unofficial

No SLA, shapes can change without notice. Mitigations: single adapter file (`src/lib/espn.ts`), defensive parsing that drops malformed events rather than crashing, last-good-response cache with a stale banner. If ESPN breaks entirely the app shows the last good data and the stale banner until it recovers.

## Schema deviation: per-type attempt counters

The spec defined a single `attempts` column but also required stopping after 20 attempts per match per link type. `supabase/schema.sql` therefore has `attempts_live` and `attempts_highlights` columns alongside `attempts` (kept as a total). One column could not satisfy the per-type cap.

## Penalty shootout scores

ESPN's scoreboard exposes a `shootoutScore` field on competitors in some seasons. Mapping is implemented defensively (shows when present), but no 2026 match has reached penalties yet, so the exact live shape is unverified until the round of 32.

## Group letters require a second endpoint

The scoreboard payload does not include group letters for group stage matches (only knockout placeholder names mention groups). The adapter fetches ESPN standings once per hour and joins team id to group. If the standings fetch fails, group badges are omitted but everything else renders.

## Stats exclude matches with missing data

Per spec: if a match is marked watched but ESPN data for it is unavailable, it is excluded from goals-seen maths rather than guessed. The watched count still includes it.
