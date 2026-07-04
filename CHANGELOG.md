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

## No-spoilers mode

A "No spoilers" toggle in the header (default off, persisted locally) hides all of our own results behind tap-to-reveal covers: match-card scores, the match detail score and scorers, the events timeline, goal markers on the lineup pitch, group tables and the stats leaderboards. Reveal is per-match (one tap unlocks a match's score + scorers + events + pitch goals together) or per-section (tables, stats), with a dissolve animation. Status labels (LIVE/HT/FT/kickoff) stay visible. Highlights clips are deliberately left untouched, the whole point is watching them to see the goals before knowing the final. No score flashes on load: the preference is read in a pre-paint layout effect. Also: tapping the WC26 logo refreshes when already on the home view, navigates home otherwise.

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

## a0c31ba, e21e09f - Open Graph share card

Social shares were pulling a random team flag (no designated image). Added metadata + a generated OG card (`src/app/opengraph-image.tsx` via `next/og`) reading "FIFA WORLD CUP 2026 Tracker" with the real adidas Trionda match ball, its background stripped via a sharp circular mask and inlined as base64 (`src/app/ballData.ts`). `metadataBase` set so the URL resolves absolutely. (LinkedIn caches scrapes; use its Post Inspector to refresh.)

## 4e52dac - Live polish

Pseudo-live ticking match minute on the detail page: ESPN's clock only changes in ~minute chunks even when polled every 4s, so we interpolate locally (`useLiveMinute`) and re-anchor on each poll, with stoppage time and HT shown verbatim. A prominent "Watch live on SBS" button now also sits on the landing tab during the live window. Events/stats refresh the instant the tab regains focus (returning from the SBS stream).

## 6e8af68, 5c95e74 - In-game highlight clips

Per-match goal/moment clips during a live game (the thing LiveScore syndicates), traced to SBS's Blaze stories platform (`blazesdk-prod-cdn.clipro.tv`, public key, label `aa-sbs-aus-wc26`); each story is a match with plain vertical MP4s on sbs.com.au (no DRM). `src/lib/clips.ts` fetches the feed, maps stories to fixtures by team aliases + match date (date guard excludes 2022 demo stories). A "Highlights" rail with a LIVE badge sits under the score and plays clips in our own story-style player (edge prev/next chevrons, swipe, keyboard). SBS's editorial GraphQL (`cms.sbs.com.au`) was introspected and ruled out (news/feature videos only).

## c547d4b - Back button closes video popups

`useBackToClose` makes the hardware/browser Back button close an open video overlay (clip player, YouTube modal) instead of navigating away, via a throwaway history entry; closing through the UI cleans the entry up.

## Lineup pitch + event overlay

The Lineups tab plots both starting XIs on a pitch. Positions come from ESPN's position abbreviations (band heuristic + left/right rank; `formationPlace` is only a tiebreak since it isn't line-ordered). Numbered markers (mint home top, sky away bottom) with surnames that truncate to avoid clashing. Per-player event overlays matched from the events feed: a panel soccer-ball goal icon + minute (og/p flagged), yellow/red card chips, a red down-arrow for subbed-off players (dimmed). Desktop pitch capped at 460px so it stays proportionate; the field is tall enough (aspect 5/9, each team's rows pulled back from the halfway line) that the two attacking lines never collide.

## 60cdbd8, 0a566a3 - No-spoilers mode

A "No spoilers" header toggle (default off, persisted) hides all of our own results behind tap-to-reveal covers with a dissolve: match-card scores, the match detail score/scorers/events/stats, goal markers on the pitch, group tables and the stats leaderboards. Reveal is per-match (one tap unlocks a match's score + scorers + events + stats + pitch goals) or per-section (tables, stats). Status labels (LIVE/HT/FT/kickoff) stay visible; highlights clips are deliberately left untouched (the point is watching the goals before knowing the final). No score flash on load (preference read in a pre-paint layout effect). Also: the WC26 logo refreshes when already on the home view, navigates home otherwise.

## fb06c1a - Sync code copy button

The sync code in Settings gained a one-tap Copy button (writes to the clipboard, flips to "Copied" briefly), and the code itself is now `select-all` so a double-click grabs the whole `TIGER-42` instead of the hyphen splitting it in two.

## 4b82a74, b81db21 - Live group tables + lineup sub minutes

Group standings are now computed from finished match results instead of ESPN's standings endpoint, which lagged full time by many minutes (it showed teams on zero played well after a final whistle). `/groups` renders dynamically and the scoreboard cache dropped to 60s, so a result reaches the table within about a minute. Tiebreakers follow the official 2026 order, which reversed from 2022: head-to-head (points, goal difference, goals among the tied teams) is applied before overall goal difference, re-applied recursively to any subset still level; the disciplinary and FIFA-ranking steps aren't in our data, so they fall back to team name. The Lineups list also now shows the minute each substitute came on or off, read from the substitution events (the pitch already had them).

## 2d296c4, 3c45a35 - Formation-accurate lineup pitch

The pitch previously inferred each player's band from ESPN's coarse position code (only `G`/`D`/`M`/`F`), which collapsed every midfielder into one row (a 4-2-3-1's holding pair and attacking three rendered as a single line of five). ESPN.com instead lays players out from the formation string plus each player's `formationPlace` slot index, paired with formation templates baked into its frontend. We now do the same: single-midfield shapes from the coarse labels, stacked-midfield shapes (4-2-3-1, 3-4-2-1) from a per-formation template that encodes both each slot's band and its true left-to-right column (ESPN's slot order is neither line-ordered nor left-to-right by number), with the home side mirrored since it attacks downward. The old heuristic stays as a fallback for untemplated formations. Closer to ESPN/LiveScore but not yet a perfect match (see KNOWN_ISSUES.md).

## 4053ea1, 3228a11 - Celebration backdrop

A darkened photo of Irankunda's goal against Türkiye sits fixed behind every page (`PhotoBackground` in the root layout). A vertical-gradient overlay keeps it dark enough to read over, with the scorer visible through the middle band; content cards are opaque so readability is unaffected. Purely cosmetic.

## 8be30a5, 57777ea - Match page layout

The sub-tab pills moved above the score and became a sticky, translucent, mint-bordered bar, so it's clear which tab you're on and the tabs stay reachable while scrolling (they used to sit at the bottom, where you couldn't tell it was a stats page). Mark-watched and favourite collapsed into icons in the score card's top-right corner, and follow-team became a single star beside each flag with no wording, which shrinks the card so the stats sit higher. The in-game clip reel now shows only on the Stats and Watch tabs, and on Stats it yields to SBS's full YouTube highlights embed once that lands (no two highlight sets). The Watch-live SBS button stays prominent on every tab.

## 7d69849, 7410561 - Knockout period states and penalty shootout takers

Two gaps surfaced once round-of-32 ties went to extra time and penalties. The live match minute ran away during the mid-match breaks: `mapStatus` folded every in-progress state into "live", so at the end of regulation, where ESPN freezes its clock at 90:00, the local minute interpolation kept climbing past it (91', 92', ...) instead of naming the phase. A new `"break"` match status now covers the knockout pauses (end of regulation, extra-time half-time, the gap before a shootout), each with a clear label (End of 90', ET half-time, End of extra time, Penalties) matched from ESPN's soccer status-name family. Only the actively-running halves (including the two extra-time halves) tick, and `useLiveMinute` clamps its interpolation drift as a backstop so a frozen clock can never run away.

Penalty takers were invisible because ESPN keeps the shootout out of `keyEvents`, in a dedicated top-level `shootout` array (one entry per team, an ordered list of takers with a `didScore` flag). That is now parsed into the match summary (`mapShootout`) and rendered as a Penalty shootout panel pinned atop the Events tab (`ShootoutPanel`): home and away takers aligned round by round with scored/missed marks, a bold order number down the centre so the taker order reads at a glance, and the pens score derived from the marks. Parsing and the home/away mapping were verified against the GER v PAR and NED v MAR shootouts.

## Knockout bracket

A new **Bracket** page (`/bracket`, tab between Groups and Stats) draws the classic two-sided knockout tree: round of 32 down each outer edge, converging through the round of 16, quarters and semis to the final in the centre, with the third-place match pinned below it. It scrolls sideways on a phone (opening centred on the final), and pure-CSS connector lines run between every match and its two feeders (each line reaches half a column-gap so a feeder's forward stub and its child's back stub meet in the middle; the tree height is fixed to the round-of-32 column and `flex-1` cells centre every match on the midpoint of its two feeders with no per-cell maths).

No new data source: the tree is derived from the same tournament scoreboard we already poll (`fetchAllMatches`), so results and live scores fill in on the existing 60s server render plus the client live-poll. ESPN tags every knockout match by round with real teams once decided and placeholder names ("Round of 16 1 Winner") while undecided, but never the bracket linkage, so `src/lib/bracket.ts` encodes the fixed WC2026 wiring once (which R32 feeds which R16, up through the final) and binds ESPN's matches into it by round and kickoff order. The feeder maps were reconstructed from the live feed: R32 winners traced into their R16 slots by team identity, the upper rounds read off ESPN's own placeholder names. `buildBracket` re-verifies the whole chain against live results on every render (each decided slot's two teams must be the winners, or losers for third place, of its feeders), so a wrong map or an ESPN renumbering surfaces a warning line instead of drawing a silent lie.

No-spoilers is respected: a downstream slot stays a feeder placeholder ("R16 M1 winner") until you reveal the result that fills it, and every score sits under the same tap-to-reveal cover used elsewhere, so opening the bracket with no-spoilers on never gives away who went through. The final shows a small Champion flourish once it's decided and revealed.
