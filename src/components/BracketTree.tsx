"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";

import { SpoilerCover } from "@/components/SpoilerCover";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import { useSpoiler } from "@/hooks/useSpoiler";
import type { BracketData, BracketSlot } from "@/lib/bracket";
import { buildBracket } from "@/lib/bracket";
import type { Match, TeamSide } from "@/lib/types";

// Layout constants. Connectors reach half a gap (16px) into the 32px flex gap
// between columns, so a feeder's forward line and its child's back line meet in
// the middle. The bracket height is fixed to the R32 column (8 cells): every
// column is flex and each cell is flex-1, so a match centres exactly on the
// midpoint of its two feeders with no per-cell maths.
const SLOT_H = 74;
const HEIGHT = SLOT_H * 8;

type Side = "left" | "right" | "center";

function abbrev(t: TeamSide): string {
  return t.abbrev || t.shortName || t.name;
}

function Flag({ team }: { team: TeamSide }) {
  if (!team.flag) {
    return (
      <span
        className="inline-block h-3 w-[18px] shrink-0 rounded-[2px] bg-cardSoft"
        aria-hidden="true"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={team.flag}
      alt=""
      width={18}
      height={13}
      loading="lazy"
      className="inline-block h-auto w-[18px] shrink-0 rounded-[2px]"
    />
  );
}

// A single team line. `shown` decides real team vs feeder placeholder;
// `resultHidden` keeps the winner styling and score under wraps until this
// match is revealed (no-spoilers).
function TeamLine({
  slot,
  team,
  shown,
  placeholder,
  resultHidden,
}: {
  slot: BracketSlot;
  team: TeamSide;
  shown: boolean;
  placeholder: string;
  resultHidden: boolean;
}) {
  const m = slot.match;
  const started =
    m && m.status !== "scheduled" && m.status !== "postponed";
  const isWinner = shown && !resultHidden && team.winner;
  const nameCls = !shown
    ? "italic text-zinc-500"
    : resultHidden
      ? "font-medium text-zinc-300"
      : isWinner
        ? "font-bold text-zinc-100"
        : "text-zinc-500";
  return (
    <div className="flex items-center gap-1.5">
      {shown ? (
        <Flag team={team} />
      ) : (
        <span className="h-3 w-[18px] shrink-0 rounded-[2px] border border-dashed border-edge" />
      )}
      <span className={"min-w-0 flex-1 truncate text-[11px] leading-tight " + nameCls}>
        {shown ? abbrev(team) : placeholder}
      </span>
      {shown && started && m && (
        <SpoilerCover matchId={m.id} label="" rounded="rounded">
          <span
            className={
              "text-xs font-bold tabular-nums " +
              (isWinner ? "text-zinc-100" : "text-zinc-400")
            }
          >
            {team.score ?? "-"}
            {team.shootoutScore !== null && (
              <sup className="ml-0.5 text-[8px] font-medium text-zinc-500">
                {team.shootoutScore}
              </sup>
            )}
          </span>
        </SpoilerCover>
      )}
    </div>
  );
}

function SlotCard({ slot, slots }: { slot: BracketSlot; slots: BracketData["slots"] }) {
  const sp = useSpoiler();
  const m = slot.match;
  const isFinal = slot.id === "F";
  const isTP = slot.id === "TP";

  // A side's real team is safe to show once the feeding match is revealed. R32
  // entry slots have no feeder, so they always show their matchup (only scores
  // hide). This is what makes advancement respect no-spoilers: a downstream
  // slot stays a placeholder until you reveal the result that fills it.
  const feederRevealed = (feederId: string | null): boolean => {
    if (!feederId) return true;
    const fm = slots[feederId]?.match ?? null;
    if (!fm) return false;
    return !sp.matchHidden(fm.id);
  };
  const placeholderFor = (feederId: string | null): string => {
    const f = feederId ? slots[feederId] : null;
    if (!f) return "TBD";
    return `${f.label} ${isTP ? "loser" : "winner"}`;
  };

  const homeShown = !!m && !!m.home.flag && feederRevealed(slot.feederA);
  const awayShown = !!m && !!m.away.flag && feederRevealed(slot.feederB);
  const resultHidden = m ? sp.matchHidden(m.id) : false;
  const isLive =
    m?.status === "live" || m?.status === "halftime" || m?.status === "break";

  // Champion flourish under the final once it's decided and revealed.
  const champ =
    isFinal && m && m.status === "finished" && !resultHidden
      ? m.home.winner
        ? m.home
        : m.away.winner
          ? m.away
          : null
      : null;

  const body = (
    <div
      className={
        "relative w-full rounded-lg border bg-card px-2 py-1.5 " +
        (isFinal
          ? "border-accent/50 shadow-[0_0_0_1px_rgba(74,222,128,0.12)]"
          : "border-edge")
      }
    >
      {isLive && (
        <span className="live-dot absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-live" />
      )}
      <div className="space-y-1">
        {m ? (
          <>
            <TeamLine
              slot={slot}
              team={m.home}
              shown={homeShown}
              placeholder={placeholderFor(slot.feederA)}
              resultHidden={resultHidden}
            />
            <TeamLine
              slot={slot}
              team={m.away}
              shown={awayShown}
              placeholder={placeholderFor(slot.feederB)}
              resultHidden={resultHidden}
            />
          </>
        ) : (
          <>
            <div className="truncate text-[11px] italic leading-tight text-zinc-500">
              {placeholderFor(slot.feederA)}
            </div>
            <div className="truncate text-[11px] italic leading-tight text-zinc-500">
              {placeholderFor(slot.feederB)}
            </div>
          </>
        )}
      </div>
      {champ && (
        <div className="mt-1 flex items-center justify-center gap-1 border-t border-edge pt-1 text-[9px] font-bold uppercase tracking-wide text-accent">
          <Flag team={champ} />
          <span>Champion</span>
        </div>
      )}
    </div>
  );

  // Link to the match page when there's a fixture; a bare placeholder isn't
  // tappable. SpoilerCover stops propagation on the score, so tapping a score
  // reveals rather than navigates.
  return m ? (
    <Link href={`/match/${m.id}`} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

// Connector lines drawn into the flex gap. Every cell except the final has a
// forward line toward the centre; every cell except an R32 leaf has a back line
// toward its feeders; paired feeders (any column with >1 cell) add a vertical
// joining the pair, half from the top cell and half from the bottom.
function Connectors({
  side,
  isR32,
  colLen,
  idx,
}: {
  side: Side;
  isR32: boolean;
  colLen: number;
  idx: number;
}) {
  if (side === "center") {
    return (
      <>
        <span className="absolute left-[-16px] top-1/2 h-0.5 w-4 -translate-y-1/2 bg-edge" />
        <span className="absolute right-[-16px] top-1/2 h-0.5 w-4 -translate-y-1/2 bg-edge" />
      </>
    );
  }
  const fwd = side === "left" ? "right-[-16px]" : "left-[-16px]";
  const back = side === "left" ? "left-[-16px]" : "right-[-16px]";
  const topOfPair = idx % 2 === 0;
  return (
    <>
      <span className={"absolute top-1/2 h-0.5 w-4 -translate-y-1/2 bg-edge " + fwd} />
      {!isR32 && (
        <span className={"absolute top-1/2 h-0.5 w-4 -translate-y-1/2 bg-edge " + back} />
      )}
      {colLen > 1 && (
        <span
          className={
            "absolute w-0.5 bg-edge " +
            fwd +
            (topOfPair ? " top-1/2 bottom-0" : " top-0 h-1/2")
          }
        />
      )}
    </>
  );
}

function Cell({
  slotId,
  side,
  colLen,
  idx,
  data,
}: {
  slotId: string;
  side: Side;
  colLen: number;
  idx: number;
  data: BracketData;
}) {
  const slot = data.slots[slotId];
  return (
    <div className="relative flex flex-1 items-center">
      <Connectors
        side={side}
        isR32={slot.round === "round-of-32"}
        colLen={colLen}
        idx={idx}
      />
      <div className="relative z-[1] w-full">
        <SlotCard slot={slot} slots={data.slots} />
      </div>
    </div>
  );
}

function Column({
  ids,
  side,
  data,
  width,
}: {
  ids: string[];
  side: Side;
  data: BracketData;
  width: string;
}) {
  return (
    <div className={"flex h-full shrink-0 flex-col " + width}>
      {ids.map((id, i) => (
        <Cell key={id} slotId={id} side={side} colLen={ids.length} idx={i} data={data} />
      ))}
    </div>
  );
}

const COL_W = "w-[132px]";
const CENTER_W = "w-[152px]";
const LEFT_LABELS = ["Round of 32", "Round of 16", "Quarters", "Semis"];
const RIGHT_LABELS = ["Semis", "Quarters", "Round of 16", "Round of 32"];

export function BracketTree({ initialMatches }: { initialMatches: Match[] }) {
  const { matches } = useLiveMatches(initialMatches);
  const data = useMemo(() => buildBracket(matches), [matches]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Start centred on the final so both halves are equally reachable.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  if (!data.hasFixtures) {
    return (
      <div className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-zinc-400">
        The knockout bracket appears once the group stage wraps up.
      </div>
    );
  }

  return (
    <div>
      <div ref={scrollRef} className="-mx-4 overflow-x-auto px-4 pb-3">
        <div className="w-max">
          {/* Round labels, aligned to the columns below. */}
          <div className="mb-2 flex gap-8">
            {LEFT_LABELS.map((l, i) => (
              <div
                key={"l" + i}
                className={
                  "shrink-0 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500 " +
                  COL_W
                }
              >
                {l}
              </div>
            ))}
            <div
              className={
                "shrink-0 text-center text-[10px] font-semibold uppercase tracking-wide text-accent " +
                CENTER_W
              }
            >
              Final
            </div>
            {RIGHT_LABELS.map((l, i) => (
              <div
                key={"r" + i}
                className={
                  "shrink-0 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500 " +
                  COL_W
                }
              >
                {l}
              </div>
            ))}
          </div>

          <div className="flex gap-8" style={{ height: HEIGHT }}>
            {data.leftColumns.map((ids, i) => (
              <Column key={"L" + i} ids={ids} side="left" data={data} width={COL_W} />
            ))}

            {/* Centre column: final centred; third-place pinned below. */}
            <div className={"relative h-full shrink-0 " + CENTER_W}>
              <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center">
                <Connectors side="center" isR32={false} colLen={1} idx={0} />
                <div className="relative z-[1] w-full">
                  <SlotCard slot={data.slots[data.finalId]} slots={data.slots} />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0">
                <div className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Third place
                </div>
                <SlotCard slot={data.slots[data.thirdPlaceId]} slots={data.slots} />
              </div>
            </div>

            {data.rightColumns.map((ids, i) => (
              <Column key={"R" + i} ids={ids} side="right" data={data} width={COL_W} />
            ))}
          </div>
        </div>
      </div>

      {!data.consistent && (
        <p className="mt-1 text-center text-[11px] text-amber-400">
          Bracket wiring looks off against the latest results; showing best effort.
        </p>
      )}
    </div>
  );
}
