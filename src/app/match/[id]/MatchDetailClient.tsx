"use client";

import { EyeIcon, Flag, StarIcon } from "@/components/MatchCard";
import { SbsButtons } from "@/components/SbsButtons";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import { useUserState } from "@/hooks/useUserState";
import { melbourneDateTimeShort } from "@/lib/time";
import type { Goal, Match, TeamSide } from "@/lib/types";

const ROUND_LABELS: Record<string, string> = {
  "group-stage": "Group stage",
  "round-of-32": "Round of 32",
  "round-of-16": "Round of 16",
  quarterfinals: "Quarter-final",
  semifinals: "Semi-final",
  "3rd-place-match": "Third place match",
  final: "Final",
};

function goalLabel(g: Goal): string {
  let label = `${g.scorer} ${g.minute}`;
  if (g.penalty) label += " (pen)";
  if (g.ownGoal) label += " (og)";
  return label;
}

function TeamColumn({ team }: { team: TeamSide }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      <Flag team={team} size={48} />
      <span className="text-sm font-semibold text-zinc-100">{team.name}</span>
    </div>
  );
}

export function MatchDetailClient({
  initialMatch,
  liveUrl,
  highlightsUrl,
}: {
  initialMatch: Match;
  liveUrl: string | null;
  highlightsUrl: string | null;
}) {
  // Reuse the smart polling hook with a single match: it polls at 4s only
  // inside this match's live window, 5min otherwise, and pauses when hidden.
  const { matches } = useLiveMatches([initialMatch]);
  const match = matches[0] ?? initialMatch;
  const { watched, favourites, toggleWatched, toggleFavourite } =
    useUserState();
  const isWatched = watched.has(match.id);
  const isFavourite = favourites.has(match.id);

  const started =
    match.status !== "scheduled" && match.status !== "postponed";
  const finished = match.status === "finished";
  const shootout =
    match.home.shootoutScore !== null && match.away.shootoutScore !== null;

  const goals = match.goals.filter((g) => !g.shootout);
  const homeGoals = goals.filter((g) => g.teamId === match.home.id);
  const awayGoals = goals.filter((g) => g.teamId === match.away.id);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-edge bg-card px-4 py-5">
        <div className="mb-1 text-center text-xs text-zinc-500">
          {match.group !== null
            ? `Group ${match.group}`
            : ROUND_LABELS[match.round]}
          {match.venue && <> at {match.venue}</>}
          {match.city && <>, {match.city}</>}
        </div>
        <div className="mb-4 text-center text-xs text-zinc-500">
          {melbourneDateTimeShort(match.kickoff)} Melbourne time
        </div>
        <div className="flex items-start gap-3">
          <TeamColumn team={match.home} />
          <div className="flex flex-col items-center pt-2">
            {started ? (
              <>
                <div className="text-3xl font-bold tabular-nums text-zinc-100">
                  {match.home.score ?? "-"}
                  <span className="px-1 text-zinc-600">:</span>
                  {match.away.score ?? "-"}
                </div>
                {shootout && (
                  <div className="text-xs text-zinc-400">
                    ({match.home.shootoutScore}-{match.away.shootoutScore} pens)
                  </div>
                )}
                <div className="mt-1">
                  {match.status === "live" ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-live">
                      <span className="live-dot inline-block h-2 w-2 rounded-full bg-live" />
                      {match.displayClock || "Live"}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-zinc-400">
                      {match.status === "halftime" ? "HT" : match.statusDetail}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-lg font-bold text-zinc-500">v</div>
            )}
          </div>
          <TeamColumn team={match.away} />
        </div>

        {goals.length > 0 && (
          <div className="mt-4 flex gap-3 border-t border-edge pt-3 text-xs text-zinc-400">
            <div className="flex-1 space-y-0.5 text-right">
              {homeGoals.map((g, i) => (
                <div key={i}>{goalLabel(g)}</div>
              ))}
            </div>
            <div className="text-zinc-600">goals</div>
            <div className="flex-1 space-y-0.5">
              {awayGoals.map((g, i) => (
                <div key={i}>{goalLabel(g)}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      <SbsButtons match={match} liveUrl={liveUrl} highlightsUrl={highlightsUrl} />

      <div className="flex gap-2">
        {finished && (
          <button
            type="button"
            onClick={() => toggleWatched(match.id)}
            aria-pressed={isWatched}
            className={
              "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors " +
              (isWatched
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-edge text-zinc-400 hover:text-zinc-200")
            }
          >
            <EyeIcon />
            {isWatched ? "Watched" : "Mark watched"}
          </button>
        )}
        <button
          type="button"
          onClick={() => toggleFavourite(match.id)}
          aria-pressed={isFavourite}
          className={
            "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors " +
            (isFavourite
              ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
              : "border-edge text-zinc-400 hover:text-zinc-200")
          }
        >
          <StarIcon filled={isFavourite} />
          {isFavourite ? "Favourite" : "Add favourite"}
        </button>
      </div>
    </div>
  );
}
