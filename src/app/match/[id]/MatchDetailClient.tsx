"use client";

import { useEffect, useRef, useState } from "react";

import { ClipsHighlights } from "@/components/ClipsHighlights";
import { EventsTimeline } from "@/components/EventsTimeline";
import { LineupPitch } from "@/components/LineupPitch";
import { GroupTable } from "@/components/GroupTable";
import { Lineups } from "@/components/Lineups";
import { EyeIcon, Flag, StarIcon } from "@/components/MatchCard";
import { MatchStats } from "@/components/MatchStats";
import { SbsButtons } from "@/components/SbsButtons";
import { SpoilerCover } from "@/components/SpoilerCover";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import { useSpoiler } from "@/hooks/useSpoiler";
import { useUserState } from "@/hooks/useUserState";
import type { MatchClips } from "@/lib/clips";
import { isInLiveWindow, liveWindowFor } from "@/lib/liveWindow";
import { melbourneDateTimeShort } from "@/lib/time";
import type { GroupStanding, Match, MatchSummary, TeamSide } from "@/lib/types";

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
// itself rides the faster 4s /api/live poll via useLiveMatches. Also returns
// in-game highlight clips, which refresh on the same cadence (new goal clips
// appear during the match).
function useSummaryPolling(
  match: Match,
  initial: MatchSummary,
  initialClips: MatchClips | null
): { summary: MatchSummary; clips: MatchClips | null } {
  const [summary, setSummary] = useState(initial);
  const [clips, setClips] = useState(initialClips);
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

    const fetchOnce = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/match/${match.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.summary) setSummary(data.summary);
          // Only replace clips when the feed has some, so a transient empty
          // feed never wipes clips already on screen.
          if (data.clips && data.clips.clips?.length) setClips(data.clips);
        }
      } catch {
        // transient; next tick retries
      }
    };

    // Always refresh once on mount. Next's client router cache can serve a
    // stale page on back-navigation, so the server-rendered summary may lag
    // (e.g. events frozen at the score from when you first opened the match).
    void fetchOnce();

    // Refresh the moment the tab regains focus (e.g. returning from the SBS
    // stream), so events/stats aren't stuck until the next interval tick.
    const onVisibility = () => {
      if (!document.hidden && shouldPoll()) void fetchOnce();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let t: ReturnType<typeof setInterval> | null = null;
    if (shouldPoll()) {
      t = setInterval(() => {
        if (shouldPoll()) void fetchOnce();
      }, 60_000);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (t) clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id, match.status]);
  return { summary, clips };
}

// Pseudo-live match minute. ESPN's clock only changes in ~minute chunks even
// when polled every 4s, so we tick locally between polls for a live feel:
// anchor on ESPN's clock (seconds) and the wall-clock moment it last changed,
// then advance one second at a time, re-syncing on every poll. Stoppage time
// (displayClock has "+") is shown verbatim, halftime is handled by the caller.
function useLiveMinute(match: Match): string {
  const anchor = useRef({ clock: match.clock, at: Date.now() });
  const [, force] = useState(0);

  if (anchor.current.clock !== match.clock) {
    anchor.current = { clock: match.clock, at: Date.now() };
  }

  const live = match.status === "live";
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [live]);

  if (!live) return match.displayClock || "Live";
  // During stoppage ESPN's "45'+3'" is authoritative; don't interpolate.
  if (match.displayClock.includes("+")) return match.displayClock;
  const secs =
    anchor.current.clock + (Date.now() - anchor.current.at) / 1000;
  return `${Math.floor(secs / 60)}'`;
}

function BallIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="46" fill="#e4e4e7" />
      <polygon points="50,34 65,45 59,63 41,63 35,45" fill="#0a0e12" />
    </svg>
  );
}

// Scorers for one team, grouped by player with their minutes, e.g.
// "Folarin Balogun 31', 45'+5'". Own goals and penalties are flagged. Own
// goals already sit under the team they counted FOR (ESPN credits the
// beneficiary), which is the LiveScore convention.
function teamScorerLines(
  goals: { minute: string; scorer: string; penalty: boolean; ownGoal: boolean }[]
): { scorer: string; minutes: string }[] {
  const order: string[] = [];
  const byScorer = new Map<string, string[]>();
  for (const g of goals) {
    const mark = g.penalty ? " (P)" : g.ownGoal ? " (OG)" : "";
    const m = `${g.minute}${mark}`;
    if (!byScorer.has(g.scorer)) {
      byScorer.set(g.scorer, []);
      order.push(g.scorer);
    }
    byScorer.get(g.scorer)!.push(m);
  }
  return order.map((scorer) => ({
    scorer,
    minutes: byScorer.get(scorer)!.join(", "),
  }));
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

const SBS_HUB = "https://www.sbs.com.au/ondemand/fifa-world-cup-2026";

type DetailTab = "stats" | "events" | "lineups" | "table" | "watch";

export function MatchDetailClient({
  initialMatch,
  initialSummary,
  groupTable,
  initialClips,
}: {
  initialMatch: Match;
  initialSummary: MatchSummary;
  groupTable: GroupStanding | null;
  initialClips: MatchClips | null;
}) {
  const [tab, setTab] = useState<DetailTab>("stats");
  // Reuse the smart polling hook with a single match: it polls at 4s only
  // inside this match's live window, 5min otherwise, and pauses when hidden.
  const { matches } = useLiveMatches([initialMatch]);
  const match = matches[0] ?? initialMatch;
  const { summary, clips } = useSummaryPolling(match, initialSummary, initialClips);
  const liveMinute = useLiveMinute(match);
  const { watched, favourites, toggleWatched, toggleFavourite } =
    useUserState();
  const spoiler = useSpoiler();
  const matchHidden = spoiler.matchHidden(match.id);
  const isWatched = watched.has(match.id);
  const isFavourite = favourites.has(match.id);

  const started =
    match.status !== "scheduled" && match.status !== "postponed";
  const finished = match.status === "finished";
  const shootout =
    match.home.shootoutScore !== null && match.away.shootoutScore !== null;
  // Live window also covers the few minutes either side of kickoff.
  const inLiveWindow = isInLiveWindow(match);

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
                <SpoilerCover matchId={match.id} label="" rounded="rounded-lg">
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
                </SpoilerCover>
                <div className="mt-1">
                  {match.status === "live" ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-live">
                      <span className="live-dot inline-block h-2 w-2 rounded-full bg-live" />
                      {liveMinute}
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

        {started &&
          match.goals.some((g) => !g.shootout) &&
          (() => {
            const homeLines = teamScorerLines(
              match.goals.filter((g) => !g.shootout && g.teamId === match.home.id)
            );
            const awayLines = teamScorerLines(
              match.goals.filter((g) => !g.shootout && g.teamId === match.away.id)
            );
            return (
              <div className="mt-4 border-t border-edge/60 pt-3">
                <SpoilerCover matchId={match.id} label="Reveal scorers">
                  <div className="flex items-start gap-2 text-xs text-zinc-400">
                    <ul className="flex-1 space-y-0.5">
                      {homeLines.map((l) => (
                        <li key={l.scorer}>
                          <span className="text-zinc-300">{l.scorer}</span>{" "}
                          <span className="tabular-nums text-zinc-500">
                            {l.minutes}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <BallIcon className="mt-0.5 shrink-0" />
                    <ul className="flex-1 space-y-0.5 text-right">
                      {awayLines.map((l) => (
                        <li key={l.scorer}>
                          <span className="tabular-nums text-zinc-500">
                            {l.minutes}
                          </span>{" "}
                          <span className="text-zinc-300">{l.scorer}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </SpoilerCover>
              </div>
            );
          })()}
      </div>

      {clips && clips.clips.length > 0 && <ClipsHighlights data={clips} />}

      {inLiveWindow && (
        <a
          href={match.sbs?.live ?? SBS_HUB}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-center text-sm font-bold text-surface transition-opacity hover:opacity-90"
        >
          <span className="live-dot inline-block h-2 w-2 rounded-full bg-surface" />
          Watch live on SBS
        </a>
      )}

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
            ...(groupTable ? [["table", "Table"]] : []),
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
            <SpoilerCover matchId={match.id} label="Reveal stats">
              <MatchStats stats={summary.stats} />
            </SpoilerCover>
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
          <SpoilerCover matchId={match.id} label="Reveal events">
            <EventsTimeline events={summary.events} match={match} />
          </SpoilerCover>
        ) : (
          <TabPlaceholder text="Events appear once the match kicks off" />
        ))}

      {tab === "lineups" &&
        (() => {
          const homeLine = summary.lineups.find(
            (l) => l.teamId === match.home.id
          );
          const awayLine = summary.lineups.find(
            (l) => l.teamId === match.away.id
          );
          return (
            <div className="space-y-4">
              {homeLine && awayLine && (
                <LineupPitch
                  home={homeLine}
                  away={awayLine}
                  events={summary.events}
                  hideGoals={matchHidden}
                />
              )}
              <Lineups lineups={summary.lineups} events={summary.events} />
            </div>
          );
        })()}

      {tab === "table" && groupTable && (
        <SpoilerCover sectionKey="tables" label="Reveal table">
          <GroupTable
            group={groupTable.group}
            rows={groupTable.rows}
            highlightTeamIds={[match.home.id, match.away.id]}
          />
        </SpoilerCover>
      )}

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
