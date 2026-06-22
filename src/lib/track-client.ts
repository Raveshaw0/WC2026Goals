// Browser tracking module (no server imports). Collects a rich pageview plus
// interaction events and flushes engagement on exit. Driven by <Beacon/>, which
// calls trackPageview() on every navigation (full load or SPA route change).

const VID_KEY = "ats.vid";
const SID_KEY = "ats.sid";
const SLAST_KEY = "ats.slast";
const SENTRY_KEY = "ats.entry";
const SESSION_GAP_MS = 30 * 60 * 1000;

type EventOut = {
  pageview_id: string | null;
  type: string;
  path: string | null;
  target?: string | null;
  value?: number | null;
  meta?: Record<string, unknown> | null;
};

let pageviewId: string | null = null;
let curPath: string | null = null;
let lastPath: string | null = null;
let activeMs = 0;
let lastResume: number | null = null;
let maxScroll = 0;
let deepestSection: string | null = null;
let buffer: EventOut[] = [];
let finalized = false;
let listenersBound = false;
let errorCount = 0;

// ---- ids -------------------------------------------------------------------

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function visitorId(): string {
  try {
    let v = localStorage.getItem(VID_KEY);
    if (!v) { v = uid(); localStorage.setItem(VID_KEY, v); }
    return v;
  } catch {
    return "anon";
  }
}

// Session id with a 30-minute inactivity reset. Also marks whether this is the
// session's entry (first) pageview.
function sessionInfo(): { id: string; isEntry: boolean } {
  try {
    const now = Date.now();
    const last = Number(sessionStorage.getItem(SLAST_KEY) || 0);
    let id = sessionStorage.getItem(SID_KEY);
    let isEntry = false;
    if (!id || now - last > SESSION_GAP_MS) {
      id = uid();
      sessionStorage.setItem(SID_KEY, id);
      sessionStorage.setItem(SENTRY_KEY, "1");
      isEntry = true;
    }
    sessionStorage.setItem(SLAST_KEY, String(now));
    return { id, isEntry };
  } catch {
    return { id: uid(), isEntry: true };
  }
}

// ---- active time -----------------------------------------------------------

function isActive(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}
function resume(): void {
  if (lastResume === null && isActive()) lastResume = performance.now();
}
function pause(): void {
  if (lastResume !== null) {
    activeMs += performance.now() - lastResume;
    lastResume = null;
  }
}

// ---- scroll / deepest section ---------------------------------------------

let scrollScheduled = false;
function onScroll(): void {
  if (scrollScheduled) return;
  scrollScheduled = true;
  requestAnimationFrame(() => {
    scrollScheduled = false;
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    const pct = scrollable <= 0 ? 100 : Math.round(((window.scrollY) / scrollable) * 100);
    const clamped = Math.max(0, Math.min(100, pct));
    if (clamped > maxScroll) maxScroll = clamped;
    // deepest heading scrolled into view (article retention)
    const heads = document.querySelectorAll<HTMLElement>("h2[id], h2.article-h2");
    let deepest: string | null = null;
    const mid = window.innerHeight * 0.6;
    heads.forEach((h) => {
      if (h.getBoundingClientRect().top < mid) {
        deepest = (h.textContent || "").trim().slice(0, 200) || deepest;
      }
    });
    if (deepest) deepestSection = deepest;
  });
}

// scroll milestone events (fired once each)
const firedMilestones = new Set<number>();
function checkMilestones(): void {
  for (const m of [25, 50, 75, 100]) {
    if (maxScroll >= m && !firedMilestones.has(m)) {
      firedMilestones.add(m);
      push({ type: "scroll", value: m });
    }
  }
}

// ---- events ----------------------------------------------------------------

function push(e: Omit<EventOut, "pageview_id" | "path">): void {
  buffer.push({ pageview_id: pageviewId, path: curPath, ...e });
  if (buffer.length >= 12) flushEvents();
}

function onClick(ev: MouseEvent): void {
  const a = (ev.target as HTMLElement | null)?.closest?.("a");
  if (!a) return;
  const href = a.getAttribute("href") || "";
  if (!href || href.startsWith("#")) return;
  let host = "";
  try { host = new URL(href, location.href).host; } catch {}
  const external = host && host !== location.host;
  push({
    type: external ? "click_out" : "click_internal",
    target: href.slice(0, 500),
    meta: { text: (a.textContent || "").trim().slice(0, 80) },
  });
}

function nearestSection(): string | null {
  const heads = document.querySelectorAll<HTMLElement>("h2[id]");
  let cur: string | null = null;
  heads.forEach((h) => {
    if (h.getBoundingClientRect().top < window.innerHeight * 0.5) {
      cur = (h.textContent || "").trim().slice(0, 120) || cur;
    }
  });
  return cur;
}

function onCopy(): void {
  const sel = window.getSelection?.()?.toString() || "";
  if (sel.length < 2) return;
  push({
    type: "copy",
    value: sel.length,
    meta: { section: nearestSection(), text: sel.slice(0, 160) },
  });
}

let selTimer: ReturnType<typeof setTimeout> | null = null;
function onSelect(): void {
  if (selTimer) clearTimeout(selTimer);
  selTimer = setTimeout(() => {
    const sel = window.getSelection?.()?.toString() || "";
    if (sel.length >= 15) {
      push({ type: "highlight", value: sel.length, meta: { section: nearestSection() } });
    }
  }, 600);
}

function onError(ev: ErrorEvent): void {
  if (errorCount >= 3) return;
  errorCount++;
  push({ type: "js_error", target: (ev.message || "").slice(0, 300), meta: { src: (ev.filename || "").slice(0, 200), line: ev.lineno } });
}
function onRejection(ev: PromiseRejectionEvent): void {
  if (errorCount >= 3) return;
  errorCount++;
  const reason = ev.reason;
  push({ type: "js_error", target: String(reason && (reason as Error).message ? (reason as Error).message : reason).slice(0, 300), meta: { kind: "promise" } });
}

// ---- web vitals (lightweight: LCP, CLS, FCP, TTFB) -------------------------

let lcp = 0;
let cls = 0;
function initVitals(): void {
  if (typeof PerformanceObserver === "undefined") return;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) lcp = Math.max(lcp, (e as PerformanceEntry & { renderTime?: number; startTime: number }).startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const ls = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!ls.hadRecentInput) cls += ls.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
}
function vitals(): Record<string, number> {
  const nav = performance.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined;
  const fcp = performance.getEntriesByName?.("first-contentful-paint")?.[0]?.startTime ?? 0;
  return {
    lcp: Math.round(lcp),
    cls: Math.round(cls * 1000) / 1000,
    fcp: Math.round(fcp),
    ttfb: nav ? Math.round(nav.responseStart) : 0,
    mobile: window.innerWidth < 768 ? 1 : 0,
  };
}

// ---- network ---------------------------------------------------------------

function flushEvents(): void {
  if (buffer.length === 0) return;
  const payload = JSON.stringify({
    t: "ev",
    visitor: visitorId(),
    session: sessionInfo().id,
    events: buffer,
  });
  buffer = [];
  send(payload);
}

function send(payload: string): void {
  try {
    if (navigator.sendBeacon && navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }))) return;
  } catch {}
  fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
}

// ---- lifecycle -------------------------------------------------------------

function bindListeners(): void {
  if (listenersBound) return;
  listenersBound = true;
  const onVis = () => { if (isActive()) resume(); else { pause(); finalize(); } };
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("focus", resume);
  window.addEventListener("blur", pause);
  window.addEventListener("pagehide", finalize);
  window.addEventListener("scroll", () => { onScroll(); checkMilestones(); }, { passive: true });
  document.addEventListener("click", onClick, true);
  document.addEventListener("copy", onCopy);
  document.addEventListener("selectionchange", onSelect);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  setInterval(flushEvents, 15000);
  initVitals();
}

function finalize(): void {
  if (finalized || !curPath) return;
  finalized = true;
  pause();
  push({ type: "perf", meta: vitals() });
  flushEvents();
  if (pageviewId) {
    send(JSON.stringify({
      t: "eng",
      id: pageviewId,
      active_ms: Math.round(activeMs),
      max_scroll: maxScroll,
      deepest_section: deepestSection,
    }));
  }
}

function parseUtm(): Record<string, string> {
  const p = new URLSearchParams(location.search);
  const out: Record<string, string> = {};
  for (const k of ["source", "medium", "campaign", "content", "term"]) {
    const v = p.get(`utm_${k}`);
    if (v) out[k] = v.slice(0, 120);
  }
  return out;
}

// Called by <Beacon/> on each navigation.
export async function trackPageview(path: string): Promise<void> {
  // finalize the previous pageview (SPA navigation)
  if (curPath && !finalized) finalize();

  // reset per-pageview state
  curPath = path;
  finalized = false;
  pageviewId = null;
  activeMs = 0;
  lastResume = null;
  maxScroll = 0;
  deepestSection = null;
  firedMilestones.clear();
  errorCount = 0;

  bindListeners();
  resume();

  const session = sessionInfo();
  const isEntry = session.isEntry;
  try { sessionStorage.removeItem(SENTRY_KEY); } catch {}

  const ref = lastPath ? location.origin + lastPath : (document.referrer || null);
  lastPath = path;

  const payload = {
    t: "pv",
    path,
    ref,
    visitor: visitorId(),
    session: session.id,
    is_entry: isEntry,
    utm: parseUtm(),
    screen: [screen.width, screen.height],
    viewport: [window.innerWidth, window.innerHeight],
    lang: navigator.language || null,
    tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return null; } })(),
  };

  try {
    const res = await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (res.ok) {
      const data = (await res.json()) as { id?: string };
      pageviewId = data.id ?? null;
    }
  } catch {
    // ignore; events will just carry a null pageview_id
  }
}
