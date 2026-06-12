"use client";

import { useEffect, useState } from "react";

import { EventsTimeline } from "@/components/EventsTimeline";
import { Lineups } from "@/components/Lineups";
import { EyeIcon, Flag, StarIcon } from "@/components/MatchCard";
import { MatchStats } from "@/components/MatchStats";
import { SbsButtons } from "@/components/SbsButtons";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import { useUserState } from "@/hooks/useUserState";
import { isInLiveWindow, liveWindowFor } from "@/lib/liveWindow";
import { melbourneDateTimeShort } from "@/lib/time";
import type { Match, MatchSummary, TeamSide } from "@/lib/types";

const ROUND_LABELS: Record<string, string> = {
  "group-stage": "Group stage",
  "round-of-32": "Round of 32",
  "round-of-16": "Round of 16",
  quarterfinals: "Quarter-final",
  semifinals: "Semi-final",
  "3rd-place-match": "Third place match",
  final: "Final",
};

function TeamColumn({ team }: { team: TeamSide }) {
  const { favouriteTeams, toggleFavouriteTeam } = useUserState();
  // Knockout placeholders ("Group A Winner", "Semifinal 1 Loser") are not
  // real teams yet
  const isRealTeam =
    /^[0-9]+$/.test(team.id) && !/Winner|Loser|Place/.test(team.name);
  const isFav = favouriteTeams.has(team.id);
  return (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      <Flag team={team} size={48} />
      <span className="text-sm font-semibold text-zinc-100">{team.name}</span>
      {isRealTeam && (
        <button
          type="button"
          aria-pressed={isFav}
          onClick={() => toggleFavouriteTeam(team.id)}
          className={
            "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors " +
            (isFav
              ? "bg-amber-400/10 text-amber-400"
              : "text-zinc-500 hover:text-zinc-300")
          }
        >
          <StarIcon filled={isFav} />
          {isFav ? "Following" : "Follow team"}
        </button>
      )}
    </div>
  );
}

// Poll the summary (events, stats, lineups) every 60s from 75 minutes before
// kickoff (lineups publish ~1hr out) until the live window closes. The score
// itself rides the faster 4s /api/live poll via useLiveMatches.
function useSummaryPolling(match: Match, initial: MatchSummary): MatchSummary {
  const [summary, setSummary] = useState(initial);
  useEffect(() => {
    const shouldPoll = () => {
      if (match.status === "finished" || match.status === "postponed") {
        return false;
      }
      const ko = new Date(match.kickoff).getTime();
      const { end } = liveWindowFor(match);
      const now = Date.now();
      return now >= ko - 75 * 60 * 1000 && now <= end;
    };
    if (!shouldPoll()) return;

    const tick = async () => {
      if (document.hidden || !shouldPoll()) return;
      try {
        const res = await fetch(`/api/match/${match.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.summary) setSummary(data.summary);
        }
      } catch {
        // transient; next tick retries
      }
    };
    const t = setInterval(() => void tick(), 60_000);
    void tick();
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id, match.status]);
  return summary;
}

function HighlightsEmbed({ match }: { match: Match }) {
  if (!match.sbs?.ytHighlightsId) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-edge bg-card">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${match.sbs.ytHighlightsId}`}
          title={`${match.home.name} v ${match.away.name} highlights`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}

function TabPlaceholder({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-zinc-400">
      {text}
    </div>
  );
}

type DetailTab = "stats" | "events" | "lineups" | "watch";

export function MatchDetailClient({
  initialMatch,
  initialSummary,
}: {
  initialMatch: Match;
  initialSummary: MatchSummary;
}) {
  const [tab, setTab] = useState<DetailTab>("stats");
  // Reuse the smart polling hook with a single match: it polls at 4s only
  // inside this match's live window, 5min otherwise, and pauses when hidden.
  const { matches } = useLiveMatches([initialMatch]);
  const match = matches[0] ?? initialMatch;
  const summary = useSummaryPolling(match, initialSummary);
  const { watched, favourites, toggleWatched, toggleFavourite } =
    useUserState();
  const isWatched = watched.has(match.id);
  const isFavourite = favourites.has(match.id);

  const started =
    match.status !== "scheduled" && match.status !== "postponed";
  const finished = match.status === "finished";
  const shootout =
    match.home.shootoutScore !== null && match.away.shootoutScore !== null;

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
      </div>

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

      <div className="flex gap-1">
        {(
          [
            ["stats", "Stats"],
            ["events", "Events"],
            ["lineups", "Lineups"],
            ["watch", "Watch"],
          ] as Array<[DetailTab, string]>
        ).map(([value, label]) => (
          <button
            key={value}
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
        ))}
      </div>

      {tab === "stats" && (
        <div className="space-y-4">
          {finished && <HighlightsEmbed match={match} />}
          {summary.stats.length > 0 ? (
            <MatchStats stats={summary.stats} />
          ) : (
            !(finished && match.sbs?.ytHighlightsId) && (
              <TabPlaceholder
                text={
                  finished
                    ? "Stats unavailable for this match"
                    : "Stats appear once the match kicks off"
                }
              />
            )
          )}
        </div>
      )}

      {tab === "events" &&
        (summary.events.length > 0 ? (
          <EventsTimeline events={summary.events} match={match} />
        ) : (
          <TabPlaceholder text="Events appear once the match kicks off" />
        ))}

      {tab === "lineups" && <Lineups lineups={summary.lineups} />}

      {tab === "watch" && (
        <div className="space-y-4">
          {finished && <HighlightsEmbed match={match} />}
          <SbsButtons match={match} />
          {match.status === "scheduled" && !isInLiveWindow(match) && (
            <TabPlaceholder text="The SBS live link appears here close to kickoff, highlights after full time" />
          )}
        </div>
      )}
    </div>
  );
}
