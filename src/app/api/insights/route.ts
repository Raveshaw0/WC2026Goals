import { NextRequest, NextResponse } from "next/server";

import { computeInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";

const SITE = "wc26";

// Secret stats endpoint (JSON). Gated by ?key=INSIGHTS_KEY; nothing links to
// it. ?days=N (default 30). For a human view see /insights?key=...
export async function GET(req: NextRequest) {
  const key = process.env.INSIGHTS_KEY;
  if (!key) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  if (req.nextUrl.searchParams.get("key") !== key) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const days = Math.min(
    365,
    Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 30)
  );
  return NextResponse.json(await computeInsights(SITE, days));
}
