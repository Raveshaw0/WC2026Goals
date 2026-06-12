"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

import { MatchCard } from "@/components/MatchCard";
import { StaleBanner } from "@/components/StaleBanner";
import { StatsPanel } from "@/components/StatsPanel";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import { melbourneDateHeading, melbourneDateKey, todayMelbourneKey } from "@/lib/time";
import type { Match } from "@/lib/types";

const STATUS_ORDER: Record<Match["status"], number> = {
  live: 0,
  halftime: 0,
  scheduled: 1,
  finished: 2,
  postponed: 3,
};

export function HomeClient({
  initialMatches,
  initialStale,
  initialLastUpdated,
}: {
  initialMatches: Match[];
  initialStale: boolean;
  initialLastUpdated: string;
}) {
  const { matches, stale, lastUpdated } = useLiveMatches(initialMatches);

  // Lazy, non-blocking SBS link discovery trigger. Fire and forget.
  useEffect(() => {
    fetch("/api/check-sbs", { method: "POST" }).catch(() => {});
  }, []);

  const today = useMemo(() => {
    const key = todayMelbourneKey();
    return matches
      .filter((m) => melbourneDateKey(m.kickoff) === key)
      .sort((a, b) => {
        const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (so !== 0) return so;
        return a.kickoff.localeCompare(b.kickoff);
      });
  }, [matches]);

  const heading =
    today.length > 0
      ? melbourneDateHeading(today[0].kickoff)
      : melbourneDateHeading(new Date().toISOString());

  return (
    <div>
      <StaleBanner
        stale={stale || initialStale}
        lastUpdated={lastUpdated ?? initialLastUpdated}
      />
      <StatsPanel matches={matches} />
      <h1 className="mb-3 text-lg font-bold text-zinc-100">{heading}</h1>
      {today.length === 0 ? (
        <div className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-zinc-400">
          No matches today.
          <div className="mt-2">
            <Link href="/schedule" className="font-medium text-accent">
              View the full schedule
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {today.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}
