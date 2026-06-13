import "server-only";

import { getPageViews } from "./db";

// Shared analytics aggregation, used by both the JSON endpoint and the human
// dashboard. A "visitor" is a stable random id in the browser's localStorage,
// so repeat visits from the same device are detectable: returning = a device
// seen on two or more distinct days in the window.

export interface Insights {
  site: string;
  windowDays: number;
  totalViews: number;
  uniqueVisitors: number;
  returningVisitors: number;
  viewsLast24h: number;
  uniquesLast24h: number;
  fromLinkedIn: number;
  topReferrers: Array<{ name: string; count: number }>;
  topCountries: Array<{ name: string; count: number }>;
  topPages: Array<{ name: string; count: number }>;
  byDay: Array<{ name: string; count: number }>;
}

function hostnameOf(ref: string | null): string {
  if (!ref) return "(direct)";
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "");
    return h || "(direct)";
  } catch {
    return "(other)";
  }
}

function topCounts(items: string[], limit: number) {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return Array.from(m.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function computeInsights(
  site: string,
  days: number
): Promise<Insights> {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await getPageViews(site, since.toISOString());

  const last24 = rows.filter(
    (r) => Date.now() - new Date(r.ts).getTime() < 86400_000
  );

  // Distinct days per visitor → returning = seen on 2+ days.
  const daysByVisitor = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.visitor) continue;
    const set = daysByVisitor.get(r.visitor) ?? new Set<string>();
    set.add(r.ts.slice(0, 10));
    daysByVisitor.set(r.visitor, set);
  }
  let returning = 0;
  daysByVisitor.forEach((set) => {
    if (set.size >= 2) returning++;
  });

  return {
    site,
    windowDays: days,
    totalViews: rows.length,
    uniqueVisitors: daysByVisitor.size,
    returningVisitors: returning,
    viewsLast24h: last24.length,
    uniquesLast24h: new Set(last24.map((r) => r.visitor).filter(Boolean)).size,
    fromLinkedIn: rows.filter((r) =>
      (r.referrer ?? "").toLowerCase().includes("linkedin")
    ).length,
    topReferrers: topCounts(rows.map((r) => hostnameOf(r.referrer)), 12),
    topCountries: topCounts(rows.map((r) => r.country ?? "(unknown)"), 12),
    topPages: topCounts(rows.map((r) => r.path ?? "(unknown)"), 12),
    byDay: topCounts(rows.map((r) => r.ts.slice(0, 10)), 90).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
  };
}
