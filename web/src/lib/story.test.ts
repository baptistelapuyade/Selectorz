import { describe, expect, it } from "vitest";
import { SAFE, STORY_H, STORY_W, fitName, storyUrl } from "./story";

// SHARE-07/09/10/10a: Profil-Story-Karte 9:16, Text außerhalb der verdeckten Zonen
describe("Story-Karte", () => {
  it("ist 1080 × 1920 (9:16)", () => {
    expect([STORY_W, STORY_H]).toEqual([1080, 1920]);
  });

  it("sichere Zone: oben 13 %, unten 17 % bleiben frei von Text", () => {
    expect(SAFE.top).toBe(Math.round(1920 * 0.13));
    expect(SAFE.bottom).toBe(1920 - Math.round(1920 * 0.17));
  });

  // Fake-Messung: jedes Zeichen 0,55 × Schriftgröße breit
  const measure = (text: string, size: number) => text.length * size * 0.55;

  it("kurzer Name: groß, umgebrochen an Leerzeichen", () => {
    const r = fitName("Luma Reyes", 972, measure);
    expect(r.lines).toEqual(["Luma", "Reyes"]);
    expect(r.size).toBe(210);
  });

  it("langer Name wird kleiner statt abgeschnitten, höchstens drei Zeilen", () => {
    const r = fitName("Maximiliane Kowalczyk-Oyelaran", 972, measure);
    expect(r.lines.length).toBeLessThanOrEqual(3);
    for (const l of r.lines) expect(measure(l, r.size)).toBeLessThanOrEqual(972);
    expect(r.lines.join(" ").replace(/\s/g, "")).toBe("MaximilianeKowalczyk-Oyelaran");
    expect(r.size).toBeLessThan(210);
  });

  it("ein sehr langes Wort ohne Leerzeichen passt trotzdem in die Breite", () => {
    const r = fitName("Superkalifragilistischexpialigetisch", 972, measure);
    for (const l of r.lines) expect(measure(l, r.size)).toBeLessThanOrEqual(972);
  });

  it("Kurz-URL als lesbarer Text", () => {
    expect(storyUrl("lumareyes")).toBe("selectorz.art/lumareyes");
  });
});
