"use client";

import { useCallback, useEffect, useState } from "react";
import { emptyDraft, type Draft } from "@/lib/build/draft";

const KEY = "selectorz.build.v1";

// Entwurf liegt bis zum Login nur in diesem Browser (Plan M1b). Nach dem Veröffentlichen wird er gelöscht.
export function useDraft() {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- einmaliges Laden aus dem Browser nach dem ersten Rendern
      if (raw) {
        const saved = JSON.parse(raw);
        // Fotos aus einer früheren Fassung (nur eine Maske) neu wählen lassen
        if (saved.photo && typeof saved.photo !== "object") saved.photo = null;
        setDraft({ ...emptyDraft(), ...saved });
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      // Speicher voll (z. B. großes Foto): ohne Foto weiter sichern, das Foto bleibt in dieser Sitzung erhalten
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...draft, photo: null }));
      } catch {}
    }
  }, [draft, ready]);

  const update = useCallback((patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => {
    setDraft((d) => ({ ...d, ...(typeof patch === "function" ? patch(d) : patch) }));
  }, []);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }, []);

  return { draft, update, ready, clear };
}
