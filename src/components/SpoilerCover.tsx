"use client";

import { useState } from "react";

import { useSpoiler } from "@/hooks/useSpoiler";

// Wraps any score/result content. When no-spoilers is on and this match /
// section hasn't been revealed, the content sits under an opaque cover with a
// "Reveal" affordance; tapping dissolves the cover (fade) and reveals it.
// Works inside links (preventDefault stops navigation).
export function SpoilerCover({
  matchId,
  sectionKey,
  label = "Reveal",
  rounded = "rounded-lg",
  children,
}: {
  matchId?: string;
  sectionKey?: string;
  label?: string;
  rounded?: string;
  children: React.ReactNode;
}) {
  const sp = useSpoiler();
  const [fading, setFading] = useState(false);

  const hidden = matchId
    ? sp.matchHidden(matchId)
    : sectionKey
      ? sp.sectionHidden(sectionKey)
      : false;

  if (!hidden) return <>{children}</>;

  const doReveal = () => {
    setFading(true);
    setTimeout(() => {
      if (matchId) sp.revealMatch(matchId);
      else if (sectionKey) sp.revealSection(sectionKey);
    }, 260);
  };

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none">
        {children}
      </div>
      <span
        role="button"
        tabIndex={0}
        aria-label={`${label} (hidden, no-spoilers mode)`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          doReveal();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            doReveal();
          }
        }}
        className={
          "absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-cardSoft text-xs font-semibold text-zinc-300 transition-opacity duration-300 " +
          rounded +
          (fading ? " pointer-events-none opacity-0" : " opacity-100")
        }
      >
        <span className="flex items-center gap-1 px-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {label && <span>{label}</span>}
        </span>
      </span>
    </div>
  );
}
