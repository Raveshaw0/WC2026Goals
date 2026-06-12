import { NextResponse } from "next/server";

import { fetchAllMatches, fetchMatchSummary } from "@/lib/espn";

export const dynamic = "force-dynamic";

// Match detail pages poll this every 60s during the live window to refresh
// events, stats and lineups. The upstream summary fetch revalidates at 30s
// for unfinished matches, so polling clients never multiply ESPN calls.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (!/^[0-9]+$/.test(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const all = await fetchAllMatches();
  const match = all.data?.find((m) => m.id === id);
  if (!match) {
    return NextResponse.json({ error: "unknown match" }, { status: 404 });
  }
  const summary = await fetchMatchSummary(
    id,
    match.home.id,
    match.status === "finished"
  );
  return NextResponse.json({
    match,
    summary: summary.data ?? { lineups: [], events: [], stats: [] },
    stale: all.stale || summary.stale,
  });
}
