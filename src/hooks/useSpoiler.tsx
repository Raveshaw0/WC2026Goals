"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

// No-spoilers mode. Hides our own UI results (scores, scorers, events, group
// tables, leaderboards) behind per-match / per-section reveals. Highlights
// clips are deliberately left untouched. Default off, persisted locally.
//
// The preference is read in a layout effect (before paint) so a spoiler-free
// visitor never sees a score flash on load: server + first client render show
// scores (matching, no hydration mismatch), then the effect flips state to
// hidden before the browser paints.
const KEY = "wc26.spoiler.v1";

const useIsoLayout =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface SpoilerApi {
  noSpoilers: boolean;
  toggle: () => void;
  matchHidden: (matchId: string) => boolean;
  revealMatch: (matchId: string) => void;
  sectionHidden: (key: string) => boolean;
  revealSection: (key: string) => void;
}

const Ctx = createContext<SpoilerApi | null>(null);

export function SpoilerProvider({ children }: { children: React.ReactNode }) {
  const [noSpoilers, setNoSpoilers] = useState(false);
  const [matches, setMatches] = useState<Set<string>>(new Set());
  const [sections, setSections] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useIsoLayout(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        setNoSpoilers(Boolean(p.noSpoilers));
        setMatches(new Set(Array.isArray(p.matches) ? p.matches : []));
        setSections(new Set(Array.isArray(p.sections) ? p.sections : []));
      }
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          noSpoilers,
          matches: Array.from(matches),
          sections: Array.from(sections),
        })
      );
    } catch {
      // ignore
    }
  }, [noSpoilers, matches, sections, ready]);

  const toggle = useCallback(() => setNoSpoilers((v) => !v), []);
  const revealMatch = useCallback(
    (id: string) => setMatches((s) => new Set(s).add(id)),
    []
  );
  const revealSection = useCallback(
    (k: string) => setSections((s) => new Set(s).add(k)),
    []
  );

  const api: SpoilerApi = {
    noSpoilers,
    toggle,
    matchHidden: (id) => noSpoilers && !matches.has(id),
    revealMatch,
    sectionHidden: (k) => noSpoilers && !sections.has(k),
    revealSection,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSpoiler(): SpoilerApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSpoiler outside SpoilerProvider");
  return ctx;
}
