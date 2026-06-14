# Known issues

## SBS link discovery uses an undocumented catalogue API

HTML scraping was abandoned 2026-06-12 (the SBS pages are fully client-rendered; see git history for the original attempt). `/api/check-sbs` now fetches `catalogue.pr.sbsod.com/pages/fifa-world-cup-2026`, the JSON document behind SBS's own World Cup hub page, using the public `x-api-key` baked into SBS's browser bundle. One fetch resolves live, highlights, extended highlights, full match and mini match links for every published match at once.

Risks: the API is undocumented, and the key or the hub slug could change. Mitigations: the UI never depends on discovery (live button falls back to the SBS hub page, finished matches get a prefilled search link until buttons activate), and stored links are never overwritten with nulls when a video drops off a rail. If it breaks, grab the new key from the page bundle (grep the chunk files for `x-api-key`).

Manual override: you can paste a URL directly into the `sbs_links` row in Supabase and the UI will use it.

## YouTube highlights discovery parses ytInitialData

The embedded highlights player on match detail pages comes from SBS Sport's YouTube channel (@SBSSportau). Discovery parses the `ytInitialData` JSON inside the channel's Videos page, currently shaped as `lockupViewModel` items. YouTube reshapes this periodically (it changed from `videoRenderer` to `lockupViewModel` sometime before June 2026). Matching is on both team names plus the word "highlights" in the title, so SBS retitling for knockout rounds will not break it, but a YouTube markup change would. If embeds stop appearing for new matches while SBS links still work, the parser in `fetchYoutubeHighlights()` is the suspect. The channel only lists ~30 recent uploads, so discovery must run within a few days of each match (the 15-minute GitHub Action makes this a non-issue in practice). Stored ids are never deleted.

## In-game clips use an undocumented Blaze feed

The Highlights rail / clip player pull from SBS's "Blaze" stories platform (`blazesdk-prod-cdn.clipro.tv`, label `aa-sbs-aus-wc26`, public key). Undocumented: the key, label, or response shape could change. Mitigations: failure just hides the rail (nothing else breaks), and clips fall back to nothing rather than erroring. If clips stop appearing, re-capture the request from SBS's `stories-carousel-*.html` widget (it loads `sdk.mvp.fan` then calls the clipro endpoint). Clips show SBS's own on-screen scorebug, this is intentional and not masked (you watch highlights to see the goals).

## Lineup pitch positions are reconstructed, not exact

ESPN's API gives no pitch coordinates, only coarse `G`/`D`/`M`/`F` codes plus a `formationPlace` slot index, so the pitch is rebuilt from the formation string the way ESPN.com does it (`LineupPitch.tsx`): coarse labels for single-midfield shapes, a per-formation template (`FORMATION_TEMPLATES`) for stacked-midfield shapes like 4-2-3-1. It is much closer than the old abbreviation heuristic (the holding pair and attacking line no longer merge into one row), but it is **not** a pixel-perfect match to ESPN/LiveScore and is known to still look slightly off in places. A stacked formation with no template yet falls back to the old merged-midfield look until its template is added (recipe: read the slots left-to-right off a correct ESPN render and add a row to `FORMATION_TEMPLATES`). Cosmetic only; the full lineup list below the pitch is authoritative.

## Group standings tiebreakers stop short of the full FIFA rules

Tables are computed from results (ESPN's standings feed lags full time badly). Ties follow the official 2026 order through head-to-head and overall goals, but the final two official tiebreakers, disciplinary/conduct points then FIFA ranking, need data we don't collect, so two teams identical through overall goals scored fall back to alphabetical order. Vanishingly rare and only ever a cosmetic ordering of already-decided rows; if it ever genuinely decided qualification it would need the real disciplinary data.

## No-spoilers is best-effort, not airtight

Hidden scores are rendered then covered by an opaque overlay (so the dissolve works), meaning the number exists in the DOM, view-source would reveal it. Fine for a casual "don't show me the result" feature, not a security boundary. The pre-paint layout effect prevents the on-screen flash for normal navigation.

## Issue reports require RESEND_API_KEY

The "Something is broken" button posts to `/api/report`, which emails alexanderlukic84@gmail.com via a dedicated Resend account (sending from onboarding@resend.dev to the account's own inbox needs no domain verification; override with REPORT_TO_EMAIL / REPORT_FROM_EMAIL if a domain is verified later). Without `RESEND_API_KEY` set, the endpoint returns 503 and the UI shows "Could not send".

## Rate limiting and throttles are per-instance

`/api/state` rate limiting (30 req/min/IP) and the `/api/check-sbs` self-throttle use in-memory maps. On Vercel, each serverless instance has its own map, so the effective limit is per instance, not global. Acceptable for a personal app; the DB-level `last_checked` gate on SBS checks holds regardless of instance count.

## ESPN API is unofficial

No SLA, shapes can change without notice. Mitigations: single adapter file (`src/lib/espn.ts`), defensive parsing that drops malformed events rather than crashing, last-good-response cache with a stale banner. If ESPN breaks entirely the app shows the last good data and the stale banner until it recovers.

## Schema deviation: per-type attempt counters

The spec defined a single `attempts` column but also required stopping after 20 attempts per match per link type. `supabase/schema.sql` therefore has `attempts_live` and `attempts_highlights` columns alongside `attempts` (kept as a total). One column could not satisfy the per-type cap.

## Penalty shootout scores

ESPN's scoreboard exposes a `shootoutScore` field on competitors in some seasons. Mapping is implemented defensively (shows when present), but no 2026 match has reached penalties yet, so the exact live shape is unverified until the round of 32.

## Group letters require a second endpoint

The scoreboard payload does not include group letters for group stage matches (only knockout placeholder names mention groups). The adapter fetches ESPN standings once per hour and joins team id to group. (The group **tables** are computed from results, not read from this endpoint; it is used only for the id-to-letter map.) If the standings fetch fails, group badges are omitted but everything else renders.

## Visitor analytics counts are approximate

Unique/returning visitor counts key off a random id in the browser's localStorage (no cookies, no IP storage). Clearing storage, incognito mode, or visiting from another device/browser all read as a new visitor, so uniques skew slightly high and returns slightly low. The owner dashboard lives at `/insights?key=INSIGHTS_KEY` (key not in the repo; it's an env var). Good enough for gauging real interest, not a billing-grade analytics product.

## Stats exclude matches with missing data

Per spec: if a match is marked watched but ESPN data for it is unavailable, it is excluded from goals-seen maths rather than guessed. The watched count still includes it.
