"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

export function ReportButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  const submit = async () => {
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), page: pathname }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("sent");
      setMessage("");
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 2000);
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Something is broken"
        title="Something is broken"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-2 text-live/70 transition-colors hover:text-live"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full border-t border-edge bg-card">
          <div className="mx-auto w-full max-w-3xl space-y-2 px-4 py-4 text-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-zinc-100">
                Something is broken?
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                Close
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="What happened? Which match or page?"
              className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:border-accent focus:outline-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">
                {status === "sent" && "Sent, thanks!"}
                {status === "error" && "Could not send, try again"}
              </span>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={status === "sending" || !message.trim()}
                className="rounded-lg bg-live/15 px-3 py-1.5 font-medium text-live transition-colors hover:bg-live/25 disabled:opacity-50"
              >
                {status === "sending" ? "Sending..." : "Send report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
