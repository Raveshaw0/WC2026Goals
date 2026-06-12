import { NextResponse } from "next/server";

import { fetchLiveMatches } from "@/lib/espn";

export const dynamic = "force-dynamic";

// Clients poll this every 4 seconds during live windows. The upstream ESPN
// fetch inside fetchLiveMatches uses revalidate: 4, so any number of clients
// produce at most one upstream call per 4 seconds.
export async function GET() {
  const result = await fetchLiveMatches();
  return NextResponse.json({
    matches: result.data ?? [],
    stale: result.stale,
    lastUpdated: result.lastUpdated,
  });
}
