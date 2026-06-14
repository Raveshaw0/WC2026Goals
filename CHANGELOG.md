# Changelog

The whole product was built on June 12-13, 2026 (day two of the tournament), in one extended session. Commit by commit:

## a1f6616 - The tracker

Full v1: Next.js 14 scaffold, ESPN adapter (scoreboard, summary, standings for group letters), home page with today's matches in Melbourne time, full schedule with All/Australia/Favourites filters, match pages with lineups, smart polling (4s in live windows, 5min idle, paused when hidden), Supabase tables, SBS link scraping with alias map, sync codes with union merging, watched/favourite toggles, stats panel with goals-seen maths, stale-data resilience. Deployed to Vercel with the wc2026 subdomain the same night.

## e50036d - SBS catalogue API

HTML scraping replaced after discovering the JSON API behind SBS's World Cup hub page (public x-api-key in their bundle). One fetch resolves live, highlights, extended highlights, full match and mini match links for every published match; live links appear days early. Match pages gained the three-button SBS row; finished cards gained a highlights button; stats panel added to the home page.

## 7bd9d10 - YouTube embeds and issue reports

SBS Sport mirrors short highlights to YouTube, which is embeddable (SBS On Demand is DRM gated). Discovery parses the channel's ytInitialData; matching is both-team-names plus "highlights", validated against SBS's own teams collection (all 42 teams resolve through the alias map). Highlights embed on match pages. Red flag report button emails issues via Resend.

## 696dec8 - Report wiring

Reports route to a dedicated Resend account; SBS links heading notes the login requirement.

## 795b209 - The big UX round

Card highlight pills open an in-app YouTube modal instead of linking out. Follow-team buttons on match pages; followed teams' games feed the Favourites view (new favourite_teams column). Home and schedule merged into one landing page; header tabs became Schedule/Australia/Favourites. The toggle flicker diagnosed and fixed (in-flight sync responses now merge with current local state instead of replacing it). Mobile sticky-hover killed via hoverOnlyWhenSupported.

## b1eb4ba - Polish round

Modal portaled to document.body (dimmed cards created a stacking context that trapped it behind later cards). Watched cards keep a bright badge and mint ring, dimming content only. Landing no longer scrolls past the stats panel: past days collapse behind a toggle instead. Kickoff countdowns on cards, updating every minute.

## cd094d3 - The LiveScore round

Match pages gained an events timeline (goals with assists and running score, cards, subs, HT/FT) and stat bars from ESPN's boxscore, polling every 60s from 75 minutes before kickoff. New Groups page (all 12 tables, 5 min refresh). New Stats page (top scorers, assists, discipline, 15 min refresh), computed from match data because no ESPN leaders endpoint exists for this league; output matches ESPN's published stats exactly.

## a3d7742 - Match page sub-tabs

Stats (landing, embed above the bars when available), Events, Lineups, Watch (embed plus SBS links), LiveScore style.

## f93b440 - Nav order

Schedule, Groups, Stats, Australia, Favourites.

## 56453fb - Docs

README, refreshed PRODUCT, new ARCHITECTURE and this changelog.

## cc9fa25 - Table sub-tab

Match pages gained a Table tab showing that group's standings with the two competing teams highlighted, via a GroupTable component shared with the groups page. Knockout matches (no group) skip the tab.

## Lineup pitch view

The Lineups tab now plots both starting XIs on a pitch (home top attacking down, away bottom attacking up), above the existing list. Positions are derived from ESPN's position abbreviations (G/RB/CD-L/AM-R/F...), which reconstruct the formation shape; formationPlace is only a tiebreak. Numbered markers (mint home, sky away) with surnames, drawn markings, formation labels. No player photos needed. Each marker carries a compact event caption matched from the events feed: ball + minute for goals (og/p flagged), yellow/red card chips + minute, and a red down-arrow + minute for players subbed off (dimmed). Tells the match story at a glance without clutter.

## In-game highlight clips (during the match)

Per-match goal/moment clips that appear during a live game, the thing LiveScore syndicates. Traced to SBS's "Blaze" stories platform (`blazesdk-prod-cdn.clipro.tv`, public key, label `aa-sbs-aus-wc26`); each story is a match with vertical MP4 clips hosted on sbs.com.au (no DRM). `src/lib/clips.ts` fetches the feed (60s revalidate), maps stories to fixtures by team aliases + match date, and exposes per-match clips. A prominent "Highlights" rail (with a LIVE badge) sits under the score on the match page and plays clips in our own story-style `<video>` popup, refreshing on the 60s match poll. The SBS editorial GraphQL API (`cms.sbs.com.au/graphql/delivery/sbscontentapi`) was investigated first and ruled out (only carries news/feature videos, no goal clips).

## Private visitor analytics

Lightweight first-party analytics, no cookies, no consent banner, nothing user-facing. A client beacon (`Beacon.tsx`, anonymous per-browser id, counts humans not bots) posts each view to `/api/track`, which writes to a shared `page_views` table (a `site` column separates wc26 from the landing site, which reuses the same setup and database). A secret `/api/insights?key=...` returns JSON and `/insights?key=...` renders a human dashboard (total / unique / returning / from-LinkedIn / 24h, per-day chart, top referrers / countries / pages). Returning = a device seen on 2+ distinct days. Gated by `INSIGHTS_KEY`; nothing links to either, wrong/absent key 404s the page and 403s the API.

## Favicon + scorers/events polish

Classic panel-ball favicon (`src/app/icon.svg`). Score card now lists each team's scorers with minutes (grouped per player, own goals and penalties flagged). Fixed the own-goal running score: ESPN credits the OG event to the benefiting team, so the earlier "flip for own goal" logic was double-counting to the wrong side (showed 0-1 instead of 1-0). Events tab now refreshes once on mount so back-navigation never shows a stale snapshot from Next's router cache. Event types are visually distinct: ball icon for goals (mint-tinted row + running score), yellow/red card chips, green/grey sub arrows.

## f2aa0f0, 287a511 - Favicon

Soccer ball favicon at `src/app/icon.svg` (App Router serves `icon.svg` automatically). Second iteration is the classic truncated-icosahedron panel ball: centre pentagon, five rim pentagons clipped by the sphere, seams. Verified legible at 32px before shipping.
