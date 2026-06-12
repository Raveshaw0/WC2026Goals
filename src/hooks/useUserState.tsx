"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// Watched and favourites state, cached in localStorage for instant render and
// offline tolerance, mirrored to Supabase via /api/state. The storage key is
// constant across deploys on purpose: state must survive redeploys.
const KEY = "wc26.state.v1";

interface StoredState {
  code: string | null;
  watched: string[];
  favourites: string[];
  favouriteTeams: string[];
  // Explicit untoggles queued for the next sync. Server-side merging is
  // union-based, so deletions must travel as explicit removal lists or they
  // would resurrect on the next reconciliation.
  removedWatched: string[];
  removedFavourites: string[];
  removedFavouriteTeams: string[];
}

const EMPTY: StoredState = {
  code: null,
  watched: [],
  favourites: [],
  favouriteTeams: [],
  removedWatched: [],
  removedFavourites: [],
  removedFavouriteTeams: [],
};

function arr(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
}

function readLocal(): StoredState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw);
    return {
      code: typeof p.code === "string" ? p.code : null,
      watched: arr(p.watched),
      favourites: arr(p.favourites),
      favouriteTeams: arr(p.favouriteTeams),
      removedWatched: arr(p.removedWatched),
      removedFavourites: arr(p.removedFavourites),
      removedFavouriteTeams: arr(p.removedFavouriteTeams),
    };
  } catch {
    return EMPTY;
  }
}

function writeLocal(state: StoredState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked; in-memory state still works for this session
  }
}

function union(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}

interface UserStateApi {
  code: string | null;
  watched: Set<string>;
  favourites: Set<string>;
  favouriteTeams: Set<string>;
  syncing: boolean;
  syncError: string | null;
  toggleWatched: (id: string) => void;
  toggleFavourite: (id: string) => void;
  toggleFavouriteTeam: (id: string) => void;
  markWatched: (id: string) => void;
  adoptCode: (code: string) => Promise<string | null>; // returns error message or null
}

const Ctx = createContext<UserStateApi | null>(null);

export function UserStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoredState>(EMPTY);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  const update = useCallback((next: StoredState) => {
    setState(next);
    writeLocal(next);
  }, []);

  // Push local state to the server, applying queued removals, then MERGE the
  // server's response with whatever the local state is by the time it
  // arrives. Never blindly replace local state with a response: a toggle made
  // while a sync was in flight would visually revert for a moment (the
  // flicker), then reappear on the next sync.
  const pushSync = useCallback(async () => {
    const s = stateRef.current;
    if (!s.code) return;
    if (inFlight.current) {
      // A sync is already running; run again once it finishes.
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => void pushSync(), 900);
      return;
    }
    inFlight.current = true;
    const sent = {
      removedWatched: s.removedWatched,
      removedFavourites: s.removedFavourites,
      removedFavouriteTeams: s.removedFavouriteTeams,
    };
    setSyncing(true);
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          code: s.code,
          watched: s.watched,
          favourites: s.favourites,
          favouriteTeams: s.favouriteTeams,
          removedWatched: sent.removedWatched,
          removedFavourites: sent.removedFavourites,
          removedFavouriteTeams: sent.removedFavouriteTeams,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const cur = stateRef.current;
        // Removals queued during the flight are still pending; the ones we
        // sent are applied server-side and can be cleared.
        const pendingRemovedW = cur.removedWatched.filter(
          (x) => !sent.removedWatched.includes(x)
        );
        const pendingRemovedF = cur.removedFavourites.filter(
          (x) => !sent.removedFavourites.includes(x)
        );
        const pendingRemovedT = cur.removedFavouriteTeams.filter(
          (x) => !sent.removedFavouriteTeams.includes(x)
        );
        update({
          code: cur.code,
          watched: union(arr(data.watched), cur.watched).filter(
            (id) => !cur.removedWatched.includes(id)
          ),
          favourites: union(arr(data.favourites), cur.favourites).filter(
            (id) => !cur.removedFavourites.includes(id)
          ),
          favouriteTeams: union(
            arr(data.favouriteTeams),
            cur.favouriteTeams
          ).filter((id) => !cur.removedFavouriteTeams.includes(id)),
          removedWatched: pendingRemovedW,
          removedFavourites: pendingRemovedF,
          removedFavouriteTeams: pendingRemovedT,
        });
        setSyncError(null);
      } else if (res.status === 503) {
        setSyncError("Sync not configured");
      }
    } catch {
      setSyncError("Offline, will retry");
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [update]);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => void pushSync(), 800);
  }, [pushSync]);

  // Boot: hydrate from localStorage, then reconcile with the server. If there
  // is no code yet, ask the server to mint one.
  useEffect(() => {
    const local = readLocal();
    setState(local);
    let cancelled = false;

    (async () => {
      if (local.code) {
        try {
          const res = await fetch(
            `/api/state?code=${encodeURIComponent(local.code)}`
          );
          if (cancelled) return;
          if (res.ok) {
            const data = await res.json();
            const merged: StoredState = {
              code: local.code,
              watched: union(local.watched, arr(data.watched)).filter(
                (id) => !local.removedWatched.includes(id)
              ),
              favourites: union(local.favourites, arr(data.favourites)).filter(
                (id) => !local.removedFavourites.includes(id)
              ),
              favouriteTeams: union(
                local.favouriteTeams,
                arr(data.favouriteTeams)
              ).filter((id) => !local.removedFavouriteTeams.includes(id)),
              removedWatched: local.removedWatched,
              removedFavourites: local.removedFavourites,
              removedFavouriteTeams: local.removedFavouriteTeams,
            };
            update(merged);
            scheduleSync();
            return;
          }
          if (res.status !== 404) return; // transient error, keep local
          // 404: code vanished server-side, fall through to mint a new one
        } catch {
          return; // offline, local cache carries the session
        }
      }
      try {
        const res = await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "new" }),
        });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        const next: StoredState = { ...readLocal(), code: data.code };
        update(next);
        if (
          next.watched.length ||
          next.favourites.length ||
          next.favouriteTeams.length
        ) {
          scheduleSync();
        }
      } catch {
        // sync unavailable; app still works device-locally
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generic toggle across the three id lists.
  const makeToggle = useCallback(
    (listKey: "watched" | "favourites" | "favouriteTeams") => {
      const removedKey = (
        {
          watched: "removedWatched",
          favourites: "removedFavourites",
          favouriteTeams: "removedFavouriteTeams",
        } as const
      )[listKey];
      return (id: string) => {
        const s = stateRef.current;
        const has = s[listKey].includes(id);
        update({
          ...s,
          [listKey]: has
            ? s[listKey].filter((x) => x !== id)
            : [...s[listKey], id],
          [removedKey]: has
            ? [...s[removedKey].filter((x) => x !== id), id]
            : s[removedKey].filter((x) => x !== id),
        });
        scheduleSync();
      };
    },
    [update, scheduleSync]
  );

  const toggleWatched = makeToggle("watched");
  const toggleFavourite = makeToggle("favourites");
  const toggleFavouriteTeam = makeToggle("favouriteTeams");

  const markWatched = useCallback(
    (id: string) => {
      const s = stateRef.current;
      if (s.watched.includes(id)) return;
      update({
        ...s,
        watched: [...s.watched, id],
        removedWatched: s.removedWatched.filter((x) => x !== id),
      });
      scheduleSync();
    },
    [update, scheduleSync]
  );

  const adoptCode = useCallback(
    async (rawCode: string): Promise<string | null> => {
      const code = rawCode.trim().toUpperCase();
      if (!/^[A-Z]{2,12}-\d{2}$/.test(code)) {
        return "Codes look like TIGER-42";
      }
      const s = stateRef.current;
      try {
        const res = await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "adopt",
            code,
            watched: s.watched,
            favourites: s.favourites,
            favouriteTeams: s.favouriteTeams,
          }),
        });
        if (res.status === 404) return "Code not found";
        if (!res.ok) return "Could not reach sync server";
        const data = await res.json();
        update({
          code,
          watched: arr(data.watched),
          favourites: arr(data.favourites),
          favouriteTeams: arr(data.favouriteTeams),
          removedWatched: [],
          removedFavourites: [],
          removedFavouriteTeams: [],
        });
        return null;
      } catch {
        return "Could not reach sync server";
      }
    },
    [update]
  );

  const api: UserStateApi = {
    code: state.code,
    watched: new Set(state.watched),
    favourites: new Set(state.favourites),
    favouriteTeams: new Set(state.favouriteTeams),
    syncing,
    syncError,
    toggleWatched,
    toggleFavourite,
    toggleFavouriteTeam,
    markWatched,
    adoptCode,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useUserState(): UserStateApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUserState outside UserStateProvider");
  return ctx;
}
