import type { LineupPlayer, MatchEvent, TeamLineup } from "@/lib/types";

// Plot starting XIs onto a pitch from ESPN position abbreviations (G, RB,
// CD-L, AM-R, F, ...). The abbreviations encode both the line and the
// left/right placement, which reconstructs the formation shape reliably
// (formationPlace is only a tiebreak). Home occupies the top half attacking
// down, away the bottom half attacking up, meeting at the halfway line.
// Each marker carries a compact caption of that player's match events
// (goals, cards, substituted-off) with minutes, so the pitch tells the story.

function band(posRaw: string): number {
  const p = posRaw.toUpperCase();
  if (p === "G" || p.startsWith("GK")) return 0;
  if (p.startsWith("AM") || p.includes("CAM")) return 4;
  if (p.includes("WB")) return 1;
  if (p.startsWith("DM") || p.includes("CDM")) return 2;
  if (
    p.startsWith("F") ||
    p.includes("CF") ||
    p.includes("ST") ||
    p.endsWith("W") ||
    p.startsWith("W")
  ) {
    return 5;
  }
  if (p.startsWith("D") || p.endsWith("B") || p.includes("CB") || p.includes("CD")) {
    return 1;
  }
  return 3;
}

function sideRank(posRaw: string): number {
  const p = posRaw.toUpperCase();
  if (p.startsWith("L")) return -2;
  if (p.endsWith("-L")) return -1;
  if (p.startsWith("R")) return 2;
  if (p.endsWith("-R")) return 1;
  return 0;
}

interface Plotted {
  player: LineupPlayer;
  x: number;
  y: number;
}

function layout(starters: LineupPlayer[]): Plotted[] {
  const byBand = new Map<number, LineupPlayer[]>();
  for (const p of starters) {
    const b = band(p.position);
    const arr = byBand.get(b) ?? [];
    arr.push(p);
    byBand.set(b, arr);
  }
  const bands = Array.from(byBand.keys()).sort((a, b) => a - b);
  const rows = bands.length;
  const out: Plotted[] = [];
  bands.forEach((b, depth) => {
    const line = byBand
      .get(b)!
      .slice()
      .sort(
        (a, c) =>
          sideRank(a.position) - sideRank(c.position) ||
          a.formationPlace - c.formationPlace
      );
    line.forEach((player, j) => {
      out.push({
        player,
        x: (j + 1) / (line.length + 1),
        y: rows <= 1 ? 0 : depth / (rows - 1),
      });
    });
  });
  return out;
}

function lastName(name: string): string {
  const parts = name.split(" ");
  return parts[parts.length - 1];
}

// Per-player event summary keyed by full name.
interface PlayerEvents {
  goals: { minute: string; og: boolean; pen: boolean }[];
  yellow?: string;
  red?: string;
  subOff?: string;
}

function buildEventMap(events: MatchEvent[]): Map<string, PlayerEvents> {
  const map = new Map<string, PlayerEvents>();
  const get = (name: string) => {
    const e = map.get(name) ?? { goals: [] };
    map.set(name, e);
    return e;
  };
  for (const ev of events) {
    if (ev.type === "goal" && ev.player) {
      get(ev.player).goals.push({
        minute: ev.minute,
        og: ev.ownGoal,
        pen: ev.penalty,
      });
    } else if (ev.type === "yellow" && ev.player) {
      get(ev.player).yellow = ev.minute;
    } else if (ev.type === "red" && ev.player) {
      get(ev.player).red = ev.minute;
    } else if (ev.type === "sub" && ev.secondary) {
      get(ev.secondary).subOff = ev.minute; // secondary = player coming off
    }
  }
  return map;
}

// Classic panel soccer ball: white sphere, dark rim, centre pentagon and five
// spokes to the rim. Reads clearly as a ball even at ~13px.
function Ball() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-3 w-3 shrink-0 sm:h-[15px] sm:w-[15px]"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="46" fill="#fff" stroke="#0a0e12" strokeWidth="6" />
      <polygon points="50,32 67.1,44.4 60.6,64.6 39.4,64.6 32.9,44.4" fill="#0a0e12" />
      <g stroke="#0a0e12" strokeWidth="5" strokeLinecap="round">
        <line x1="50" y1="32" x2="50" y2="11" />
        <line x1="67.1" y1="44.4" x2="86" y2="38" />
        <line x1="60.6" y1="64.6" x2="72" y2="81" />
        <line x1="39.4" y1="64.6" x2="28" y2="81" />
        <line x1="32.9" y1="44.4" x2="14" y2="38" />
      </g>
    </svg>
  );
}
function CardChip({ red }: { red?: boolean }) {
  return (
    <span
      className={
        "inline-block h-3 w-[8px] shrink-0 rounded-[1px] sm:h-[15px] sm:w-[10px] " +
        (red ? "bg-red-500" : "bg-amber-400")
      }
      aria-hidden="true"
    />
  );
}
function SubArrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 shrink-0 sm:h-[15px] sm:w-[15px]"
      aria-hidden="true"
    >
      <path d="M12 21l-6-7h4V3h4v11h4z" fill="#f87171" />
    </svg>
  );
}

function EventCaption({ ev }: { ev: PlayerEvents }) {
  const tokens: React.ReactNode[] = [];
  ev.goals.forEach((g, idx) => {
    tokens.push(
      <span key={`g${idx}`} className="flex items-center gap-px">
        <Ball />
        <span>
          {g.minute}
          {g.og ? " og" : g.pen ? " p" : ""}
        </span>
      </span>
    );
  });
  if (ev.yellow) {
    tokens.push(
      <span key="y" className="flex items-center gap-px">
        <CardChip />
        <span>{ev.yellow}</span>
      </span>
    );
  }
  if (ev.red) {
    tokens.push(
      <span key="r" className="flex items-center gap-px">
        <CardChip red />
        <span>{ev.red}</span>
      </span>
    );
  }
  if (ev.subOff) {
    tokens.push(
      <span key="s" className="flex items-center gap-px">
        <SubArrow />
        <span>{ev.subOff}</span>
      </span>
    );
  }
  if (tokens.length === 0) return null;
  return (
    <span className="mt-px flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-0 text-[9px] font-semibold leading-tight text-white sm:text-[11px]">
      {tokens}
    </span>
  );
}

function Marker({
  p,
  topPct,
  leftPct,
  tone,
  ev,
}: {
  p: LineupPlayer;
  topPct: number;
  leftPct: number;
  tone: "home" | "away";
  ev?: PlayerEvents;
}) {
  const subbed = Boolean(ev?.subOff);
  return (
    <div
      className="absolute flex w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center sm:w-[76px]"
      style={{ top: `${topPct}%`, left: `${leftPct}%` }}
    >
      <span
        className={
          "flex h-8 w-8 items-center justify-center rounded-full border text-[13px] font-bold tabular-nums text-white shadow sm:h-10 sm:w-10 sm:text-base " +
          (tone === "home"
            ? "border-accent bg-accent/25"
            : "border-sky-400 bg-sky-400/25") +
          (subbed ? " opacity-60" : "")
        }
      >
        {p.jersey}
      </span>
      <span
        className={
          "mt-0.5 max-w-full truncate text-[10px] leading-tight sm:text-xs " +
          (subbed ? "text-zinc-400" : "text-zinc-200")
        }
      >
        {lastName(p.name)}
      </span>
      {ev && <EventCaption ev={ev} />}
    </div>
  );
}

export function LineupPitch({
  home,
  away,
  events,
  hideGoals = false,
}: {
  home: TeamLineup;
  away: TeamLineup;
  events: MatchEvent[];
  hideGoals?: boolean;
}) {
  const homeXI = home.starters;
  const awayXI = away.starters;
  if (homeXI.length < 11 || awayXI.length < 11) return null;

  const homePlot = layout(homeXI);
  const awayPlot = layout(awayXI);
  const evMap = buildEventMap(events);
  // No-spoilers: drop goal markers (keep cards/subs, which aren't results).
  if (hideGoals) evMap.forEach((e) => (e.goals = []));

  // Keep each team's deepest line back from the halfway line so the two
  // attacking rows never collide and there's room for captions in between.
  const homeTop = (y: number) => 4 + y * 36; // 4%..40%
  const awayTop = (y: number) => 96 - y * 36; // 96%..60%

  return (
    <div className="mx-auto w-full max-w-[460px] overflow-hidden rounded-2xl border border-edge">
      <div
        className="relative w-full"
        style={{
          aspectRatio: "5 / 9",
          background:
            "linear-gradient(180deg,#123524 0%,#0e2a1e 50%,#123524 100%)",
        }}
      >
        <svg
          viewBox="0 0 100 150"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <g fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5">
            <rect x="3" y="3" width="94" height="144" />
            <line x1="3" y1="75" x2="97" y2="75" />
            <circle cx="50" cy="75" r="11" />
            <circle cx="50" cy="75" r="0.8" fill="rgba(255,255,255,0.3)" stroke="none" />
            <rect x="22" y="3" width="56" height="20" />
            <rect x="38" y="3" width="24" height="8" />
            <rect x="22" y="127" width="56" height="20" />
            <rect x="38" y="139" width="24" height="8" />
          </g>
        </svg>

        <div className="absolute left-2 top-1.5 text-[10px] font-semibold text-accent">
          {home.teamName} {home.formation && `· ${home.formation}`}
        </div>
        <div className="absolute bottom-1.5 right-2 text-[10px] font-semibold text-sky-400">
          {away.teamName} {away.formation && `· ${away.formation}`}
        </div>

        {homePlot.map((pl) => (
          <Marker
            key={`h-${pl.player.jersey}-${pl.player.name}`}
            p={pl.player}
            topPct={homeTop(pl.y)}
            leftPct={pl.x * 100}
            tone="home"
            ev={evMap.get(pl.player.name)}
          />
        ))}
        {awayPlot.map((pl) => (
          <Marker
            key={`a-${pl.player.jersey}-${pl.player.name}`}
            p={pl.player}
            topPct={awayTop(pl.y)}
            leftPct={pl.x * 100}
            tone="away"
            ev={evMap.get(pl.player.name)}
          />
        ))}
      </div>
    </div>
  );
}
