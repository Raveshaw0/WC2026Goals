import type { MatchStatPair } from "@/lib/types";

// LiveScore-style stat rows: values either side of a centered label, with a
// split bar showing the share. The leading side's value is highlighted.
export function MatchStats({ stats }: { stats: MatchStatPair[] }) {
  if (stats.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">
        Match stats
      </h2>
      <div className="space-y-3 rounded-2xl border border-edge bg-card px-4 py-4">
        {stats.map((s) => {
          const homeLeads = s.homePct > 0.5;
          const awayLeads = s.homePct < 0.5;
          return (
            <div key={s.label}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span
                  className={
                    "tabular-nums " +
                    (homeLeads ? "font-bold text-accent" : "text-zinc-300")
                  }
                >
                  {s.home}
                </span>
                <span className="text-xs text-zinc-500">{s.label}</span>
                <span
                  className={
                    "tabular-nums " +
                    (awayLeads ? "font-bold text-accent" : "text-zinc-300")
                  }
                >
                  {s.away}
                </span>
              </div>
              <div className="flex h-1.5 gap-1 overflow-hidden">
                <div className="flex flex-1 justify-end rounded-full bg-cardSoft">
                  <div
                    className={
                      "h-full rounded-full " +
                      (homeLeads ? "bg-accent" : "bg-zinc-600")
                    }
                    style={{ width: `${Math.round(s.homePct * 100)}%` }}
                  />
                </div>
                <div className="flex flex-1 rounded-full bg-cardSoft">
                  <div
                    className={
                      "h-full rounded-full " +
                      (awayLeads ? "bg-accent" : "bg-zinc-600")
                    }
                    style={{ width: `${Math.round((1 - s.homePct) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
