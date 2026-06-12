"use client";

import { useEffect, useMemo, useState } from "react";

import { MatchCard } from "@/components/MatchCard";
import { StaleBanner } from "@/components/StaleBanner";
import { StatsPanel } from "@/components/StatsPanel";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import { useUserState } from "@/hooks/useUserState";
import { melbourneDateHeading, melbourneDateKey, todayMelbourneKey } from "@/lib/time";
import type { Match } from "@/lib/types";

export type Filter = "all" | "australia" | "favourites";

function isAustraliaMatch(m: Match): boolean {
  return m.home.name === "Australia" || m.away.name === "Australia";
}

type DayGroup = [string, Match[]];

function DaySection({ dateKey, dayMatches }: { dateKey: string; dayMatches: Match[] }) {
  return (
    <section id={`day-${dateKey}`} className="scroll-mt-32">
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
  );
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
  const [showPast, setShowPast] = useState(false);

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

  // Group by Melbourne calendar date, in kickoff order. Days before today
  // collapse behind a toggle so the page always loads with the stats panel
  // and today's matches in view, no scroll tricks.
  const { past, current } = useMemo(() => {
    const byDate = new Map<string, Match[]>();
    for (const m of filtered) {
      const key = melbourneDateKey(m.kickoff);
      const list = byDate.get(key);
      if (list) list.push(m);
      else byDate.set(key, [m]);
    }
    const groups: DayGroup[] = Array.from(byDate.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const todayKey = todayMelbourneKey();
    return {
      past: groups.filter(([k]) => k < todayKey),
      current: groups.filter(([k]) => k >= todayKey),
    };
  }, [filtered]);

  return (
    <div>
      <StaleBanner
        stale={stale || initialStale}
        lastUpdated={lastUpdated ?? initialLastUpdated}
      />
      <StatsPanel matches={matches} />

      {past.length > 0 && (
        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          className="mt-1 w-full rounded-xl border border-edge px-4 py-2 text-center text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
        >
          {showPast
            ? "Hide earlier days"
            : `Show earlier days (${past.length})`}
        </button>
      )}
      {showPast && past.map(([k, ms]) => <DaySection key={k} dateKey={k} dayMatches={ms} />)}

      {current.length === 0 && past.length === 0 ? (
        <div className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-zinc-400">
          {filter === "favourites"
            ? "Nothing here yet. Star a match, or follow a team from its match page."
            : "No matches found."}
        </div>
      ) : (
        current.map(([k, ms]) => <DaySection key={k} dateKey={k} dayMatches={ms} />)
      )}
    </div>
  );
}
