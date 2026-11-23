import { describe, expect, it } from "vitest";
import { ACCENTS, DEFAULT_ACCENT, contrast, isAccent } from "./accents";

// PROFILE-11: Akzentfarbe aus geprüften Kontrastgrenzen (Plan M1b Teil 2: 8 kuratierte Farben pro Look)
describe("Akzentfarben", () => {
  it("je Look genau 8 Farben, eindeutig, im Format #RRGGBB", () => {
    for (const look of ["day", "night"] as const) {
      expect(ACCENTS[look]).toHaveLength(8);
      expect(new Set(ACCENTS[look].map((a) => a.hex)).size).toBe(8);
      for (const a of ACCENTS[look]) expect(a.hex).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("Text auf der Farbe erfüllt WCAG AA (≥ 4,5:1) und die Farbe hebt sich vom Grund ab", () => {
    for (const a of ACCENTS.day) {
      expect(contrast(a.hex, "#111111"), a.name).toBeGreaterThanOrEqual(4.5);
    }
    for (const a of ACCENTS.night) {
      expect(contrast(a.hex, "#0B0B0C"), a.name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("Standardfarben sind die bisherigen (Day Lila, Night Orange)", () => {
    expect(DEFAULT_ACCENT).toEqual({ day: "#8C93FF", night: "#F0532A" });
    expect(isAccent("day", "#8c93ff")).toBe(true);
    expect(isAccent("night", "#8C93FF")).toBe(true);
    expect(isAccent("day", "#123456")).toBe(false);
  });

  it("contrast rechnet wie WCAG", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#777777")).toBeCloseTo(1, 5);
  });
});
