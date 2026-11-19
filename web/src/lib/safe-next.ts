// Nur relative Ziele innerhalb der App erlauben (kein offener Redirect).
export function safeNext(value: unknown, fallback = "/home"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
