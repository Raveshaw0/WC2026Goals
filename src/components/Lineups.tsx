import type { LineupPlayer, TeamLineup } from "@/lib/types";

function PlayerRow({ p }: { p: LineupPlayer }) {
  return (
    <li className="flex items-baseline gap-2 py-0.5 text-sm">
      <span className="w-6 shrink-0 text-right font-mono text-xs text-zinc-500">
        {p.jersey}
      </span>
      <span className="min-w-0 flex-1 truncate text-zinc-200">{p.name}</span>
      <span className="shrink-0 text-xs text-zinc-500">{p.position}</span>
      {p.subbedOut && (
        <span className="shrink-0 text-xs text-live" title="Subbed off">
          off
        </span>
      )}
      {p.subbedIn && (
        <span className="shrink-0 text-xs text-accent" title="Subbed on">
          on
        </span>
      )}
    </li>
  );
}

export function Lineups({ lineups }: { lineups: TeamLineup[] }) {
  if (lineups.length === 0) {
    return (
      <div className="rounded-2xl border border-edge bg-card px-4 py-6 text-center text-sm text-zinc-400">
        Lineups TBC, usually ~1hr before kickoff
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {lineups.map((team) => (
        <div
          key={team.teamId}
          className="rounded-2xl border border-edge bg-card px-4 py-3"
        >
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">
              {team.teamName}
            </h3>
            {team.formation && (
              <span className="text-xs text-zinc-500">{team.formation}</span>
            )}
          </div>
          <ul>
            {team.starters.map((p) => (
              <PlayerRow key={`${p.jersey}-${p.name}`} p={p} />
            ))}
          </ul>
          {team.bench.length > 0 && (
            <>
              <div className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Bench
              </div>
              <ul>
                {team.bench.map((p) => (
                  <PlayerRow key={`${p.jersey}-${p.name}`} p={p} />
                ))}
              </ul>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
