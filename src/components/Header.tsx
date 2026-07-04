"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { useSpoiler } from "@/hooks/useSpoiler";

import { ReportButton } from "./ReportButton";
import { SettingsPanel } from "./SettingsPanel";

function NoSpoilersPill() {
  const { noSpoilers, toggle } = useSpoiler();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={noSpoilers}
      title="Hide all scores and results"
      className={
        "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors " +
        (noSpoilers
          ? "border-accent bg-accent/15 text-accent"
          : "border-edge text-zinc-400 hover:text-zinc-200")
      }
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {noSpoilers ? (
          <>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </>
        ) : (
          <>
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
            <circle cx="12" cy="12" r="3" />
          </>
        )}
      </svg>
      <span>No spoilers</span>
    </button>
  );
}

function NavTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = pathname === "/" ? searchParams.get("filter") ?? "all" : null;

  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={
        "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
        (active
          ? "bg-accent/15 text-accent"
          : "text-zinc-400 hover:text-zinc-200")
      }
    >
      {label}
    </Link>
  );

  return (
    <>
      {tab("/", "Schedule", filter === "all")}
      {tab("/groups", "Groups", pathname === "/groups")}
      {tab("/bracket", "Bracket", pathname === "/bracket")}
      {tab("/stats", "Stats", pathname === "/stats")}
      {tab("/?filter=australia", "Australia", filter === "australia")}
      {tab("/?filter=favourites", "Favourites", filter === "favourites")}
    </>
  );
}

function Logo() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // On the exact home view, tapping the logo refreshes (re-fetches scores).
  // From anywhere else (incl. a filtered home), it navigates home.
  const onHomeExact =
    pathname === "/" && !searchParams.get("filter");
  return (
    <Link
      href="/"
      onClick={(e) => {
        if (onHomeExact) {
          e.preventDefault();
          router.refresh();
        }
      }}
      className="mr-auto text-base font-bold tracking-tight"
    >
      <span className="text-accent">WC26</span>
    </Link>
  );
}

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-surface/95 backdrop-blur">
      <div className="mx-auto w-full max-w-3xl px-4 pt-2">
        <div className="flex items-center gap-1">
          <Suspense fallback={<span className="mr-auto text-base font-bold tracking-tight text-accent">WC26</span>}>
            <Logo />
          </Suspense>
          <NoSpoilersPill />
          <ReportButton />
          <button
            type="button"
            aria-label="Settings"
            onClick={() => setSettingsOpen((v) => !v)}
            className="rounded-full p-2 text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
        <nav
          aria-label="Sections"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Suspense fallback={null}>
            <NavTabs />
          </Suspense>
        </nav>
      </div>
      {settingsOpen && (
        <div className="border-t border-edge bg-card">
          <div className="mx-auto w-full max-w-3xl px-4 py-4">
            <SettingsPanel onClose={() => setSettingsOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
}
