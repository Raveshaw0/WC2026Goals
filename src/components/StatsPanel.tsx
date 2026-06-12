"use client";

import { useEffect, useRef, useState } from "react";

import { useUserState } from "@/hooks/useUserState";
import type { Match } from "@/lib/types";

function regulationGoals(match: Match): number {
  // Regular and extra time goals only; penalty shootout kicks excluded.
  return match.goals.filter((g) => !g.shootout).length;
}

// Compact, collapsible stats panel for the top of the schedule page.
export function StatsPanel({ matches }: { matches: Match[] }) {
  const { watched, favourites } = useUserState();
  const [open, setOpen] = useState(true);

  const finished = matches.filter((m) => m.status === "finished");
  // A match with no goal data at all and a 0-0 score could be either a real
  // 0-0 or missing data; goals arrays come straight from ESPN details so an
  // empty array on a finished match is trusted as 0-0. Matches absent from
  // ESPN data entirely are excluded by construction (they are not in the
  // list).
  const watchedFinished = finished.filter((m) => watched.has(m.id));

  // "Goals scored in the tournament so far" includes live matches in progress.
  const totalGoals = matches.reduce((sum, m) => sum + regulationGoals(m), 0);
  const seenGoals = watchedFinished.reduce(
    (sum, m) => sum + regulationGoals(m),
    0
  );
  const pct = totalGoals > 0 ? Math.round((seenGoals / totalGoals) * 100) : 0;
  const watchedPct =
    finished.length > 0
      ? Math.round((watchedFinished.length / finished.length) * 100)
      : 0;

  // Subtle pop animation when the percentage changes.
  const prevPct = useRef(pct);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    if (prevPct.current !== pct) {
      prevPct.current = pct;
      setPop(true);
      const t = setTimeout(() => setPop(false), 600);
      return () => clearTimeout(t);
    }
  }, [pct]);

  return (
    <section className="mb-4 rounded-2xl border border-edge bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-zinc-100">Your stats</span>
        <span className="text-xs text-zinc-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-4">
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-zinc-400">Matches watched</span>
              <span className="font-semibold text-zinc-100">
                {watchedFinished.length}
                <span className="font-normal text-zinc-500">
                  {" "}
                  of {finished.length} finished
                </span>
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cardSoft">
              <div
                className="progress-bar h-full rounded-full bg-accent"
                style={{ width: `${watchedPct}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Goals seen</span>
            <span className="font-semibold text-zinc-100">
              {seenGoals}
              <span className="font-normal text-zinc-500">
                {" "}
                of {totalGoals}
              </span>
              <span
                className={
                  "ml-2 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent " +
                  (pop ? "stat-pop" : "")
                }
              >
                {pct}%
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Favourites</span>
            <span className="font-semibold text-zinc-100">
              {favourites.size}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
