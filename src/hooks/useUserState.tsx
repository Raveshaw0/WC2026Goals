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
  // Explicit untoggles queued for the next sync. Server-side merging is
  // union-based, so deletions must travel as explicit removal lists or they
  // would resurrect on the next reconciliation.
  removedWatched: string[];
  removedFavourites: string[];
}

const EMPTY: StoredState = {
  code: null,
  watched: [],
  favourites: [],
  removedWatched: [],
  removedFavourites: [],
};

function readLocal(): StoredState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      code: typeof parsed.code === "string" ? parsed.code : null,
      watched: Array.isArray(parsed.watched) ? parsed.watched : [],
      favourites: Array.isArray(parsed.favourites) ? parsed.favourites : [],
      removedWatched: Array.isArray(parsed.removedWatched)
        ? parsed.removedWatched
        : [],
      removedFavourites: Array.isArray(parsed.removedFavourites)
        ? parsed.removedFavourites
        : [],
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

interface UserStateApi {
  code: string | null;
  watched: Set<string>;
  favourites: Set<string>;
  syncing: boolean;
  syncError: string | null;
  toggleWatched: (id: string) => void;
  toggleFavourite: (id: string) => void;
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

  const update = useCallback((next: StoredState) => {
    setState(next);
    writeLocal(next);
  }, []);

  // Push local state to the server, applying queued removals, then adopt the
  // merged result. Tolerates failure: local state is the source of truth for
  // this device until the network comes back.
  const pushSync = useCallback(async () => {
    const s = stateRef.current;
    if (!s.code) return;
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
          removedWatched: s.removedWatched,
          removedFavourites: s.removedFavourites,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        update({
          code: s.code,
          watched: data.watched ?? s.watched,
          favourites: data.favourites ?? s.favourites,
          removedWatched: [],
          removedFavourites: [],
        });
        setSyncError(null);
      } else if (res.status === 503) {
        setSyncError("Sync not configured");
      }
    } catch {
      setSyncError("Offline, will retry");
    } finally {
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
            // Reconcile: union server into local, then push local additions
            // and queued removals back up.
            const data = await res.json();
            const merged: StoredState = {
              code: local.code,
              watched: Array.from(
                new Set([...local.watched, ...(data.watched ?? [])])
              ).filter((id) => !local.removedWatched.includes(id)),
              favourites: Array.from(
                new Set([...local.favourites, ...(data.favourites ?? [])])
              ).filter((id) => !local.removedFavourites.includes(id)),
              removedWatched: local.removedWatched,
              removedFavourites: local.removedFavourites,
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
        if (next.watched.length || next.favourites.length) scheduleSync();
      } catch {
        // sync unavailable; app still works device-locally
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleWatched = useCallback(
    (id: string) => {
      const s = stateRef.current;
      const has = s.watched.includes(id);
      update({
        ...s,
        watched: has ? s.watched.filter((x) => x !== id) : [...s.watched, id],
        removedWatched: has
          ? [...s.removedWatched.filter((x) => x !== id), id]
          : s.removedWatched.filter((x) => x !== id),
      });
      scheduleSync();
    },
    [update, scheduleSync]
  );

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

  const toggleFavourite = useCallback(
    (id: string) => {
      const s = stateRef.current;
      const has = s.favourites.includes(id);
      update({
        ...s,
        favourites: has
          ? s.favourites.filter((x) => x !== id)
          : [...s.favourites, id],
        removedFavourites: has
          ? [...s.removedFavourites.filter((x) => x !== id), id]
          : s.removedFavourites.filter((x) => x !== id),
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
          }),
        });
        if (res.status === 404) return "Code not found";
        if (!res.ok) return "Could not reach sync server";
        const data = await res.json();
        update({
          code,
          watched: data.watched ?? [],
          favourites: data.favourites ?? [],
          removedWatched: [],
          removedFavourites: [],
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
    syncing,
    syncError,
    toggleWatched,
    toggleFavourite,
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
