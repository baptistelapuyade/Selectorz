import { describe, expect, it } from "vitest";
import { mapOembed } from "./oembed";

describe("mapOembed: Antwort der Anbieter in Titel, Artist und Namensvorschlag übersetzen", () => {
  it("SoundCloud: „Titel by Name“ wird getrennt", () => {
    expect(mapOembed("soundcloud", { title: "Late Hours Mix by Luma Reyes", author_name: "Luma Reyes" })).toEqual({
      title: "Late Hours Mix",
      artist: "Luma Reyes",
    });
  });

  it("SoundCloud ohne „by“ im Titel bleibt unverändert", () => {
    expect(mapOembed("soundcloud", { title: "Sunday Session 04", author_name: "luma" })).toEqual({ title: "Sunday Session 04", artist: "luma" });
  });

  it("YouTube und Mixcloud übernehmen Titel und Kanal", () => {
    expect(mapOembed("youtube", { title: "Ostkreuz Dub", author_name: "Halden" })).toEqual({ title: "Ostkreuz Dub", artist: "Halden" });
    expect(mapOembed("mixcloud", { title: "Paloma Bar, March", author_name: "Luma Reyes" })).toEqual({ title: "Paloma Bar, March", artist: "Luma Reyes" });
  });

  it("kürzt überlange Angaben und entfernt Steuerzeichen", () => {
    const out = mapOembed("youtube", { title: `A\u0000B${"x".repeat(400)}`, author_name: "y".repeat(400) });
    expect(out?.title.length).toBeLessThanOrEqual(200);
    expect(out?.artist.length).toBeLessThanOrEqual(200);
    expect(out?.title.startsWith("AB")).toBe(true);
  });

  it("ohne Titel gibt es kein Ergebnis (dann Eingabe von Hand)", () => {
    expect(mapOembed("soundcloud", {})).toBeNull();
    expect(mapOembed("soundcloud", { title: "   " })).toBeNull();
    expect(mapOembed("soundcloud", null)).toBeNull();
  });
});
