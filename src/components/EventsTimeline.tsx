import type { Match, MatchEvent } from "@/lib/types";

function BallIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="#e4e4e7" />
      <polygon points="50,34 65,45 59,63 41,63 35,45" fill="#0a0e12" />
    </svg>
  );
}

function CardIcon({ color }: { color: "yellow" | "red" }) {
  return (
    <span
      className={
        "inline-block h-[15px] w-[11px] rounded-[2px] " +
        (color === "yellow" ? "bg-amber-400" : "bg-red-500")
      }
      aria-hidden="true"
    />
  );
}

function SubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      {/* up = on (mint), down = off (muted) */}
      <path d="M7 10l3-4 3 4z" fill="#34d399" />
      <path d="M17 14l-3 4-3-4z" fill="#a1a1aa" />
    </svg>
  );
}

function EventIcon({ ev }: { ev: MatchEvent }) {
  if (ev.type === "goal") return <BallIcon />;
  if (ev.type === "yellow") return <CardIcon color="yellow" />;
  if (ev.type === "red") return <CardIcon color="red" />;
  return <SubIcon />;
}

function EventLabel({ ev }: { ev: MatchEvent }) {
  if (ev.type === "goal") {
    return (
      <div>
        <span className="text-sm font-semibold text-zinc-100">
          {ev.player ?? "Goal"}
          {ev.penalty && <span className="text-zinc-500"> (pen)</span>}
          {ev.ownGoal && <span className="text-zinc-500"> (OG)</span>}
        </span>
        {ev.secondary && (
          <span className="block text-xs text-zinc-500">
            assist: {ev.secondary}
          </span>
        )}
      </div>
    );
  }
  if (ev.type === "yellow" || ev.type === "red") {
    return <span className="text-sm text-zinc-300">{ev.player}</span>;
  }
  // substitution
  return (
    <div className="text-xs leading-tight">
      <span className="text-emerald-400">{ev.player}</span>
      <span className="block text-zinc-500">{ev.secondary}</span>
    </div>
  );
}

// LiveScore-style vertical timeline: home events left, away events right,
// each with a type icon on the inner edge; period rows centered with the
// running score; goal rows carry a mint tint and the running score pill.
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
      <div className="overflow-hidden rounded-2xl border border-edge bg-card">
        {events.map((ev, i) => {
          if (ev.type === "halftime" || ev.type === "fulltime") {
            return (
              <div
                key={i}
                className="flex items-center justify-center gap-3 border-b border-edge/60 bg-cardSoft py-1.5 text-xs font-semibold text-zinc-400 last:border-b-0"
              >
                <span>{ev.type === "halftime" ? "HALF TIME" : "FULL TIME"}</span>
                <span className="tabular-nums text-zinc-500">
                  {ev.homeScore} - {ev.awayScore}
                </span>
              </div>
            );
          }
          const away = ev.side === "away";
          return (
            <div
              key={i}
              className={
                "flex items-center gap-2 border-b border-edge/60 px-3 py-2 last:border-b-0 " +
                (ev.type === "goal" ? "bg-accent/[0.07]" : "")
              }
            >
              <span className="w-11 shrink-0 font-mono text-xs text-zinc-500">
                {ev.minute}
              </span>
              {/* home content on the left, icon on the inner edge */}
              <div className="flex flex-1 items-center gap-2">
                {!away && (
                  <>
                    <span className="shrink-0">
                      <EventIcon ev={ev} />
                    </span>
                    <div className="min-w-0">
                      <EventLabel ev={ev} />
                    </div>
                  </>
                )}
              </div>
              {/* away content on the right, icon on the inner edge */}
              <div className="flex flex-1 items-center justify-end gap-2 text-right">
                {away && (
                  <>
                    <div className="min-w-0">
                      <EventLabel ev={ev} />
                    </div>
                    <span className="shrink-0">
                      <EventIcon ev={ev} />
                    </span>
                  </>
                )}
              </div>
              {ev.type === "goal" ? (
                <span className="w-12 shrink-0 text-center text-xs font-bold tabular-nums text-accent">
                  {ev.homeScore}-{ev.awayScore}
                </span>
              ) : (
                <span aria-hidden="true" className="w-12 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
