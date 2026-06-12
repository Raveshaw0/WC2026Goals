"use client";

import { useEffect, useMemo, useState } from "react";

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

type Filter = "all" | "australia" | "favourites";

function isAustraliaMatch(m: Match): boolean {
  return m.home.name === "Australia" || m.away.name === "Australia";
}

export function ScheduleClient({
  initialMatches,
  initialStale,
  initialLastUpdated,
}: {
  initialMatches: Match[];
  initialStale: boolean;
  initialLastUpdated: string;
}) {
  const { matches, stale, lastUpdated } = useLiveMatches(initialMatches);
  const { favourites } = useUserState();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "australia") return matches.filter(isAustraliaMatch);
    if (filter === "favourites")
      return matches.filter((m) => favourites.has(m.id));
    return matches;
  }, [matches, filter, favourites]);

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

  // Jump to today on first render of the unfiltered list.
  useEffect(() => {
    const el = document.getElementById(`day-${todayMelbourneKey()}`);
    if (el) el.scrollIntoView({ block: "start" });
  }, []);

  const tab = (value: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      className={
        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
        (filter === value
          ? "bg-accent/15 text-accent"
          : "text-zinc-400 hover:text-zinc-200")
      }
    >
      {label}
    </button>
  );

  return (
    <div>
      <StaleBanner
        stale={stale || initialStale}
        lastUpdated={lastUpdated ?? initialLastUpdated}
      />
      <StatsPanel matches={matches} />
      <div className="sticky top-[57px] z-10 -mx-4 mb-3 flex gap-1 border-b border-edge bg-surface/95 px-4 py-2 backdrop-blur">
        {tab("all", "All")}
        {tab("australia", "Australia")}
        {tab("favourites", "Favourites")}
      </div>
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-zinc-400">
          {filter === "favourites"
            ? "No favourites yet. Tap the star on any match."
            : "No matches found."}
        </div>
      ) : (
        groups.map(([dateKey, dayMatches]) => (
          <section key={dateKey} id={`day-${dateKey}`} className="scroll-mt-28">
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
