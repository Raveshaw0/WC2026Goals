import type { LineupPlayer, TeamLineup } from "@/lib/types";

// Plot starting XIs onto a pitch from ESPN position abbreviations (G, RB,
// CD-L, AM-R, F, ...). The abbreviations encode both the line and the
// left/right placement, which reconstructs the formation shape reliably
// (formationPlace is only a tiebreak). Home occupies the top half attacking
// down, away the bottom half attacking up, meeting at the halfway line.

// Vertical band: 0 GK, 1 defence, 2 defensive mid, 3 midfield, 4 attacking
// mid, 5 forward. Order of checks matters.
function band(posRaw: string): number {
  const p = posRaw.toUpperCase();
  if (p === "G" || p.startsWith("GK")) return 0;
  if (p.startsWith("AM") || p.includes("CAM")) return 4;
  if (p.includes("WB")) return 1; // wing-back sits on the defensive line
  if (p.startsWith("DM") || p.includes("CDM")) return 2;
  if (
    p.startsWith("F") ||
    p.includes("CF") ||
    p.includes("ST") ||
    p.endsWith("W") || // LW, RW, W
    p.startsWith("W")
  ) {
    return 5;
  }
  if (p.startsWith("D") || p.endsWith("B") || p.includes("CB") || p.includes("CD")) {
    return 1;
  }
  return 3; // CM, LM, RM, M, ...
}

// Left (-2) to right (+2) ordering hint within a line.
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
  x: number; // 0..1 left..right
  y: number; // 0..1 top..bottom (this team's own area)
}

// Returns players with x in 0..1 and y as depth 0 (GK) .. 1 (most advanced).
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

function Marker({
  p,
  topPct,
  leftPct,
  tone,
}: {
  p: LineupPlayer;
  topPct: number;
  leftPct: number;
  tone: "home" | "away";
}) {
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ top: `${topPct}%`, left: `${leftPct}%` }}
    >
      <span
        className={
          "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold tabular-nums text-white shadow " +
          (tone === "home"
            ? "border-accent bg-accent/25"
            : "border-sky-400 bg-sky-400/25")
        }
      >
        {p.jersey}
      </span>
      <span className="mt-0.5 max-w-[60px] truncate text-[9px] leading-tight text-zinc-200">
        {lastName(p.name)}
      </span>
    </div>
  );
}

export function LineupPitch({
  home,
  away,
}: {
  home: TeamLineup;
  away: TeamLineup;
}) {
  const homeXI = home.starters;
  const awayXI = away.starters;
  if (homeXI.length < 11 || awayXI.length < 11) return null;

  const homePlot = layout(homeXI);
  const awayPlot = layout(awayXI);

  // Home: GK at top (4%) to forwards near halfway (46%).
  // Away: GK at bottom (96%) to forwards near halfway (54%).
  const homeTop = (y: number) => 4 + y * 42;
  const awayTop = (y: number) => 96 - y * 42;

  return (
    <div className="overflow-hidden rounded-2xl border border-edge">
      <div
        className="relative w-full"
        style={{
          aspectRatio: "2 / 3",
          background:
            "linear-gradient(180deg,#123524 0%,#0e2a1e 50%,#123524 100%)",
        }}
      >
        {/* pitch markings */}
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
            {/* top box (home goal) */}
            <rect x="22" y="3" width="56" height="20" />
            <rect x="38" y="3" width="24" height="8" />
            {/* bottom box (away goal) */}
            <rect x="22" y="127" width="56" height="20" />
            <rect x="38" y="139" width="24" height="8" />
          </g>
        </svg>

        {/* team labels */}
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
          />
        ))}
        {awayPlot.map((pl) => (
          <Marker
            key={`a-${pl.player.jersey}-${pl.player.name}`}
            p={pl.player}
            topPct={awayTop(pl.y)}
            leftPct={pl.x * 100}
            tone="away"
          />
        ))}
      </div>
    </div>
  );
}
