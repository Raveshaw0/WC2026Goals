import { NextResponse } from "next/server";

import { titleMentionsTeam } from "@/lib/aliases";
import { getAllSbsLinks, dbConfigured, upsertSbsLink } from "@/lib/db";
import { fetchAllMatches } from "@/lib/espn";
import { liveWindowFor } from "@/lib/liveWindow";
import type { Match, SbsLinkRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// SBS link discovery. Two jobs per the spec:
//   a. live links for matches kicking off within 90 minutes or currently live
//   b. highlights for matches finished within 48 hours, last_checked > 15 min ago
// Caps: 20 attempts per match per link type. Polite User-Agent. As of
// 2026-06-12 the SBS search page is client-rendered so the extractors below
// usually find nothing; the UI's fallback links carry the experience (see
// KNOWN_ISSUES.md). Extractors are kept so this lights up if SBS ships SSR.

const UA =
  "Mozilla/5.0 (compatible; wc26-tracker/1.0; personal World Cup tracker; +https://wc2026.alextestingstuff.com)";

const SEARCH_BASE = "https://www.sbs.com.au/ondemand/search?query=";
const MAX_ATTEMPTS = 20;
const RECHECK_MS = 15 * 60 * 1000;
const HIGHLIGHTS_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const LIVE_LOOKAHEAD_MS = 90 * 60 * 1000;
const MAX_SCRAPES_PER_RUN = 8; // keep each invocation fast and polite

// Self-throttle: the home page fires this on every load. One scrape pass per
// 5 minutes per instance is plenty; the DB last_checked gate holds globally.
let lastRun = 0;
const SELF_THROTTLE_MS = 5 * 60 * 1000;

interface Candidate {
  url: string;
  title: string;
}

// Best-effort extraction of {url, title} pairs from an SBS search result page.
function extractCandidates(html: string): Candidate[] {
  const out: Candidate[] = [];

  // 1. Anchor tags linking to ondemand content with text content
  const anchorRe =
    /<a[^>]+href="(\/ondemand\/(?:watch|video|tv-series|movie|sport)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const title = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (title) out.push({ url: `https://www.sbs.com.au${m[1]}`, title });
  }

  // 2. JSON-LD blocks (VideoObject / ItemList)
  const ldRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = ldRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const list = item?.itemListElement ?? [item];
        for (const el of Array.isArray(list) ? list : [list]) {
          const url = el?.url ?? el?.item?.url ?? el?.["@id"];
          const name = el?.name ?? el?.item?.name;
          if (typeof url === "string" && typeof name === "string") {
            out.push({ url, title: name });
          }
        }
      }
    } catch {
      // not parseable, skip
    }
  }

  // 3. Embedded JSON with name/url pairs (e.g. preloaded state)
  const pairRe =
    /"name"\s*:\s*"([^"]{5,120})"\s*,[^{}]{0,200}?"(?:url|slug|href)"\s*:\s*"([^"]+)"/g;
  while ((m = pairRe.exec(html)) !== null) {
    const url = m[2].startsWith("http")
      ? m[2]
      : `https://www.sbs.com.au${m[2].startsWith("/") ? "" : "/"}${m[2]}`;
    out.push({ url, title: m[1] });
  }

  return out;
}

async function searchSbs(query: string): Promise<Candidate[]> {
  try {
    const res = await fetch(SEARCH_BASE + encodeURIComponent(query), {
      headers: { "User-Agent": UA },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    return extractCandidates(await res.text());
  } catch (err) {
    console.error("[check-sbs] search failed:", err);
    return [];
  }
}

function findLink(
  candidates: Candidate[],
  keyword: string,
  match: Match
): string | null {
  for (const c of candidates) {
    const t = c.title.toLowerCase();
    if (!t.includes(keyword)) continue;
    if (
      titleMentionsTeam(c.title, match.home.name) &&
      titleMentionsTeam(c.title, match.away.name)
    ) {
      return c.url;
    }
  }
  return null;
}

async function handle(): Promise<NextResponse> {
  if (!dbConfigured()) {
    return NextResponse.json({ skipped: "db not configured" });
  }
  const now = Date.now();
  if (now - lastRun < SELF_THROTTLE_MS) {
    return NextResponse.json({ skipped: "throttled" });
  }
  lastRun = now;

  const all = await fetchAllMatches();
  if (!all.data) {
    return NextResponse.json({ skipped: "no match data" });
  }

  const existing = new Map<string, SbsLinkRow>();
  for (const row of await getAllSbsLinks()) existing.set(row.match_id, row);

  let scrapes = 0;
  let found = 0;
  const checked: string[] = [];

  for (const match of all.data) {
    if (scrapes >= MAX_SCRAPES_PER_RUN) break;
    if (match.home.id === "" || match.away.id === "") continue;
    // Skip knockout placeholders ("Semifinal 1 Winner" has no real teams yet)
    if (match.home.name.includes("Winner") || match.home.name.includes("Place")) continue;

    const row = existing.get(match.id);
    const kickoffMs = new Date(match.kickoff).getTime();
    const windowEnd = liveWindowFor(match).end;
    const lastChecked = row?.last_checked ? new Date(row.last_checked).getTime() : 0;

    // a. live link: kicking off within 90 min or currently live
    const liveEligible =
      !row?.sbs_live_url &&
      (row?.attempts_live ?? 0) < MAX_ATTEMPTS &&
      ((kickoffMs > now && kickoffMs - now < LIVE_LOOKAHEAD_MS) ||
        match.status === "live" ||
        match.status === "halftime");

    // b. highlights: finished within last 48h, not found, rechecked > 15 min ago
    const finishedRecently =
      match.status === "finished" &&
      now - kickoffMs < HIGHLIGHTS_LOOKBACK_MS + 2 * 60 * 60 * 1000;
    const highlightsEligible =
      finishedRecently &&
      !row?.sbs_highlights_url &&
      (row?.attempts_highlights ?? 0) < MAX_ATTEMPTS &&
      now - lastChecked > RECHECK_MS;

    if (!liveEligible && !highlightsEligible) continue;

    const update: Partial<SbsLinkRow> & { match_id: string } = {
      match_id: match.id,
      home_team: match.home.name,
      away_team: match.away.name,
      kickoff: match.kickoff,
      match_end: new Date(windowEnd).toISOString(),
      last_checked: new Date().toISOString(),
      attempts: (row?.attempts ?? 0) + 1,
    };

    if (liveEligible) {
      scrapes++;
      const candidates = await searchSbs(
        `live ${match.home.name} ${match.away.name}`
      );
      const url = findLink(candidates, "live", match);
      update.attempts_live = (row?.attempts_live ?? 0) + 1;
      if (url) {
        update.sbs_live_url = url;
        found++;
      }
    }

    if (highlightsEligible && scrapes < MAX_SCRAPES_PER_RUN) {
      scrapes++;
      const candidates = await searchSbs(
        `highlights ${match.home.name} ${match.away.name}`
      );
      const url = findLink(candidates, "highlights", match);
      update.attempts_highlights = (row?.attempts_highlights ?? 0) + 1;
      if (url) {
        update.sbs_highlights_url = url;
        found++;
      }
    }

    await upsertSbsLink(update);
    checked.push(`${match.home.name} v ${match.away.name}`);
  }

  return NextResponse.json({ checked, scrapes, found });
}

export async function GET() {
  return handle();
}

export async function POST() {
  return handle();
}
