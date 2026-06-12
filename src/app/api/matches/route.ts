import { NextResponse } from "next/server";

import { fetchAllMatches } from "@/lib/espn";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchAllMatches();
  return NextResponse.json({
    matches: result.data ?? [],
    stale: result.stale,
    lastUpdated: result.lastUpdated,
  });
}
