"use client";

import { useEffect, useRef, useState } from "react";

import { anyLiveWindow } from "@/lib/liveWindow";
import type { Match } from "@/lib/types";

const LIVE_INTERVAL_MS = 4_000;
const IDLE_INTERVAL_MS = 5 * 60_000;

interface LiveData {
  matches: Match[];
  stale: boolean;
  lastUpdated: string | null;
}

// Smart polling: 4s while any match is in its live window (kickoff minus 5min
// to kickoff plus 150min, 180 for knockouts), 5min otherwise, fully stopped
// while the tab is hidden. Windows are derived from the schedule we already
// hold; we never poll blindly.
export function useLiveMatches(initialMatches: Match[]): LiveData {
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [stale, setStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const matchesRef = useRef(matches);
  matchesRef.current = matches;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const schedule = () => {
      if (disposed || document.hidden) return;
      if (timer) clearTimeout(timer);
      const interval = anyLiveWindow(matchesRef.current)
        ? LIVE_INTERVAL_MS
        : IDLE_INTERVAL_MS;
      timer = setTimeout(tick, interval);
    };

    const tick = async () => {
      try {
        const res = await fetch("/api/live");
        if (res.ok) {
          const data = await res.json();
          const updates: Match[] = Array.isArray(data.matches)
            ? data.matches
            : [];
          if (!disposed && updates.length > 0) {
            const byId = new Map(updates.map((m) => [m.id, m] as const));
            setMatches((prev) => prev.map((m) => byId.get(m.id) ?? m));
          }
          if (!disposed) {
            setStale(Boolean(data.stale));
            if (data.lastUpdated) setLastUpdated(data.lastUpdated);
          }
        }
      } catch {
        if (!disposed) setStale(true);
      } finally {
        schedule();
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (timer) clearTimeout(timer);
      } else {
        void tick(); // catch up immediately, then reschedule
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    void tick(); // initial refresh on mount

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { matches, stale, lastUpdated };
}
