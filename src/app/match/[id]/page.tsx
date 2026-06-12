import { notFound } from "next/navigation";

import { Lineups } from "@/components/Lineups";
import { StaleBanner } from "@/components/StaleBanner";
import { getSbsLink } from "@/lib/db";
import { fetchAllMatches, fetchMatchSummary } from "@/lib/espn";

import { MatchDetailClient } from "./MatchDetailClient";

export const dynamic = "force-dynamic";

export default async function MatchPage({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id;
  if (!/^[0-9]+$/.test(id)) notFound();

  const [all, summary, sbs] = await Promise.all([
    fetchAllMatches(),
    fetchMatchSummary(id),
    getSbsLink(id),
  ]);

  const match = all.data?.find((m) => m.id === id);
  if (!match) notFound();
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
      <MatchDetailClient initialMatch={match} />
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">
          Lineups
        </h2>
        <Lineups lineups={summary.data?.lineups ?? []} />
      </section>
    </div>
  );
}
