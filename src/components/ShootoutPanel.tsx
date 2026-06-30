import type { Match, ShootoutShot, ShootoutTeam } from "@/lib/types";

import { Flag } from "./MatchCard";

function ScoredMark() {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"
      title="Scored"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function MissedMark() {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/10 text-red-400"
      title="Missed"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </svg>
    </span>
  );
}

function HomeShot({ shot }: { shot: ShootoutShot | undefined }) {
  if (!shot) return <div className="flex-1" />;
  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
      <span
        className={
          "truncate text-sm " + (shot.scored ? "text-zinc-200" : "text-zinc-500")
        }
      >
        {shot.player}
      </span>
      {shot.scored ? <ScoredMark /> : <MissedMark />}
    </div>
  );
}

function AwayShot({ shot }: { shot: ShootoutShot | undefined }) {
  if (!shot) return <div className="flex-1" />;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {shot.scored ? <ScoredMark /> : <MissedMark />}
      <span
        className={
          "truncate text-sm " + (shot.scored ? "text-zinc-200" : "text-zinc-500")
        }
      >
        {shot.player}
      </span>
    </div>
  );
}

// Penalty shootout grid: home takers down the left, away down the right,
// aligned round by round, each with a scored/missed mark. The score in the
// header is derived from the marks so it always agrees with what's shown.
export function ShootoutPanel({
  shootout,
  match,
}: {
  shootout: ShootoutTeam[];
  match: Match;
}) {
  const home = shootout.find((t) => t.teamId === match.home.id);
  const away = shootout.find((t) => t.teamId === match.away.id);
  if (!home && !away) return null;

  const homeShots = home?.shots ?? [];
  const awayShots = away?.shots ?? [];
  const rounds = Math.max(homeShots.length, awayShots.length);
  const homeScore = homeShots.filter((s) => s.scored).length;
  const awayScore = awayShots.filter((s) => s.scored).length;

  return (
    <section>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">
        Penalty shootout
      </h2>
      <div className="overflow-hidden rounded-2xl border border-edge bg-card">
        <div className="flex items-center justify-center gap-3 border-b border-edge/60 bg-cardSoft py-2">
          <div className="flex items-center gap-1.5">
            <Flag team={match.home} size={18} />
            <span className="text-xs font-semibold text-zinc-300">
              {match.home.abbrev || match.home.shortName}
            </span>
          </div>
          <span className="text-sm font-bold tabular-nums text-accent">
            {homeScore} - {awayScore}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-zinc-300">
              {match.away.abbrev || match.away.shortName}
            </span>
            <Flag team={match.away} size={18} />
          </div>
        </div>
        {Array.from({ length: rounds }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-2 border-b border-edge/60 px-3 py-2 last:border-b-0"
          >
            <HomeShot shot={homeShots[i]} />
            <span
              className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-zinc-400"
              title={`Penalty ${i + 1}`}
            >
              {i + 1}
            </span>
            <AwayShot shot={awayShots[i]} />
          </div>
        ))}
      </div>
    </section>
  );
}
