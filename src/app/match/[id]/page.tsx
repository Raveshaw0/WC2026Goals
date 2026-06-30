import { notFound } from "next/navigation";

import { StaleBanner } from "@/components/StaleBanner";
import { clipsForMatch } from "@/lib/clips";
import { getSbsLink } from "@/lib/db";
import {
  fetchAllMatches,
  fetchGroupStandings,
  fetchMatchSummary,
} from "@/lib/espn";

import { MatchDetailClient } from "./MatchDetailClient";

export const dynamic = "force-dynamic";

export default async function MatchPage({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id;
  if (!/^[0-9]+$/.test(id)) notFound();

  const all = await fetchAllMatches();
  const match = all.data?.find((m) => m.id === id);
  if (!match) notFound();

  const [summary, sbs, standings, clips] = await Promise.all([
    fetchMatchSummary(id, match.home.id, match.status === "finished"),
    getSbsLink(id),
    match.group ? fetchGroupStandings() : Promise.resolve(null),
    clipsForMatch(match),
  ]);
  const groupTable =
    standings?.data?.find((g) => g.group === match.group) ?? null;

  if (sbs) {
    match.sbs = {
      live: sbs.sbs_live_url ?? null,
      highlights: sbs.sbs_highlights_url ?? null,
      extended: sbs.sbs_extended_url ?? null,
      full: sbs.sbs_full_url ?? null,
      ytHighlightsId: sbs.yt_highlights_id ?? null,
    };
  }

  return (
    <div className="space-y-4">
      <StaleBanner stale={all.stale} lastUpdated={all.lastUpdated} />
      <MatchDetailClient
        initialMatch={match}
        initialSummary={
          summary.data ?? { lineups: [], events: [], stats: [], shootout: [] }
        }
        groupTable={groupTable}
        initialClips={clips}
      />
    </div>
  );
}
