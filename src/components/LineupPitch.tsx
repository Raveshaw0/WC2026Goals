import type { LineupPlayer, MatchEvent, TeamLineup } from "@/lib/types";

// Plot starting XIs onto a pitch. ESPN's API gives only coarse position codes
// (G/D/M/F) plus a `formationPlace` slot index (1-11) and the formation
// string, so we reconstruct the shape the way ESPN.com does: from the
// formation. parseFormation gives the line sizes; for formations whose
// midfielders sit in a single band the coarse codes place everyone, and for
// "stacked midfield" shapes (e.g. 4-2-3-1) a per-formation template maps each
// slot to its band so the holding pair and the attacking line don't merge into
// one row. band()/sideRank() remain only as a fallback for untemplated odd
// formations. Home occupies the top half attacking down, away the bottom half
// attacking up, meeting at the halfway line. Each marker carries a compact
// caption of that player's events (goals, cards, subbed-off) with minutes.

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

// Maps a formation string to its bands. Each band lists the formationPlace
// slots LEFT-TO-RIGHT in a canonical "attacking up" view (goalkeeper at the
// bottom, like a normal formation diagram). band 0 is the goalkeeper, band 1
// the defensive line, increasing toward attack. Both the band assignment AND
// the within-band order are decoded from ESPN's own render, since ESPN's
// formationPlace is a slot index whose left-to-right order is not its numeric
// order (e.g. a back four can be slots 3,6,5,2 from left to right). The
// renderer mirrors the home side horizontally because it attacks downward.
// Only "stacked midfield" formations need an entry; single-midfield ones
// (4-4-2, 4-3-3, 3-5-2, ...) are placed from the coarse G/D/M/F labels.
const FORMATION_TEMPLATES: Record<string, number[][]> = {
  // GK | DEF: 4,5,6 | midfield four: 3,8,7,2 | behind the striker: 11,10 | ST: 9
  "3-4-2-1": [[1], [4, 5, 6], [3, 8, 7, 2], [11, 10], [9]],
  // GK | DEF: 3,6,5,2 | holding pair: 4,8 | attacking three: 11,10,7 | ST: 9
  "4-2-3-1": [[1], [3, 6, 5, 2], [4, 8], [11, 10, 7], [9]],
};

// Parse "4-2-3-1" -> [4,2,3,1] (outfield lines). null unless it cleanly adds up
// to the 10 outfield players, so a junk string falls back to the heuristic.
function parseFormation(formation: string | null): number[] | null {
  if (!formation) return null;
  const parts = formation.split("-").map((n) => Number(n.trim()));
  if (parts.length < 2 || parts.some((n) => !Number.isInteger(n) || n <= 0)) {
    return null;
  }
  if (parts.reduce((a, b) => a + b, 0) !== 10) return null;
  return parts;
}

const place = (j: number, count: number, mirror: boolean) => {
  const x = (j + 1) / (count + 1);
  return mirror ? 1 - x : x;
};

// Spread each band's players evenly across the width (ordered by formationPlace)
// and stack the bands by depth (0 = own goal, 1 = attack). Used by the coarse
// and heuristic paths, where the precise left-to-right order isn't known.
function placeBands(bands: LineupPlayer[][], mirror: boolean): Plotted[] {
  const rows = bands.length;
  const out: Plotted[] = [];
  bands.forEach((line, depth) => {
    const ordered = line
      .slice()
      .sort((a, b) => Number(a.formationPlace) - Number(b.formationPlace));
    ordered.forEach((player, j) => {
      out.push({
        player,
        x: place(j, ordered.length, mirror),
        y: rows <= 1 ? 0 : depth / (rows - 1),
      });
    });
  });
  return out;
}

// Template path: place every player by its formationPlace, using the template's
// band assignment and left-to-right order. Null if any templated slot has no
// matching starter (then we fall back cleanly).
function layoutByTemplate(
  starters: LineupPlayer[],
  lines: number[],
  bandRows: number[][],
  mirror: boolean
): Plotted[] | null {
  if (bandRows.length !== lines.length + 1) return null;
  const byFp = new Map(starters.map((p) => [Number(p.formationPlace), p]));
  const numBands = bandRows.length;
  const out: Plotted[] = [];
  bandRows.forEach((row, b) => {
    row.forEach((fp, j) => {
      const player = byFp.get(fp);
      if (!player) return; // missing slot; caught by the count check below
      out.push({
        player,
        x: place(j, row.length, mirror),
        y: numBands <= 1 ? 0 : b / (numBands - 1),
      });
    });
  });
  return out.length === starters.length ? out : null;
}

// Coarse path: works when the formation has a single midfield band, so G/D/M/F
// maps straight onto lines. Null if the labels don't reconcile with the
// formation (then we fall back).
function layoutByCoarse(
  starters: LineupPlayer[],
  lines: number[],
  mirror: boolean
): Plotted[] | null {
  if (lines.length !== 3) return null; // only single-midfield shapes here
  const by = (pos: string) => starters.filter((p) => p.position === pos);
  const gks = by("G");
  const def = by("D");
  const mid = by("M");
  const fwd = by("F");
  if (
    gks.length !== 1 ||
    def.length !== lines[0] ||
    mid.length !== lines[1] ||
    fwd.length !== lines[2]
  ) {
    return null;
  }
  return placeBands([gks, def, mid, fwd], mirror);
}

// Fallback heuristic (pre-template behaviour): infer a band from the position
// abbreviation. Collapses multi-band midfields, but never renders worse than
// before for formations we don't yet template.
function layoutHeuristic(
  starters: LineupPlayer[],
  mirror: boolean
): Plotted[] {
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
        x: place(j, line.length, mirror),
        y: rows <= 1 ? 0 : depth / (rows - 1),
      });
    });
  });
  return out;
}

// `mirror` flips the side horizontally; the home team attacks downward, which
// is the canonical "attacking up" template rotated 180 degrees.
function layout(
  starters: LineupPlayer[],
  formation: string | null,
  mirror: boolean
): Plotted[] {
  const lines = parseFormation(formation);
  if (lines && formation) {
    const template = FORMATION_TEMPLATES[formation];
    if (template) {
      const byTemplate = layoutByTemplate(starters, lines, template, mirror);
      if (byTemplate) return byTemplate;
    }
    const byCoarse = layoutByCoarse(starters, lines, mirror);
    if (byCoarse) return byCoarse;
  }
  return layoutHeuristic(starters, mirror);
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

  // Home attacks downward (top half), away upward (bottom half), so the home
  // side is the canonical template mirrored horizontally.
  const homePlot = layout(homeXI, home.formation, true);
  const awayPlot = layout(awayXI, away.formation, false);
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
