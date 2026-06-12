import { StaleBanner } from "@/components/StaleBanner";
import { fetchGroupStandings } from "@/lib/espn";
import type { StandingRow } from "@/lib/types";

// Group tables refresh every 5 minutes; standings only move at full time.
export const revalidate = 300;

function GroupTable({ group, rows }: { group: string; rows: StandingRow[] }) {
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
            <tr key={r.teamId} className="border-t border-edge/60">
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
                  <span className="truncate font-medium text-zinc-200">
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

export default async function GroupsPage() {
  const result = await fetchGroupStandings();
  const groups = result.data ?? [];
  return (
    <div>
      <StaleBanner stale={result.stale} lastUpdated={result.lastUpdated} />
      <h1 className="mb-3 text-lg font-bold text-zinc-100">Groups</h1>
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-zinc-400">
          Standings unavailable right now.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <GroupTable key={g.group} group={g.group} rows={g.rows} />
          ))}
        </div>
      )}
    </div>
  );
}
