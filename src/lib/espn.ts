import "server-only";

import type {
  Goal,
  LineupPlayer,
  Match,
  MatchStatus,
  MatchSummary,
  Round,
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
      300,
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
    starter: Boolean(p?.starter),
    subbedIn: Boolean(p?.subbedIn),
    subbedOut: Boolean(p?.subbedOut),
  };
}

export async function fetchMatchSummary(
  eventId: string
): Promise<FetchResult<MatchSummary>> {
  const result = await cachedJson(
    `${BASE}/summary?event=${encodeURIComponent(eventId)}`,
    30,
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
    data: { lineups },
    stale: result.stale,
    lastUpdated: result.lastUpdated,
  };
}
