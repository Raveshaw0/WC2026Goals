"use client";

import { useEffect, useMemo } from "react";

import { MatchCard } from "@/components/MatchCard";
import { StaleBanner } from "@/components/StaleBanner";
import { StatsPanel } from "@/components/StatsPanel";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import { useUserState } from "@/hooks/useUserState";
import {
  melbourneDateHeading,
  melbourneDateKey,
  todayMelbourneKey,
} from "@/lib/time";
import type { Match } from "@/lib/types";

export type Filter = "all" | "australia" | "favourites";

function isAustraliaMatch(m: Match): boolean {
  return m.home.name === "Australia" || m.away.name === "Australia";
}

export function ScheduleClient({
  initialMatches,
  initialStale,
  initialLastUpdated,
  filter,
}: {
  initialMatches: Match[];
  initialStale: boolean;
  initialLastUpdated: string;
  filter: Filter;
}) {
  const { matches, stale, lastUpdated } = useLiveMatches(initialMatches);
  const { favourites, favouriteTeams } = useUserState();

  // Lazy, non-blocking SBS link discovery trigger. Fire and forget.
  useEffect(() => {
    fetch("/api/check-sbs", { method: "POST" }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (filter === "australia") return matches.filter(isAustraliaMatch);
    if (filter === "favourites") {
      // Favourited matches plus every match of followed teams.
      return matches.filter(
        (m) =>
          favourites.has(m.id) ||
          favouriteTeams.has(m.home.id) ||
          favouriteTeams.has(m.away.id)
      );
    }
    return matches;
  }, [matches, filter, favourites, favouriteTeams]);

  // Group by Melbourne calendar date, in kickoff order.
  const groups = useMemo(() => {
    const byDate = new Map<string, Match[]>();
    for (const m of filtered) {
      const key = melbourneDateKey(m.kickoff);
      const list = byDate.get(key);
      if (list) list.push(m);
      else byDate.set(key, [m]);
    }
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // Land centered on today.
  useEffect(() => {
    const el = document.getElementById(`day-${todayMelbourneKey()}`);
    if (el) el.scrollIntoView({ block: "start" });
  }, []);

  return (
    <div>
      <StaleBanner
        stale={stale || initialStale}
        lastUpdated={lastUpdated ?? initialLastUpdated}
      />
      <StatsPanel matches={matches} />
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-zinc-400">
          {filter === "favourites"
            ? "Nothing here yet. Star a match, or follow a team from its match page."
            : "No matches found."}
        </div>
      ) : (
        groups.map(([dateKey, dayMatches]) => (
          <section key={dateKey} id={`day-${dateKey}`} className="scroll-mt-32">
            <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-zinc-400">
              {melbourneDateHeading(dayMatches[0].kickoff)}
              {dateKey === todayMelbourneKey() && (
                <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                  Today
                </span>
              )}
            </h2>
            <div className="space-y-3">
              {dayMatches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
