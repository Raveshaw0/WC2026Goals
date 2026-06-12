"use client";

import { useState } from "react";

import { useUserState } from "@/hooks/useUserState";

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { code, adoptCode, syncError } = useUserState();
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!input.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    const err = await adoptCode(input);
    setBusy(false);
    if (err) {
      setMessage(err);
    } else {
      setMessage("Synced. This device now uses that code.");
      setInput("");
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-zinc-100">Sync</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300"
        >
          Close
        </button>
      </div>
      <div>
        <div className="text-zinc-400">Your sync code</div>
        <div className="mt-1 inline-block rounded-lg bg-cardSoft px-3 py-1.5 font-mono text-base tracking-wide text-accent">
          {code ?? "..."}
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Enter this code on your other devices to sync.
        </p>
      </div>
      <div>
        <label htmlFor="sync-code" className="text-zinc-400">
          Have a code from another device?
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="sync-code"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder="TIGER-42"
            maxLength={15}
            autoComplete="off"
            className="w-36 rounded-lg border border-edge bg-surface px-3 py-1.5 font-mono uppercase text-zinc-200 placeholder:text-zinc-600 focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-lg bg-accent/15 px-3 py-1.5 font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
          >
            {busy ? "Syncing..." : "Use code"}
          </button>
        </div>
        {message && <p className="mt-1 text-xs text-zinc-400">{message}</p>}
        {syncError && !message && (
          <p className="mt-1 text-xs text-amber-400/80">{syncError}</p>
        )}
        <p className="mt-2 text-xs text-zinc-600">
          Watched and favourites from this device are merged in, nothing is
          lost.
        </p>
      </div>
    </div>
  );
}
