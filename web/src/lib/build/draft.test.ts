import { describe, expect, it } from "vitest";
import { GENRES, MAIN_GENRES } from "./genres";
import { emptyDraft, missing, toPayload, type Draft } from "./draft";

const full = (over: Partial<Draft> = {}): Draft => ({
  ...emptyDraft("mix"),
  displayName: "Luma Reyes",
  handle: "lumareyes",
  genres: ["Deep House"],
  photo: { style: "dots", day: "data:image/png;base64,AAAA", night: "data:image/png;base64,BBBB" },
  tracks: [{ url: "https://soundcloud.com/luma/late-hours", title: "Late Hours Mix", artist: "Luma Reyes", provider: "soundcloud" }],
  ...over,
});

describe("Genre-Liste (PRD 14.13: feste Liste, ca. 120, Hauptstile als Chips)", () => {
  it("hat mindestens 100 eindeutige Einträge", () => {
    expect(GENRES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(GENRES.map((g) => g.name.toLowerCase())).size).toBe(GENRES.length);
  });
  it("Hauptstile sind House, Techno, Disco, Electro, Breaks, Ambient", () => {
    expect(MAIN_GENRES).toEqual(["House", "Techno", "Disco", "Electro", "Breaks", "Ambient"]);
  });
});

describe("missing: was fehlt noch zum Veröffentlichen (PROFILE-02/04)", () => {
  it("vollständig → nichts fehlt", () => {
    expect(missing(full())).toEqual([]);
  });
  it("Foto, Genre, Name, Handle und Track sind Pflicht", () => {
    expect(missing(full({ photo: null }))).toEqual(["photo"]);
    expect(missing(full({ genres: [] }))).toEqual(["sound"]);
    expect(missing(full({ displayName: " " }))).toEqual(["name"]);
    expect(missing(full({ handle: "x" }))).toEqual(["handle"]);
    expect(missing(full({ tracks: [] }))).toEqual(["track"]);
  });
  it("ein Track ohne Titel zählt nicht (Abruf gescheitert, noch nicht von Hand ergänzt)", () => {
    expect(missing(full({ tracks: [{ url: "https://example.org/a", title: "", provider: "other" }] }))).toEqual(["track"]);
  });
  it("Stadt und „Plays“ sind freiwillig", () => {
    expect(missing(full({ city: "", plays: [] }))).toEqual([]);
  });
});

describe("toPayload: was an den Server geht", () => {
  it("eigener Mix wird Section „My sound“", () => {
    const p = toPayload(full());
    expect(p.section).toEqual({
      kind: "mix",
      title: "My sound",
      content: { mixes: [{ url: "https://soundcloud.com/luma/late-hours", title: "Late Hours Mix", artist: "Luma Reyes", provider: "soundcloud" }] },
    });
  });
  it("Tracks you love werden „Set openers“ (1 bis 3)", () => {
    const tracks = [1, 2, 3].map((n) => ({ url: `https://soundcloud.com/a/t${n}`, title: `T${n}`, artist: "A", provider: "soundcloud" as const }));
    const p = toPayload(full({ path: "tracks", tracks }));
    expect(p.section.kind).toBe("set_openers");
    expect(p.section.title).toBe("Set openers");
    expect((p.section.content as { tracks: unknown[] }).tracks).toHaveLength(3);
  });
  it("Akzentfarbe geht mit", () => {
    expect(toPayload(full({ look: "night", accent: "#3FD0E0" }))).toMatchObject({ look: "night", accent: "#3FD0E0" });
  });
  it("Texte werden getrimmt, Genres und Plays höchstens drei", () => {
    const p = toPayload(full({ displayName: "  Luma  ", city: " Berlin ", genres: ["A", "B", "C", "D"], plays: ["Vinyl", "USB / CDJ", "Controller", "Live / Hybrid"] }));
    expect(p.displayName).toBe("Luma");
    expect(p.city).toBe("Berlin");
    expect(p.genres).toHaveLength(3);
    expect(p.plays).toHaveLength(3);
  });
  it("das Foto geht nicht im Payload mit (wird separat als Datei hochgeladen), nur der Stil", () => {
    expect(JSON.stringify(toPayload(full()))).not.toContain("data:image");
    expect(toPayload(full()).photoStyle).toBe("dots");
    expect(toPayload(full({ photo: { style: "bw", bw: "data:image/webp;base64,CC" } })).photoStyle).toBe("bw");
  });
});
