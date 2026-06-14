"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { Clip, MatchClips } from "@/lib/clips";

// In-game highlight clips (SBS Blaze stories): a horizontal rail of vertical
// thumbnails that open a fullscreen story-style player. Clips are plain MP4s
// played in our own <video> (auto-advance to the next, tap to dismiss).

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
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, clips.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, clips.length]);

  const clip = clips[i];
  const next = () =>
    setI((n) => (n + 1 < clips.length ? n + 1 : (onClose(), n)));

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Match highlights"
    >
      {/* progress segments */}
      <div className="absolute left-0 right-0 top-0 z-10 flex gap-1 p-2">
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
        className="absolute right-3 top-4 z-10 rounded-full bg-white/15 px-3 py-1 text-sm text-white"
      >
        Close
      </button>

      <video
        ref={videoRef}
        key={clip.id}
        src={clip.mp4}
        poster={clip.poster ?? undefined}
        autoPlay
        playsInline
        controls
        onEnded={next}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-auto max-w-full rounded-xl bg-black"
      />

      {/* tap zones for prev/next */}
      {i > 0 && (
        <button
          type="button"
          aria-label="Previous"
          onClick={(e) => {
            e.stopPropagation();
            setI((n) => Math.max(n - 1, 0));
          }}
          className="absolute bottom-4 left-4 z-10 rounded-full bg-white/15 px-3 py-1.5 text-sm text-white"
        >
          Prev
        </button>
      )}
      {i < clips.length - 1 && (
        <button
          type="button"
          aria-label="Next"
          onClick={(e) => {
            e.stopPropagation();
            setI((n) => Math.min(n + 1, clips.length - 1));
          }}
          className="absolute bottom-4 right-4 z-10 rounded-full bg-white/15 px-3 py-1.5 text-sm text-white"
        >
          Next
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
