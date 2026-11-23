// Kuratierte Akzentfarben (PROFILE-11, Plan M1b Teil 2): 8 pro Look, Text darauf erfüllt WCAG AA.
// Gleiche Liste in der Datenbank (private.accent_ok, Migration accents).
export type Look = "day" | "night";
export type Accent = { name: string; hex: string };

export const ACCENTS: Record<Look, Accent[]> = {
  day: [
    { name: "Lilac", hex: "#8C93FF" },
    { name: "Sky", hex: "#6EC1FF" },
    { name: "Mint", hex: "#5ED6A8" },
    { name: "Sun", hex: "#FFC845" },
    { name: "Tangerine", hex: "#FF9F4A" },
    { name: "Coral", hex: "#FF8A6B" },
    { name: "Bubblegum", hex: "#FF9BD2" },
    { name: "Lavender", hex: "#C9B8FF" },
  ],
  night: [
    { name: "Ember", hex: "#F0532A" },
    { name: "Red", hex: "#FF5C5C" },
    { name: "Magenta", hex: "#FF5FD2" },
    { name: "Lilac", hex: "#8C93FF" },
    { name: "Cyan", hex: "#3FD0E0" },
    { name: "Mint", hex: "#4FE0A0" },
    { name: "Acid", hex: "#E4F45A" },
    { name: "Gold", hex: "#FFB020" },
  ],
};

export const DEFAULT_ACCENT: Record<Look, string> = { day: "#8C93FF", night: "#F0532A" };

export const isAccent = (look: Look, hex: string) => ACCENTS[look].some((a) => a.hex === hex.toUpperCase());

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

// Kontrastverhältnis nach WCAG 2
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
