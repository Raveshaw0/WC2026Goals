import "server-only";

import type {
  Goal,
  GroupStanding,
  LeaderRow,
  LeadersPayload,
  LineupPlayer,
  Match,
  MatchEvent,
  MatchStatPair,
  MatchStatus,
  MatchSummary,
  Round,
  StandingRow,
  TeamLineup,
  TeamSide,
} from "./types";

// All ESPN schema knowledge lives in this file. Everything is parsed
// defensively: a malformed event is dropped, a failed fetch serves the last
// good response with stale=true. Nothing here ever throws to a page.

const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
// Standings live under apis/v2, not apis/site/v2.
const STANDINGS_URL =
  "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings";
// Tournament runs 2026-06-11 to 2026-07-19; pad a day each side.
const TOURNAMENT_RANGE = "20260610-20260720";

const UA = "wc26-tracker/1.0 (personal World Cup tracker)";

interface CacheSlot<T> {
  data: T;
  lastUpdated: string;
}

// Last good responses, module scope. Survives across requests on a warm
// serverless instance; on a cold instance the first successful fetch fills it.
const lastGood = new Map<string, CacheSlot<unknown>>();

export interface FetchResult<T> {
  data: T | null;
  stale: boolean;
  lastUpdated: string;
}

async function cachedJson<T>(
  url: string,
  revalidate: number,
  cacheKey: string,
  validate: (raw: unknown) => T
): Promise<FetchResult<T>> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate },
    });
    if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
    const raw = (await res.json()) as unknown;
    const data = validate(raw);
    const slot: CacheSlot<T> = { data, lastUpdated: new Date().toISOString() };
    lastGood.set(cacheKey, slot);
    return { data, stale: false, lastUpdated: slot.lastUpdated };
  } catch (err) {
    console.error(`[espn] fetch failed (${cacheKey}):`, err);
    const slot = lastGood.get(cacheKey) as CacheSlot<T> | undefined;
    if (slot) {
      return { data: slot.data, stale: true, lastUpdated: slot.lastUpdated };
    }
    return { data: null, stale: true, lastUpdated: new Date(0).toISOString() };
  }
}

// ---- status mapping ----

function mapStatus(statusType: any): { status: MatchStatus; detail: string } {
  const state = statusType?.state ?? "pre";
  const name = String(statusType?.name ?? "");
  const shortDetail = String(statusType?.shortDetail ?? "");
  if (name.includes("POSTPONED") || name.includes("CANCELED")) {
    return { status: "postponed", detail: shortDetail || "Postponed" };
  }
  if (state === "pre") return { status: "scheduled", detail: shortDetail };
  if (state === "post") return { status: "finished", detail: shortDetail || "FT" };
  if (name.includes("HALFTIME")) return { status: "halftime", detail: "HT" };
  return { status: "live", detail: shortDetail || "Live" };
}

const ROUNDS: Round[] = [
  "group-stage",
  "round-of-32",
  "round-of-16",
  "quarterfinals",
  "semifinals",
  "3rd-place-match",
  "final",
];

function mapRound(slug: unknown): Round {
  return ROUNDS.includes(slug as Round) ? (slug as Round) : "group-stage";
}

// ---- event mapping ----

function mapCompetitor(c: any): TeamSide {
  const team = c?.team ?? {};
  const score = c?.score;
  const shootout = c?.shootoutScore;
  return {
    id: String(team.id ?? c?.id ?? ""),
    name: String(team.displayName ?? team.name ?? "TBD"),
    shortName: String(team.shortDisplayName ?? team.displayName ?? "TBD"),
    abbrev: String(team.abbreviation ?? ""),
    flag: typeof team.logo === "string" ? team.logo : null,
    score: score === undefined || score === null ? null : Number(score),
    shootoutScore:
      shootout === undefined || shootout === null ? null : Number(shootout),
    winner: Boolean(c?.winner),
  };
}

function mapGoals(details: any[]): Goal[] {
  if (!Array.isArray(details)) return [];
  return details
    .filter((d) => d?.scoringPlay === true)
    .map((d) => ({
      minute: String(d?.clock?.displayValue ?? ""),
      clockSeconds: Number(d?.clock?.value ?? 0),
      scorer: String(d?.athletesInvolved?.[0]?.displayName ?? "Unknown"),
      teamId: String(d?.team?.id ?? ""),
      ownGoal: Boolean(d?.ownGoal),
      penalty: Boolean(d?.penaltyKick),
      shootout: Boolean(d?.shootout),
    }));
}

function mapEvent(e: any, groupByTeamId: Map<string, string>): Match | null {
  try {
    const comp = e?.competitions?.[0];
    if (!comp || !e?.id || !e?.date) return null;
    const competitors: any[] = comp.competitors ?? [];
    const homeRaw = competitors.find((c) => c?.homeAway === "home") ?? competitors[0];
    const awayRaw = competitors.find((c) => c?.homeAway === "away") ?? competitors[1];
    if (!homeRaw || !awayRaw) return null;

    const home = mapCompetitor(homeRaw);
    const away = mapCompetitor(awayRaw);
    const { status, detail } = mapStatus(comp.status?.type ?? e.status?.type);
    const round = mapRound(e?.season?.slug);
    const group =
      round === "group-stage"
        ? groupByTeamId.get(home.id) ?? groupByTeamId.get(away.id) ?? null
        : null;

    return {
      id: String(e.id),
      kickoff: new Date(e.date).toISOString(),
      status,
      statusDetail: detail,
      displayClock: String(comp.status?.displayClock ?? ""),
      clock: Number(comp.status?.clock ?? 0),
      round,
      group,
      knockout: round !== "group-stage",
      home,
      away,
      venue: comp.venue?.fullName ?? null,
      city: comp.venue?.address?.city ?? null,
      goals: mapGoals(comp.details),
    };
  } catch (err) {
    console.error("[espn] dropping malformed event:", err);
    return null;
  }
}

function validateEvents(raw: unknown): any[] {
  const events = (raw as any)?.events;
  if (!Array.isArray(events)) throw new Error("unexpected scoreboard shape");
  return events;
}

// ---- group map (team id -> "A".."L") from standings ----

async function fetchGroupMap(): Promise<Map<string, string>> {
  const result = await cachedJson(
    STANDINGS_URL,
    3600,
    "standings",
    (raw) => {
      const children = (raw as any)?.children;
      if (!Array.isArray(children)) throw new Error("unexpected standings shape");
      return children;
    }
  );
  const map = new Map<string, string>();
  for (const child of result.data ?? []) {
    const name = String(child?.name ?? ""); // "Group A"
    const letter = name.replace(/^Group\s+/i, "").trim();
    for (const entry of child?.standings?.entries ?? []) {
      const id = entry?.team?.id;
      if (id) map.set(String(id), letter);
    }
  }
  return map;
}

// ---- public API ----

export async function fetchAllMatches(): Promise<FetchResult<Match[]>> {
  const [events, groupMap] = await Promise.all([
    cachedJson(
      `${BASE}/scoreboard?dates=${TOURNAMENT_RANGE}&limit=200`,
      // 60s: standings are now computed from these results, so the table
      // reflects a full-time score within ~a minute (also keeps schedule
      // scores fresh on server renders). One ESPN call/min is negligible.
      60,
      "scoreboard-all",
      validateEvents
    ),
    fetchGroupMap(),
  ]);
  if (!events.data) {
    return { data: null, stale: true, lastUpdated: events.lastUpdated };
  }
  const matches = events.data
    .map((e) => mapEvent(e, groupMap))
    .filter((m): m is Match => m !== null)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  return { data: matches, stale: events.stale, lastUpdated: events.lastUpdated };
}

// Rolling 3-day UTC window around now, revalidated every 4 seconds. A
// Melbourne day straddles two UTC days and matches run in North American
// evenings, so yesterday..tomorrow UTC covers everything visible "today".
export async function fetchLiveMatches(): Promise<FetchResult<Match[]>> {
  const day = 24 * 60 * 60 * 1000;
  const fmt = (t: number) =>
    new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
  const range = `${fmt(Date.now() - day)}-${fmt(Date.now() + day)}`;
  const [events, groupMap] = await Promise.all([
    cachedJson(
      `${BASE}/scoreboard?dates=${range}&limit=50`,
      4,
      "scoreboard-live",
      validateEvents
    ),
    fetchGroupMap(),
  ]);
  if (!events.data) {
    return { data: null, stale: true, lastUpdated: events.lastUpdated };
  }
  const matches = events.data
    .map((e) => mapEvent(e, groupMap))
    .filter((m): m is Match => m !== null)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  return { data: matches, stale: events.stale, lastUpdated: events.lastUpdated };
}

// ---- summary (lineups) ----

function mapLineupPlayer(p: any): LineupPlayer {
  return {
    name: String(p?.athlete?.displayName ?? "Unknown"),
    jersey: String(p?.jersey ?? ""),
    position: String(p?.position?.abbreviation ?? ""),
    formationPlace: Number(p?.formationPlace ?? 0),
    starter: Boolean(p?.starter),
    subbedIn: Boolean(p?.subbedIn),
    subbedOut: Boolean(p?.subbedOut),
  };
}

// keyEvents -> timeline. Goals carry [scorer, assister] in participants;
// substitutions carry [on, off] ("X replaces Y" in ESPN commentary). The
// running score is recomputed here because keyEvents do not carry one.
function mapEvents(raw: any, homeTeamId: string): MatchEvent[] {
  const out: MatchEvent[] = [];
  let home = 0;
  let away = 0;
  for (const k of raw?.keyEvents ?? []) {
    const typeText = String(k?.type?.text ?? "");
    const minute = String(k?.clock?.displayValue ?? "");
    const teamId = String(k?.team?.id ?? "");
    const side: MatchEvent["side"] = !teamId
      ? "neutral"
      : teamId === homeTeamId
        ? "home"
        : "away";
    const participants: string[] = (k?.participants ?? [])
      .map((p: any) => p?.athlete?.displayName)
      .filter((n: any): n is string => typeof n === "string");

    const isGoal =
      typeText.startsWith("Goal") || typeText === "Penalty - Scored";
    const ownGoal = typeText.includes("Own Goal");
    if (isGoal || ownGoal) {
      // Own goals count for the opposition.
      // ESPN credits the event's team to the team the goal COUNTS FOR, even
      // for own goals (the OG scorer sits in participants but the team is the
      // beneficiary). So the running score follows `side` directly; never flip.
      if (side === "home") home++;
      else away++;
      out.push({
        minute,
        type: "goal",
        side,
        player: participants[0] ?? null,
        secondary: ownGoal || typeText === "Penalty - Scored" ? null : participants[1] ?? null,
        penalty: typeText === "Penalty - Scored",
        ownGoal,
        homeScore: home,
        awayScore: away,
      });
      continue;
    }
    if (typeText === "Yellow Card" || typeText === "Red Card") {
      out.push({
        minute,
        type: typeText === "Yellow Card" ? "yellow" : "red",
        side,
        player: participants[0] ?? null,
        secondary: null,
        penalty: false,
        ownGoal: false,
        homeScore: null,
        awayScore: null,
      });
      continue;
    }
    if (typeText === "Substitution") {
      out.push({
        minute,
        type: "sub",
        side,
        player: participants[0] ?? null, // coming on
        secondary: participants[1] ?? null, // coming off
        penalty: false,
        ownGoal: false,
        homeScore: null,
        awayScore: null,
      });
      continue;
    }
    if (typeText === "Halftime" || typeText === "End Regular Time") {
      out.push({
        minute: "",
        type: typeText === "Halftime" ? "halftime" : "fulltime",
        side: "neutral",
        player: null,
        secondary: null,
        penalty: false,
        ownGoal: false,
        homeScore: home,
        awayScore: away,
      });
    }
  }
  return out;
}

// Curated boxscore stats in LiveScore-ish order. ESPN's name -> our label.
const STAT_PICKS: Array<{ name: string; label: string; pct?: boolean }> = [
  { name: "possessionPct", label: "Possession %", pct: true },
  { name: "totalShots", label: "Shots" },
  { name: "shotsOnTarget", label: "Shots on target" },
  { name: "wonCorners", label: "Corner kicks" },
  { name: "foulsCommitted", label: "Fouls" },
  { name: "offsides", label: "Offsides" },
  { name: "yellowCards", label: "Yellow cards" },
  { name: "redCards", label: "Red cards" },
  { name: "saves", label: "Goalkeeper saves" },
  { name: "totalCrosses", label: "Crosses" },
  { name: "passPct", label: "Pass completion %", pct: true },
];

function mapStats(raw: any, homeTeamId: string): MatchStatPair[] {
  const teams: any[] = raw?.boxscore?.teams ?? [];
  if (teams.length < 2) return [];
  const homeRaw = teams.find((t) => String(t?.team?.id) === homeTeamId) ?? teams[0];
  const awayRaw = teams.find((t) => t !== homeRaw) ?? teams[1];
  const get = (t: any, name: string) =>
    (t?.statistics ?? []).find((s: any) => s?.name === name)?.displayValue;
  const out: MatchStatPair[] = [];
  for (const pick of STAT_PICKS) {
    const h = get(homeRaw, pick.name);
    const a = get(awayRaw, pick.name);
    if (h === undefined || a === undefined) continue;
    let hNum = parseFloat(h);
    let aNum = parseFloat(a);
    if (Number.isNaN(hNum) || Number.isNaN(aNum)) continue;
    // passPct/shotPct style values arrive as 0..1 fractions
    const display = (v: number) =>
      pick.pct && v <= 1 ? `${Math.round(v * 100)}%` : pick.pct ? `${Math.round(v)}%` : String(v);
    const total = hNum + aNum;
    out.push({
      label: pick.label,
      home: display(hNum),
      away: display(aNum),
      homePct: total > 0 ? hNum / total : 0.5,
    });
  }
  return out;
}

export async function fetchMatchSummary(
  eventId: string,
  homeTeamId: string = "",
  finished: boolean = false
): Promise<FetchResult<MatchSummary>> {
  const result = await cachedJson(
    `${BASE}/summary?event=${encodeURIComponent(eventId)}`,
    // Finished matches never change; live ones refresh fast.
    finished ? 86400 : 30,
    `summary-${eventId}`,
    (raw) => {
      if (typeof raw !== "object" || raw === null) {
        throw new Error("unexpected summary shape");
      }
      return raw as any;
    }
  );
  if (!result.data) {
    return { data: null, stale: true, lastUpdated: result.lastUpdated };
  }
  const lineups: TeamLineup[] = [];
  for (const r of (result.data as any).rosters ?? []) {
    const players: any[] = r?.roster ?? [];
    if (players.length === 0) continue;
    lineups.push({
      teamId: String(r?.team?.id ?? ""),
      teamName: String(r?.team?.displayName ?? ""),
      formation: r?.formation ? String(r.formation) : null,
      starters: players.filter((p) => p?.starter).map(mapLineupPlayer),
      bench: players.filter((p) => !p?.starter).map(mapLineupPlayer),
    });
  }
  return {
    data: {
      lineups,
      events: mapEvents(result.data, homeTeamId),
      stats: mapStats(result.data, homeTeamId),
    },
    stale: result.stale,
    lastUpdated: result.lastUpdated,
  };
}

// ---- group standings (computed from results) ----
// ESPN's standings endpoint lags full-time by many minutes (sometimes it only
// catches up once a whole matchday finishes), so the table is computed from
// the scoreboard results instead — the same "don't trust ESPN's aggregates"
// stance used for leaders. Only finished group-stage matches count; an
// in-progress match doesn't move the table. Tiebreak: points, goal
// difference, goals for, then name. FIFA's head-to-head and fair-play
// tiebreakers aren't replicated (rare in practice, not worth the complexity
// here), so ordering can differ from the official table only among teams
// level on all of points, GD and GF.
function computeStandings(matches: Match[]): GroupStanding[] {
  const byGroup = new Map<string, Map<string, StandingRow>>();
  const ensure = (group: string, side: TeamSide): StandingRow => {
    let teams = byGroup.get(group);
    if (!teams) {
      teams = new Map();
      byGroup.set(group, teams);
    }
    let row = teams.get(side.id);
    if (!row) {
      row = {
        teamId: side.id,
        name: side.name,
        flag: side.flag,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
        rank: 0,
      };
      teams.set(side.id, row);
    } else if (!row.flag && side.flag) {
      row.flag = side.flag; // fill in from a later fixture if the first lacked it
    }
    return row;
  };

  for (const m of matches) {
    if (m.round !== "group-stage" || !m.group) continue;
    // Register both teams so all four show before they've kicked a ball.
    const home = ensure(m.group, m.home);
    const away = ensure(m.group, m.away);
    if (m.status !== "finished") continue;
    const hs = m.home.score;
    const as = m.away.score;
    if (hs === null || as === null) continue;
    home.played++;
    away.played++;
    home.goalsFor += hs;
    home.goalsAgainst += as;
    away.goalsFor += as;
    away.goalsAgainst += hs;
    if (hs > as) {
      home.wins++;
      away.losses++;
    } else if (hs < as) {
      away.wins++;
      home.losses++;
    } else {
      home.draws++;
      away.draws++;
    }
  }

  const groups: GroupStanding[] = [];
  for (const [letter, teams] of Array.from(byGroup.entries())) {
    const rows = Array.from(teams.values());
    for (const r of rows) {
      r.goalDiff = r.goalsFor - r.goalsAgainst;
      r.points = r.wins * 3 + r.draws;
    }
    rows.sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDiff - a.goalDiff ||
        b.goalsFor - a.goalsFor ||
        a.name.localeCompare(b.name)
    );
    rows.forEach((r, i) => (r.rank = i + 1));
    groups.push({ group: letter, rows });
  }
  groups.sort((a, b) => a.group.localeCompare(b.group));
  return groups;
}

export async function fetchGroupStandings(): Promise<
  FetchResult<GroupStanding[]>
> {
  const all = await fetchAllMatches();
  if (!all.data) {
    return { data: null, stale: true, lastUpdated: all.lastUpdated };
  }
  return {
    data: computeStandings(all.data),
    stale: all.stale,
    lastUpdated: all.lastUpdated,
  };
}

// ---- tournament leaders, computed from match data ----
// No working ESPN leaders endpoint exists for this league, but everything is
// derivable: scorers and cards from the scoreboard details (one cached call,
// near-live), assists from per-match summaries (the [scorer, assister]
// participant pairs), which are immutable once a match finishes.

interface TallyEntry {
  name: string;
  teamId: string;
  value: number;
  secondary: number;
}

function leaderRows(
  tally: Map<string, TallyEntry>,
  teamNames: Map<string, { name: string; flag: string | null }>,
  limit: number
): LeaderRow[] {
  return Array.from(tally.values())
    .sort((a, b) => b.value - a.value || b.secondary - a.secondary || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((t) => ({
      name: t.name,
      teamId: t.teamId,
      teamName: teamNames.get(t.teamId)?.name ?? "",
      flag: teamNames.get(t.teamId)?.flag ?? null,
      value: t.value,
      secondary: t.secondary,
    }));
}

export async function fetchLeaders(): Promise<FetchResult<LeadersPayload>> {
  const all = await fetchAllMatches();
  if (!all.data) {
    return { data: null, stale: true, lastUpdated: all.lastUpdated };
  }

  const teamNames = new Map<string, { name: string; flag: string | null }>();
  for (const m of all.data) {
    teamNames.set(m.home.id, { name: m.home.name, flag: m.home.flag });
    teamNames.set(m.away.id, { name: m.away.name, flag: m.away.flag });
  }

  const scorers = new Map<string, TallyEntry>();
  const discipline = new Map<string, TallyEntry>();
  const assists = new Map<string, TallyEntry>();
  const bump = (
    map: Map<string, TallyEntry>,
    name: string,
    teamId: string,
    value: number,
    secondary: number
  ) => {
    const key = `${name}|${teamId}`;
    const cur = map.get(key) ?? { name, teamId, value: 0, secondary: 0 };
    cur.value += value;
    cur.secondary += secondary;
    map.set(key, cur);
  };

  const started = all.data.filter(
    (m) => m.status === "finished" || m.status === "live" || m.status === "halftime"
  );

  // Scorers from scoreboard goal details (own goals and shootouts excluded).
  for (const m of started) {
    for (const g of m.goals) {
      if (g.shootout || g.ownGoal || g.scorer === "Unknown") continue;
      bump(scorers, g.scorer, g.teamId, 1, 0);
    }
  }

  // Assists from summaries; cards also live there but details already carry
  // them, so summaries are only fetched for matches that have started.
  const summaries = await Promise.all(
    started.map((m) =>
      fetchMatchSummary(m.id, m.home.id, m.status === "finished").then(
        (r) => ({ match: m, summary: r.data })
      )
    )
  );
  for (const { match, summary } of summaries) {
    for (const ev of summary?.events ?? []) {
      if (ev.type === "goal" && ev.secondary && !ev.penalty && !ev.ownGoal) {
        const teamId = ev.side === "home" ? match.home.id : match.away.id;
        bump(assists, ev.secondary, teamId, 1, 0);
      }
      if ((ev.type === "yellow" || ev.type === "red") && ev.player) {
        const teamId = ev.side === "home" ? match.home.id : match.away.id;
        bump(
          discipline,
          ev.player,
          teamId,
          ev.type === "yellow" ? 1 : 0,
          ev.type === "red" ? 1 : 0
        );
      }
    }
  }

  return {
    data: {
      scorers: leaderRows(scorers, teamNames, 25),
      assists: leaderRows(assists, teamNames, 25),
      discipline: Array.from(discipline.values())
        .sort(
          (a, b) =>
            b.secondary - a.secondary ||
            b.value - a.value ||
            a.name.localeCompare(b.name)
        )
        .slice(0, 25)
        .map((t) => ({
          name: t.name,
          teamId: t.teamId,
          teamName: teamNames.get(t.teamId)?.name ?? "",
          flag: teamNames.get(t.teamId)?.flag ?? null,
          value: t.value,
          secondary: t.secondary,
        })),
      lastUpdated: new Date().toISOString(),
    },
    stale: all.stale,
    lastUpdated: all.lastUpdated,
  };
}
