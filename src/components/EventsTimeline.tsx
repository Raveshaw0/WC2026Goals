import type { Match, MatchEvent } from "@/lib/types";

function CardSquare({ color }: { color: "yellow" | "red" }) {
  return (
    <span
      className={
        "inline-block h-3 w-2.5 rounded-[2px] " +
        (color === "yellow" ? "bg-amber-400" : "bg-live")
      }
      aria-hidden="true"
    />
  );
}

function EventBody({ ev }: { ev: MatchEvent }) {
  if (ev.type === "goal") {
    return (
      <div>
        <span className="text-sm font-semibold text-zinc-100">
          {ev.player ?? "Goal"}
          {ev.penalty && <span className="text-zinc-500"> (pen)</span>}
          {ev.ownGoal && <span className="text-zinc-500"> (og)</span>}
        </span>
        {ev.secondary && (
          <span className="block text-xs text-zinc-500">{ev.secondary}</span>
        )}
      </div>
    );
  }
  if (ev.type === "yellow" || ev.type === "red") {
    return (
      <span className="flex items-center gap-1.5 text-sm text-zinc-300">
        <CardSquare color={ev.type} />
        {ev.player}
      </span>
    );
  }
  // substitution
  return (
    <div className="text-xs">
      <span className="text-accent">{ev.player}</span>
      <span className="block text-zinc-500">{ev.secondary}</span>
    </div>
  );
}

// LiveScore-style vertical timeline: home events left, away events right,
// period rows centered with the running score.
export function EventsTimeline({
  events,
  match,
}: {
  events: MatchEvent[];
  match: Match;
}) {
  if (events.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">
        Events
      </h2>
      <div className="rounded-2xl border border-edge bg-card px-4 py-2">
        {events.map((ev, i) => {
          if (ev.type === "halftime" || ev.type === "fulltime") {
            return (
              <div
                key={i}
                className="flex items-center justify-between border-b border-edge/60 py-2 text-xs font-semibold text-zinc-500 last:border-b-0"
              >
                <span>{ev.type === "halftime" ? "HT" : "FT"}</span>
                <span className="tabular-nums">
                  {ev.homeScore} - {ev.awayScore}
                </span>
                <span aria-hidden="true" className="w-4" />
              </div>
            );
          }
          return (
            <div
              key={i}
              className="flex items-start gap-3 border-b border-edge/60 py-2 last:border-b-0"
            >
              <span className="w-12 shrink-0 pt-0.5 font-mono text-xs text-zinc-500">
                {ev.minute}
              </span>
              <div
                className={
                  "flex-1 " + (ev.side === "away" ? "text-right" : "")
                }
              >
                <div className={ev.side === "away" ? "flex justify-end" : ""}>
                  <EventBody ev={ev} />
                </div>
              </div>
              {ev.type === "goal" && (
                <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold tabular-nums text-accent">
                  {ev.homeScore} - {ev.awayScore}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
