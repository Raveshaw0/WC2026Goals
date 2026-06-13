import { NextRequest, NextResponse } from "next/server";

import { getPageViews } from "@/lib/db";

export const dynamic = "force-dynamic";

const SITE = "wc26";

// Secret stats endpoint. Gated by ?key=INSIGHTS_KEY; nothing links to it and
// it returns JSON only. ?days=N (default 30) sets the window.
function hostnameOf(ref: string | null): string {
  if (!ref) return "(direct)";
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "");
    return h || "(direct)";
  } catch {
    return "(other)";
  }
}

function topCounts(
  items: string[],
  limit: number
): Array<{ name: string; count: number }> {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return Array.from(m.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

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
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await getPageViews(SITE, since.toISOString());

  const dayKey = (iso: string) => iso.slice(0, 10);
  const last24 = rows.filter(
    (r) => Date.now() - new Date(r.ts).getTime() < 86400_000
  );
  const uniques = new Set(rows.map((r) => r.visitor).filter(Boolean)).size;
  const fromLinkedIn = rows.filter((r) =>
    (r.referrer ?? "").toLowerCase().includes("linkedin")
  ).length;

  const byDay = topCounts(rows.map((r) => dayKey(r.ts)), 60).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return NextResponse.json({
    site: SITE,
    windowDays: days,
    totalViews: rows.length,
    uniqueVisitors: uniques,
    viewsLast24h: last24.length,
    uniquesLast24h: new Set(last24.map((r) => r.visitor).filter(Boolean)).size,
    fromLinkedIn,
    topReferrers: topCounts(rows.map((r) => hostnameOf(r.referrer)), 12),
    topCountries: topCounts(
      rows.map((r) => r.country ?? "(unknown)"),
      12
    ),
    topPages: topCounts(rows.map((r) => r.path ?? "(unknown)"), 12),
    byDay,
  });
}
