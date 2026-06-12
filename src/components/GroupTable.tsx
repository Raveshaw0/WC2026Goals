import type { StandingRow } from "@/lib/types";

export function GroupTable({
  group,
  rows,
  highlightTeamIds,
}: {
  group: string;
  rows: StandingRow[];
  highlightTeamIds?: string[];
}) {
  const highlight = new Set(highlightTeamIds ?? []);
  return (
    <div className="rounded-2xl border border-edge bg-card px-4 py-3">
      <h2 className="mb-2 text-sm font-bold text-zinc-100">Group {group}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-500">
            <th className="w-6 pb-1 font-medium">#</th>
            <th className="pb-1 font-medium">Team</th>
            <th className="w-8 pb-1 text-center font-medium">P</th>
            <th className="w-8 pb-1 text-center font-medium">W</th>
            <th className="w-8 pb-1 text-center font-medium">D</th>
            <th className="w-8 pb-1 text-center font-medium">L</th>
            <th className="w-10 pb-1 text-center font-medium">GD</th>
            <th className="w-10 pb-1 text-center font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.teamId}
              className={
                "border-t border-edge/60 " +
                (highlight.has(r.teamId) ? "bg-accent/[0.06]" : "")
              }
            >
              <td className="py-1.5 text-xs text-zinc-500">{r.rank}</td>
              <td className="py-1.5">
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
                  <span
                    className={
                      "truncate font-medium " +
                      (highlight.has(r.teamId)
                        ? "text-accent"
                        : "text-zinc-200")
                    }
                  >
                    {r.name}
                  </span>
                </span>
              </td>
              <td className="py-1.5 text-center tabular-nums text-zinc-400">
                {r.played}
              </td>
              <td className="py-1.5 text-center tabular-nums text-zinc-400">
                {r.wins}
              </td>
              <td className="py-1.5 text-center tabular-nums text-zinc-400">
                {r.draws}
              </td>
              <td className="py-1.5 text-center tabular-nums text-zinc-400">
                {r.losses}
              </td>
              <td className="py-1.5 text-center tabular-nums text-zinc-400">
                {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
              </td>
              <td className="py-1.5 text-center font-bold tabular-nums text-zinc-100">
                {r.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
