import { HANDLE_RE, RESERVED, isHandle } from "@/lib/handles";

// Handle-Vorschlag aus dem DJ-Namen: klein, ohne Akzente, nur a–z, 0–9, Punkt und Unterstrich.
export function suggestHandle(name: string): string {
  let h = name
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9._]/g, "")
    .replace(/[._]{2,}/g, ".")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 30)
    .replace(/[._]+$/g, "");
  if (h.length < 3) return "";
  if (RESERVED.has(h)) h = `${h.slice(0, 27)}.dj`;
  return isHandle(h) ? h : "";
}

// Verständliche Meldung beim Tippen, oder null wenn das Format passt.
export function handleProblem(h: string): string | null {
  if (h.length < 3) return "At least 3 characters.";
  if (h.length > 30) return "30 characters at most.";
  if (/[^a-z0-9._]/.test(h)) return "Only small letters, numbers, dots and underscores.";
  if (/^[._]|[._]$/.test(h)) return "Can't start or end with a dot or underscore.";
  if (!HANDLE_RE.test(h)) return "Only small letters, numbers, dots and underscores.";
  if (RESERVED.has(h)) return "That one is already taken.";
  return null;
}
