"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { SettingsPanel } from "./SettingsPanel";

export function Header() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={
        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
        (active
          ? "bg-accent/15 text-accent"
          : "text-zinc-400 hover:text-zinc-200")
      }
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-3">
        <Link href="/" className="mr-auto text-base font-bold tracking-tight">
          <span className="text-accent">WC26</span>
          <span className="text-zinc-400"> Tracker</span>
        </Link>
        {tab("/", "Today", pathname === "/")}
        {tab("/schedule", "Schedule", pathname === "/schedule")}
        <button
          type="button"
          aria-label="Settings"
          onClick={() => setSettingsOpen((v) => !v)}
          className="ml-1 rounded-full p-2 text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
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
