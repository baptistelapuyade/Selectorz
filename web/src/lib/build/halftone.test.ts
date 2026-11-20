import { describe, expect, it } from "vitest";
import { cellGrid, dotRadius, radiusFor, tone } from "./halftone";

describe("tone: Helligkeit und Kontrast auf einen Grauwert (0 = schwarz, 1 = weiß)", () => {
  it("neutral lässt den Wert unverändert", () => {
    expect(tone(0.5, 1, 1)).toBeCloseTo(0.5);
    expect(tone(0.2, 1, 1)).toBeCloseTo(0.2);
  });
  it("mehr Kontrast spreizt um die Mitte, bleibt aber in 0..1", () => {
    expect(tone(0.25, 1, 2)).toBeLessThan(0.25);
    expect(tone(0.75, 1, 2)).toBeGreaterThan(0.75);
    expect(tone(0, 1, 5)).toBe(0);
    expect(tone(1, 1, 5)).toBe(1);
  });
  it("mehr Helligkeit hebt an", () => {
    expect(tone(0.4, 1.3, 1)).toBeGreaterThan(0.4);
  });
});

describe("dotRadius: dunkle Stellen = große Punkte, helle = kleine oder keine", () => {
  it("schwarz füllt die Zelle fast, weiß lässt sie leer", () => {
    expect(dotRadius(0, 10)).toBeCloseTo(5 * 0.95, 1);
    expect(dotRadius(1, 10)).toBe(0);
  });
  it("wächst gleichmäßig mit der Dunkelheit", () => {
    const r = [0.9, 0.6, 0.3].map((l) => dotRadius(l, 12));
    expect(r[0]).toBeLessThan(r[1]);
    expect(r[1]).toBeLessThan(r[2]);
  });
  it("sehr kleine Punkte fallen weg (kein Rauschen)", () => {
    expect(dotRadius(0.98, 10)).toBe(0);
  });
});

describe("cellGrid: Raster über das Bild", () => {
  it("gleiche Eingabe ergibt gleiches Raster", () => {
    expect(cellGrid(800, 1000, 10)).toEqual(cellGrid(800, 1000, 10));
  });
  it("deckt das Format 4:5 vollständig ab", () => {
    const g = cellGrid(800, 1000, 10);
    expect(g.cols).toBe(80);
    expect(g.rows).toBe(100);
    expect(g.cell).toBe(10);
  });
  it("Zellgröße wird auf 4 bis 24 px begrenzt", () => {
    expect(cellGrid(800, 1000, 1).cell).toBe(4);
    expect(cellGrid(800, 1000, 99).cell).toBe(24);
  });
});

describe("radiusFor: Day zeichnet Schatten, Night zeichnet Licht (kein Negativ)", () => {
  const n = { brightness: 1, contrast: 1 };
  it("Day: dunkle Stelle = großer Punkt", () => {
    expect(radiusFor(0.1, n, 10, false)).toBeGreaterThan(radiusFor(0.9, n, 10, false));
  });
  it("Night: helle Stelle = großer Punkt", () => {
    expect(radiusFor(0.9, n, 10, true)).toBeGreaterThan(radiusFor(0.1, n, 10, true));
  });
  it("Night ist das Gegenstück zu Day", () => {
    expect(radiusFor(0.2, n, 10, true)).toBeCloseTo(radiusFor(0.8, n, 10, false));
  });
});
