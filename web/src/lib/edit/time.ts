// Zeiten für die Proud transition: „47:12“ oder „1:02:30“ ↔ Sekunden
export function parseTime(raw: string): number | null {
  const v = raw.trim();
  if (!/^\d{1,3}(:\d{1,2}){0,2}$/.test(v)) return null;
  const parts = v.split(":").map(Number);
  if (parts.slice(1).some((p) => p > 59)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export const MAX_TRANSITION = 180;

// Prüfung wie in der Datenbank: Start vor Ende, höchstens 3 Minuten
export function checkRange(from: string, to: string): { ok: true; start: number; end: number } | { ok: false; error: string } {
  const start = parseTime(from);
  const end = parseTime(to);
  if (start === null || end === null) return { ok: false, error: "Write times like 47:12 or 1:02:30." };
  if (end <= start) return { ok: false, error: "“To” has to come after “From”." };
  if (end - start > MAX_TRANSITION) return { ok: false, error: "Keep it to 3 minutes or less. Just the blend." };
  return { ok: true, start, end };
}
