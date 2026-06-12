# Known issues

## SBS link discovery uses an undocumented catalogue API

HTML scraping was abandoned 2026-06-12 (the SBS pages are fully client-rendered; see git history for the original attempt). `/api/check-sbs` now fetches `catalogue.pr.sbsod.com/pages/fifa-world-cup-2026`, the JSON document behind SBS's own World Cup hub page, using the public `x-api-key` baked into SBS's browser bundle. One fetch resolves live, highlights, extended highlights, full match and mini match links for every published match at once.

Risks: the API is undocumented, and the key or the hub slug could change. Mitigations: the UI never depends on discovery (live button falls back to the SBS hub page, finished matches get a prefilled search link until buttons activate), and stored links are never overwritten with nulls when a video drops off a rail. If it breaks, grab the new key from the page bundle (grep the chunk files for `x-api-key`).

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
