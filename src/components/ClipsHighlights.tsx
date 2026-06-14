"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useBackToClose } from "@/hooks/useBackToClose";
import type { Clip, MatchClips } from "@/lib/clips";

// In-game highlight clips (SBS Blaze stories): a horizontal rail of vertical
// thumbnails that open a fullscreen story-style player. Clips are plain MP4s
// played in our own <video> (auto-advance to the next, tap to dismiss).

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

function ClipPlayer({
  clips,
  startIndex,
  onClose,
}: {
  clips: Clip[];
  startIndex: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(startIndex);
  const touch = useRef<{ x: number; y: number } | null>(null);
  useBackToClose(onClose);

  const go = (delta: number) =>
    setI((n) => Math.min(Math.max(n + delta, 0), clips.length - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, clips.length]);

  const clip = clips[i];
  // Auto-advance to the next clip when one finishes; close after the last.
  const onEnded = () => setI((n) => (n + 1 < clips.length ? n + 1 : (onClose(), n)));

  // Swipe: left/right to navigate, down to dismiss. Ignore gestures starting
  // in the bottom strip so they don't fight the native video scrubber.
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current =
      t.clientY > window.innerHeight - 80 ? null : { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    else if (dy > 70 && dy > Math.abs(dx)) onClose();
  };

  const edgeBtn =
    "absolute top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 backdrop-blur transition-colors hover:bg-white/25";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label="Match highlights"
    >
      {/* progress segments */}
      <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 p-2">
        {clips.map((_, idx) => (
          <span
            key={idx}
            className={
              "h-1 flex-1 rounded-full " +
              (idx <= i ? "bg-white" : "bg-white/30")
            }
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-4 z-20 rounded-full bg-white/15 px-3 py-1 text-sm text-white"
      >
        Close
      </button>

      <video
        key={clip.id}
        src={clip.mp4}
        poster={clip.poster ?? undefined}
        autoPlay
        playsInline
        controls
        onEnded={onEnded}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-auto max-w-full rounded-xl bg-black"
      />

      {i > 0 && (
        <button
          type="button"
          aria-label="Previous clip"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          className={edgeBtn + " left-2 sm:left-4"}
        >
          <Chevron dir="left" />
        </button>
      )}
      {i < clips.length - 1 && (
        <button
          type="button"
          aria-label="Next clip"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          className={edgeBtn + " right-2 sm:right-4"}
        >
          <Chevron dir="right" />
        </button>
      )}
    </div>,
    document.body
  );
}

export function ClipsHighlights({ data }: { data: MatchClips }) {
  const [open, setOpen] = useState<number | null>(null);
  if (data.clips.length === 0) return null;

  return (
    <section className="rounded-2xl border border-edge bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-300">
          Highlights
        </h2>
        {data.isLive && (
          <span className="flex items-center gap-1 rounded-full bg-live/15 px-2 py-0.5 text-[10px] font-bold text-live">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live" />
            LIVE
          </span>
        )}
        <span className="ml-auto text-xs text-zinc-500">
          {data.clips.length} clip{data.clips.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {data.clips.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setOpen(idx)}
            className="relative aspect-[9/16] w-[88px] shrink-0 overflow-hidden rounded-lg border border-edge bg-black"
          >
            {c.poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.poster}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            )}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </button>
        ))}
      </div>
      {open !== null && (
        <ClipPlayer
          clips={data.clips}
          startIndex={open}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
