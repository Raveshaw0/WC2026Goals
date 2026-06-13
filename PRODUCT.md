# Product

What WC26 Tracker does, page by page. For how it works underneath, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Navigation

Header tabs: **Schedule, Groups, Stats, Australia, Favourites**, plus a red flag report button and a settings gear. The nav row scrolls horizontally on narrow screens.

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

All 12 group tables (A to L): rank, flag, played, won, drawn, lost, goal difference, points. Refreshes every 5 minutes.

## Stats

Tournament leaders in three sub-tabs: **Top scorers**, **Assists**, **Discipline** (yellow and red card counts). ESPN-style shared ranks for ties. Refreshes every 15 minutes. Computed from match data; own goals and shootout kicks never count, penalty goals carry no assist.

## Match page

Score header (teams, flags, score, status or Melbourne kickoff, venue, shootout score when applicable) with **Follow team** buttons under each side, then watched/favourite actions, then four pill sub-tabs:

1. **Stats** (landing tab): the highlights embed sits on top once available, match stat bars below: possession, shots, shots on target, corners, fouls, offsides, cards, saves, crosses, pass completion, with the leading side highlighted
2. **Events**: LiveScore-style timeline: goals with scorer, assister and running score, yellow/red cards, substitutions (on/off), HT and FT rows
3. **Lineups**: starting XI with shirt numbers, positions and formation, bench below, sub on/off markers; "Lineups TBC, usually ~1hr before kickoff" until published
4. **Watch**: highlights embed on top, then **SBS links (requires SBS login)**: Highlights (3 min), Extended (12 min), Full Match buttons in that order, dimmed "soon" placeholders until each link lands, plus a prefilled SBS search fallback when none have. During the live window the tab shows a single prominent **Watch live on SBS** button that always works (falls back to the SBS World Cup hub until the per-match stream link is found)

Live behaviour: score updates every 4 seconds; events, stats and lineups poll every 60 seconds from 75 minutes before kickoff (so lineups appear as ESPN publishes them) until the live window closes (kickoff +150 minutes, +180 for knockouts). Clicking any SBS video link or playing embedded highlights auto-marks the match watched.

## Sync (no login)

- First visit mints a readable sync code (e.g. TIGER-42), shown in Settings
- Entering the code on another device merges that device's state in (union, nothing lost) and links them
- Watched, favourites and followed teams all sync; localStorage carries instant render and offline tolerance
- State survives redeploys; explicit untoggles propagate without resurrecting on merge

## Reporting

The red flag button opens "Something is broken?", which emails the report (with the page path) via Resend. Rate limited.

## Analytics (owner-only)

Invisible to visitors: a no-cookie beacon logs each page view (path, referrer, country, anonymous device id). The owner reads it at `/insights?key=...` (a key-gated dark dashboard: total / unique / returning visitors, LinkedIn referrals, per-day chart, top referrers, countries and pages) or `/api/insights?key=...` for JSON. Nothing links to either and both reject requests without the key. See ARCHITECTURE.md.

## Design

Dark theme, mint accent, system font stack, mobile-first with desktop grids. Only images are team flags from ESPN's CDN and YouTube thumbnails inside embeds. No analytics, no cookies, no cookie banner needed.
