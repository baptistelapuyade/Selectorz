"use client";

import { useCallback, useState } from "react";

// Sheets/Panels nicht hart wegschneiden: erst Ausblend-Animation (Motion-Muster 03), dann schließen.
export function useClosable(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    if (closing) return;
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return onClose();
    setClosing(true);
    setTimeout(onClose, 150);
  }, [closing, onClose]);
  return { closing, close };
}
