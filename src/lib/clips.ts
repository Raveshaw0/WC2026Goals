import "server-only";

import { aliasesFor } from "./aliases";
import type { Match } from "./types";

// In-game highlight clips from SBS's "Blaze" stories platform (the same feed
// LiveScore syndicates). One story per match, each with vertical MP4 clips of
// goals and key moments, published during and after the match. The clips are
// plain MP4s on sbs.com.au (no DRM), so we play them in our own <video>.
// API + key are the public ones the SBS embed widget itself uses.
const FEED =
  "https://blazesdk-prod-cdn.clipro.tv/api/blazesdk/v1.3/stories" +
  "?ApiKey=9f9f83a70991497b8914fa9d47fa8057&clientPlatform=Web" +
  "&labelsFilterExpression=aa-sbs-aus-wc26&maxItems=50";

export interface Clip {
  id: string;
  mp4: string;
  poster: string | null;
  duration: number;
}

export interface MatchClips {
  isLive: boolean;
  updateTime: string;
  clips: Clip[];
}

interface Story {
  teams: [string, string] | null;
  dateUtc: string | null; // yyyy-mm-dd parsed from description
  isLive: boolean;
  updateTime: string;
  clips: Clip[];
}

function parseStory(s: any): Story | null {
  try {
    const parts = String(s?.description ?? "").split(", ");
    const titleTeams = String(s?.title ?? "").split(/\s+vs\.?\s+/i);
    const teams: [string, string] | null =
      titleTeams.length === 2
        ? [titleTeams[0].trim(), titleTeams[1].trim()]
        : null;

    // description date is "dd-mm-yy" in parts[1]
    let dateUtc: string | null = null;
    const m = (parts[1] ?? "").match(/^(\d{2})-(\d{2})-(\d{2})$/);
    if (m) dateUtc = `20${m[3]}-${m[2]}-${m[1]}`;

    const clips: Clip[] = [];
    for (const p of s?.pages ?? []) {
      if (p?.type !== "Content") continue;
      const renditions = p?.baseLayer?.content?.renditions ?? [];
      const mp4 = renditions.find((r: any) => r?.fileType === "Mp4")?.url;
      if (!mp4) continue;
      clips.push({
        id: String(p?.id ?? mp4),
        mp4,
        poster: p?.thumbnail?.rendition?.url ?? null,
        duration: Number(p?.duration ?? 0),
      });
    }

    return {
      teams,
      dateUtc,
      isLive: Boolean(s?.isLive),
      updateTime: String(s?.updateTime ?? ""),
      clips,
    };
  } catch {
    return null;
  }
}

async function fetchStories(): Promise<Story[]> {
  try {
    // No Data Cache: measured in prod that a `next: { revalidate }` entry for
    // this feed froze at an early-match snapshot (5 clips, isLive true) and
    // never revalidated, hours after full time, so the in-game reel stopped
    // growing partway through the match. The route is force-dynamic and polled
    // ~60s, and the feed is ~1.5MB, so fetching it fresh each time is fine and
    // guarantees the newest clips.
    const res = await fetch(FEED, { cache: "no-store" });
    if (!res.ok) throw new Error(`blaze ${res.status}`);
    const data = await res.json();
    return ((data?.result ?? []) as any[])
      .map(parseStory)
      .filter((s): s is Story => s !== null && s.clips.length > 0);
  } catch (err) {
    console.error("[clips] feed fetch failed:", err);
    return [];
  }
}

// Two names refer to the same team if their alias sets intersect.
function teamEq(a: string, b: string): boolean {
  const A = new Set(aliasesFor(a));
  return aliasesFor(b).some((x) => A.has(x));
}

function withinADay(storyDate: string | null, kickoffIso: string): boolean {
  if (!storyDate) return false;
  const ko = kickoffIso.slice(0, 10);
  const a = Date.parse(`${storyDate}T00:00:00Z`);
  const b = Date.parse(`${ko}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(a - b) <= 36 * 60 * 60 * 1000; // tolerate TZ date rollover
}

function storyMatches(story: Story, match: Match): boolean {
  if (!story.teams) return false;
  // Date guard disambiguates repeated fixtures and excludes demo/old stories.
  if (!withinADay(story.dateUtc, match.kickoff)) return false;
  const [t0, t1] = story.teams;
  return (
    (teamEq(t0, match.home.name) && teamEq(t1, match.away.name)) ||
    (teamEq(t0, match.away.name) && teamEq(t1, match.home.name))
  );
}

export async function clipsForMatch(match: Match): Promise<MatchClips | null> {
  const story = (await fetchStories()).find((s) => storyMatches(s, match));
  if (!story) return null;
  return {
    isLive: story.isLive,
    updateTime: story.updateTime,
    clips: story.clips,
  };
}
