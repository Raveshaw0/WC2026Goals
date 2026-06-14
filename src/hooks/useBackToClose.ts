"use client";

import { useEffect, useRef } from "react";

// Make the hardware/browser Back button close an open overlay instead of
// navigating away. On open we push a throwaway history entry; a popstate
// (Back pressed) closes the overlay and consumes that entry. Closing via the
// UI instead pops the entry we added so history stays clean.
export function useBackToClose(onClose: () => void) {
  const cb = useRef(onClose);
  cb.current = onClose;

  useEffect(() => {
    let closedByBack = false;
    window.history.pushState({ wcOverlay: true }, "");
    const onPop = () => {
      closedByBack = true;
      cb.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed via the UI (not Back): drop the entry we pushed so the next
      // real Back goes to the actual previous page.
      if (!closedByBack) window.history.back();
    };
  }, []);
}
