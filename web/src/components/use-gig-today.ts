"use client";

import { useEffect, useState } from "react";
import { gigToday } from "@/lib/gigs";

// „Heute“ für Gigs erst im Browser bestimmen (kein new Date() beim Vorrendern, Cache Components).
// Bis dahin null: Die Datenbank liefert öffentlich ohnehin nur kommende Gigs.
export function useGigToday() {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setToday(gigToday());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}
