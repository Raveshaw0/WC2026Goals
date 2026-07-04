# Product

What WC26 Tracker does, page by page. For how it works underneath, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Navigation

Header: the **WC26** logo (refreshes the page when you're already on the home view, navigates home from anywhere else), a **No spoilers** toggle pill, a red flag report button, and a settings gear. Below them the section tabs: **Schedule, Groups, Bracket, Stats, Australia, Favourites** (the row scrolls horizontally on narrow screens).

## Schedule (landing page)

- Full 104-match schedule grouped by Melbourne calendar date, kickoff order
- Loads with the **Your stats** panel up top (always expanded) and today's matches immediately below; days that have passed collapse behind a "Show earlier days" toggle
- **Match cards** show group letter or knockout round, flags, score or kickoff time with a live countdown ("5:00 am (kickoff in 1d 4h 23m)", updates every minute), and live status with the elapsed minute
- Live matches poll every 4 seconds; outside live windows the page refreshes every 5 minutes; polling stops entirely when the tab is hidden
- Finished matches gain a **3m highlights pill** that plays SBS's YouTube highlights in an in-app popup (and auto-marks the match watched), an eye toggle (watched) and a star toggle (favourite)
- Watched matches dim their content, keep a bright "Watched" badge, and get a mint outline
- **Australia** tab: the Socceroos' matches only
- **Favourites** tab: starred matches plus every match of followed teams

## Your stats panel

- Matches watched out of finished, with progress bar
- Goals seen: regular and extra time goals in watched matches (shootout kicks excluded), as a count and an animated percentage of all goals scored in the tournament so far
- Favourites count
- Matches missing ESPN data are excluded from goal maths rather than guessed

## Groups

All 12 group tables (A to L): rank, flag, played, won, drawn, lost, goal difference, points. Computed live from match results (not ESPN's slower standings feed), so a finished game shows in the table within about a minute. Ties are broken by the official 2026 rules (head-to-head before overall goal difference).

## Bracket

The knockout tree as a classic two-sided bracket: the round of 32 down each outer edge, converging through the round of 16, quarter-finals and semi-finals to the **Final** in the centre, with the **third-place** match pinned just below it. Connector lines run from every match to the two it feeds. On a phone it scrolls sideways and opens centred on the final; on a wide screen more of the tree is visible at once.

- Each match cell shows both flags, three-letter team codes, and the score, with the winner highlighted
- Undecided slots read as their feeder ("R16 M1 winner", "SF1 winner") and fill in with the real team the moment ESPN resolves the match
- Live knockout matches carry a pulsing dot and update on the same live poll as the rest of the app; the champion is flagged under the final once it's played
- **No spoilers** is respected: with the pill on, a slot stays a feeder placeholder until you reveal the result that fills it, and every score hides behind the same tap-to-reveal cover used elsewhere, so the bracket never gives away who advanced
- Tapping a match opens its full match page

Built from the same match data as everything else (no separate feed); the fixed tournament wiring lives in `src/lib/bracket.ts` and is re-checked against live results on every render.

## Stats

Tournament leaders in three sub-tabs: **Top scorers**, **Assists**, **Discipline** (yellow and red card counts). ESPN-style shared ranks for ties. Refreshes every 15 minutes. Computed from match data; own goals and shootout kicks never count, penalty goals carry no assist.

## Match page

A sticky **sub-tab bar** (Stats / Events / Lineups / Table / Watch) sits at the very top, translucent with a thin mint border, so it's clear which tab you're on and the tabs stay reachable while scrolling. Below it the **score card**, consistent across every tab: teams, flags, score, scorers with minutes, status or Melbourne kickoff, venue, shootout score when applicable. A small **follow** star sits beside each flag, and **watched** (finished matches) and **favourite** icons tuck into the card's top-right corner. The live minute ticks smoothly (interpolated client-side between polls, since ESPN's clock only updates in chunks); stoppage and HT show verbatim. During the live window a prominent **Watch live on SBS** button sits right under the score on every tab. The five sub-tabs:

1. **Stats** (landing tab): the in-game highlights rail on top during the match (replaced post-match by SBS's full YouTube highlights embed, no two highlight sets), then the match stat bars: possession, shots, shots on target, corners, fouls, offsides, cards, saves, crosses, pass completion, with the leading side highlighted
2. **Events**: LiveScore-style timeline: goals with scorer, assister and running score, yellow/red cards, substitutions (on/off), HT and FT rows
3. **Lineups**: both starting XIs plotted on a **pitch** (home top, away bottom) laid out from the real formation, numbered markers with surnames and per-player event icons (goal/cards/sub with minutes), above the full lineup list, which also shows the minute each substitute came on or off; "Lineups TBC, usually ~1hr before kickoff" until published
4. **Table**: that match's group standings, both teams highlighted (group-stage matches only)
5. **Watch**: highlights embed on top, then **SBS links (requires SBS login)**: Highlights (3 min), Extended (12 min), Full Match buttons in that order, dimmed "soon" placeholders until each link lands, plus a prefilled SBS search fallback when none have. During the live window the tab shows a single prominent **Watch live on SBS** button that always works (falls back to the SBS World Cup hub until the per-match stream link is found)

Live behaviour: score updates every 4 seconds; events, stats, lineups and clips poll every 60 seconds from 75 minutes before kickoff (so lineups appear as ESPN publishes them) until the live window closes (kickoff +150 minutes, +180 for knockouts), and refresh immediately when the tab regains focus. Clicking any SBS video link or playing embedded highlights auto-marks the match watched.

## In-game highlights

Per-match goal and key-moment clips, published by SBS during and after the match (the same feed LiveScore syndicates). They appear in a **Highlights rail** on the Stats and Watch tabs with a LIVE badge while the game is on, refreshing as new clips drop. On the Stats tab the rail steps aside once SBS's full YouTube highlights video is embedded post-match (it stays on the Watch tab). Tapping one opens a full-screen story-style player (vertical video) with prev/next edge buttons, swipe, and keyboard arrows; the hardware Back button closes it. Clips are plain MP4s played in our own player. The clips show SBS's own on-screen score, which is intended (you're watching to see the goals).

## No spoilers

A header toggle (default off, remembered) hides every result in our own UI behind tap-to-reveal covers with a dissolve: match-card scores, the match detail score, scorers, events, stats and the goal markers on the pitch, plus group tables and the stats leaderboards. Revealing is per-match (one tap unlocks a match's score + scorers + events + stats + pitch goals together) or per-section (tables, stats). Status labels (LIVE/HT/FT/kickoff) stay visible so you still know what's on. Highlights clips are deliberately untouched, so the spoiler-averse can watch the goals unfold before learning the final score. No score flashes on load.

## Sync (no login)

- First visit mints a readable sync code (e.g. TIGER-42), shown in Settings with a one-tap Copy button (and the whole code is selectable on a double-click despite the hyphen)
- Entering the code on another device merges that device's state in (union, nothing lost) and links them
- Watched, favourites and followed teams all sync; localStorage carries instant render and offline tolerance
- State survives redeploys; explicit untoggles propagate without resurrecting on merge

## Reporting

The red flag button opens "Something is broken?", which emails the report (with the page path) via Resend. Rate limited.

## Analytics (owner-only)

Invisible to visitors: a no-cookie beacon logs each page view (path, referrer, country, anonymous device id). The owner reads it at `/insights?key=...` (a key-gated dark dashboard: total / unique / returning visitors, LinkedIn referrals, per-day chart, top referrers, countries and pages) or `/api/insights?key=...` for JSON. Nothing links to either and both reject requests without the key. See ARCHITECTURE.md.

## Design

Dark theme, mint accent, system font stack, mobile-first with desktop grids. A darkened celebration photo (Irankunda's goal v Türkiye) sits fixed behind every page; content cards are opaque so legibility is unaffected. Images are that backdrop, team flags from ESPN's CDN, and YouTube thumbnails inside embeds. No analytics cookies, no cookie banner needed.
