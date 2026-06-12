import { NextResponse } from "next/server";

import { titleMentionsTeam } from "@/lib/aliases";
import { getAllSbsLinks, dbConfigured, upsertSbsLink } from "@/lib/db";
import { fetchAllMatches } from "@/lib/espn";
import { liveWindowFor } from "@/lib/liveWindow";
import type { Match, SbsLinkRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// SBS link discovery via the SBS On Demand catalogue API: the World Cup hub
// page (sbs.com.au/ondemand/fifa-world-cup-2026) is backed by a single JSON
// document listing every published video in named rails (Full Matches, Mini
// Matches, Extended Highlights, Highlights, Live & Upcoming). One fetch per
// run resolves every match at once; no HTML scraping. The x-api-key is the
// public one baked into SBS's own browser bundle.

const HUB_URL = "https://catalogue.pr.sbsod.com/pages/fifa-world-cup-2026";
const SBS_API_KEY = "49a46461-b9eb-4904-b519-176c59c386ef";
const WATCH_BASE = "https://www.sbs.com.au/ondemand/watch/";
const UA =
  "Mozilla/5.0 (compatible; wc26-tracker/1.0; personal World Cup tracker; +https://wc2026.alextestingstuff.com)";

// Self-throttle: the home page fires this on every load. One hub fetch per
// 5 minutes per instance is plenty.
let lastRun = 0;
const SELF_THROTTLE_MS = 5 * 60 * 1000;

interface RailItem {
  title: string;
  url: string;
}

interface HubRails {
  live: RailItem[];
  highlights: RailItem[];
  extended: RailItem[];
  full: RailItem[];
  mini: RailItem[];
}

const RAIL_MAP: Record<string, keyof HubRails> = {
  "Live & Upcoming": "live",
  Highlights: "highlights",
  "Extended Highlights": "extended",
  "Full Matches": "full",
  "Mini Matches": "mini",
};

async function fetchHubRails(): Promise<HubRails | null> {
  try {
    const res = await fetch(HUB_URL, {
      headers: { "x-api-key": SBS_API_KEY, "User-Agent": UA },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`hub ${res.status}`);
    const data = await res.json();
    const rails: HubRails = {
      live: [],
      highlights: [],
      extended: [],
      full: [],
      mini: [],
    };
    for (const section of data?.sections ?? []) {
      const key = RAIL_MAP[String(section?.title ?? "")];
      if (!key) continue;
      for (const item of section?.items ?? []) {
        const mpx = item?.mpxMediaID;
        const title = item?.title;
        if (!mpx || typeof title !== "string") continue;
        rails[key].push({ title, url: `${WATCH_BASE}${mpx}` });
      }
    }
    return rails;
  } catch (err) {
    console.error("[check-sbs] hub fetch failed:", err);
    return null;
  }
}

// Rail titles look like "Korea Republic v Czechia: Group A" or, for live,
// "FIFA World Cup 2026™: Canada v Bosnia and Herzegovina: Group B: Live
// Stream". Both team names must appear (alias-aware), which survives all of
// these shapes without parsing them.
function findForMatch(items: RailItem[], match: Match): string | null {
  for (const item of items) {
    if (
      titleMentionsTeam(item.title, match.home.name) &&
      titleMentionsTeam(item.title, match.away.name)
    ) {
      return item.url;
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

  const [all, rails] = await Promise.all([fetchAllMatches(), fetchHubRails()]);
  if (!all.data) return NextResponse.json({ skipped: "no match data" });
  if (!rails) return NextResponse.json({ skipped: "hub unavailable" });

  const existing = new Map<string, SbsLinkRow>();
  for (const row of await getAllSbsLinks()) existing.set(row.match_id, row);

  let updated = 0;
  for (const match of all.data) {
    // Knockout placeholders have no real teams to match on yet
    if (match.home.name.includes("Winner") || match.home.name.includes("Place")) {
      continue;
    }

    const found = {
      sbs_live_url: findForMatch(rails.live, match),
      sbs_highlights_url: findForMatch(rails.highlights, match),
      sbs_extended_url: findForMatch(rails.extended, match),
      sbs_full_url: findForMatch(rails.full, match),
      sbs_mini_url: findForMatch(rails.mini, match),
    };
    if (!Object.values(found).some(Boolean)) continue;

    const row = existing.get(match.id);
    const changed =
      !row ||
      Object.entries(found).some(
        ([k, v]) => v !== null && row[k as keyof SbsLinkRow] !== v
      );
    if (!changed) continue;

    // Never overwrite a stored link with null: links drop out of rails as
    // they age but stay watchable.
    const update: Partial<SbsLinkRow> & { match_id: string } = {
      match_id: match.id,
      home_team: match.home.name,
      away_team: match.away.name,
      kickoff: match.kickoff,
      match_end: new Date(liveWindowFor(match).end).toISOString(),
      last_checked: new Date().toISOString(),
      attempts: (row?.attempts ?? 0) + 1,
    };
    for (const [k, v] of Object.entries(found)) {
      if (v !== null) (update as Record<string, unknown>)[k] = v;
    }
    if (await upsertSbsLink(update)) updated++;
  }

  return NextResponse.json({
    railSizes: Object.fromEntries(
      Object.entries(rails).map(([k, v]) => [k, v.length])
    ),
    updated,
  });
}

export async function GET() {
  return handle();
}

export async function POST() {
  return handle();
}
