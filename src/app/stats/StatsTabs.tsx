"use client";

import { useState } from "react";

import type { LeaderRow, LeadersPayload } from "@/lib/types";

type Tab = "scorers" | "assists" | "discipline";

function LeaderTable({
  rows,
  tab,
}: {
  rows: LeaderRow[];
  tab: Tab;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-zinc-400">
        Nothing yet, check back after a few matches.
      </div>
    );
  }
  // Shared ranks for tied values, like ESPN.
  let lastValue: string | null = null;
  let lastRank = 0;
  const ranked = rows.map((r, i) => {
    const key =
      tab === "discipline" ? `${r.secondary}|${r.value}` : String(r.value);
    if (key !== lastValue) {
      lastValue = key;
      lastRank = i + 1;
    }
    return { ...r, rank: lastRank };
  });

  return (
    <div className="rounded-2xl border border-edge bg-card px-4 py-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-500">
            <th className="w-8 py-2 font-medium">#</th>
            <th className="py-2 font-medium">Player</th>
            {tab === "discipline" ? (
              <>
                <th className="w-10 py-2 text-center font-medium">YC</th>
                <th className="w-10 py-2 text-center font-medium">RC</th>
              </>
            ) : (
              <th className="w-10 py-2 text-center font-medium">
                {tab === "scorers" ? "G" : "A"}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {ranked.map((r) => (
            <tr key={`${r.name}|${r.teamId}`} className="border-t border-edge/60">
              <td className="py-2 text-xs text-zinc-500">{r.rank}</td>
              <td className="py-2">
                <span className="flex items-center gap-2">
                  {r.flag && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.flag}
                      alt=""
                      width={18}
                      height={18}
                      loading="lazy"
                      className="h-auto w-[18px] rounded-sm"
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-zinc-200">
                      {r.name}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {r.teamName}
                    </span>
                  </span>
                </span>
              </td>
              {tab === "discipline" ? (
                <>
                  <td className="py-2 text-center font-bold tabular-nums text-amber-400">
                    {r.value}
                  </td>
                  <td className="py-2 text-center font-bold tabular-nums text-live">
                    {r.secondary}
                  </td>
                </>
              ) : (
                <td className="py-2 text-center font-bold tabular-nums text-zinc-100">
                  {r.value}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatsTabs({ leaders }: { leaders: LeadersPayload }) {
  const [tab, setTab] = useState<Tab>("scorers");

  const button = (value: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={
        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
        (tab === value
          ? "bg-accent/15 text-accent"
          : "text-zinc-400 hover:text-zinc-200")
      }
    >
      {label}
    </button>
  );

  const rows =
    tab === "scorers"
      ? leaders.scorers
      : tab === "assists"
        ? leaders.assists
        : leaders.discipline;

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {button("scorers", "Top scorers")}
        {button("assists", "Assists")}
        {button("discipline", "Discipline")}
      </div>
      <LeaderTable rows={rows} tab={tab} />
    </div>
  );
}
