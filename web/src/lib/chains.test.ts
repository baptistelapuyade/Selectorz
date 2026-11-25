import { describe, expect, it } from "vitest";
import { firstName, groupOf, roundTitle, statusLine, urlKey, type Round } from "./chains";

const r = (x: Partial<Round>): Round => ({
  id: "1", title: "", state: "active", target: 6, count: 2, my_role: "A", my_turn: true,
  other: { name: "Kofi Mensah", handle: null }, last: null, updated_at: "", ...x,
});

describe("Ketten", () => {
  it("groupOf und statusLine je Zustand", () => {
    expect(groupOf(r({}))).toBe("turn");
    expect(statusLine(r({}))).toBe("Your turn · track 3 of 6");
    expect(statusLine(r({ my_turn: false }))).toBe("Kofi’s turn · track 3 of 6");
    expect(groupOf(r({ state: "waiting_for_partner", other: null, count: 1, my_turn: false }))).toBe("open");
    expect(statusLine(r({ state: "completed", count: 6 }))).toBe("Complete · 6 tracks");
    expect(groupOf(r({ state: "archived" }))).toBe("ended");
  });
  it("roundTitle: eigener Titel, sonst mit wem", () => {
    expect(roundTitle(r({ title: "Slow Sunday" }))).toBe("Slow Sunday");
    expect(roundTitle(r({}))).toBe("With Kofi");
    expect(roundTitle(r({ other: null }))).toBe("New round");
  });
  it("urlKey wie in der Datenbank", () => {
    expect(urlKey("https://www.soundcloud.com/a/b/?si=1#t=3")).toBe("soundcloud.com/a/b");
    expect(urlKey("https://m.youtube.com/watch?v=1")).toBe("youtube.com/watch");
  });
});

describe("pageTracks", () => {
  it("sammelt Tracks ohne Mixe, ohne verborgene, ohne Duplikate", async () => {
    const { pageTracks } = await import("./chains");
    const t = (u: string) => ({ url: `https://soundcloud.com/a/${u}`, title: u, artist: "A" });
    expect(
      pageTracks([
        { kind: "star_track", content: { track: t("one") } },
        { kind: "set_openers", content: { tracks: [t("two"), t("one")] } },
        { kind: "mix", content: { mixes: [t("mix")] } },
        { kind: "tracks", visible: false, content: { tracks: [t("hidden")] } },
      ]).map((x) => x.title),
    ).toEqual(["one", "two"]);
  });
  it("Vorname: DJ-/MC-Präfix bleibt mit dem nächsten Wort zusammen", () => {
    expect(firstName("Kofi Mensah")).toBe("Kofi");
    expect(firstName("Dj Hardcore googoo gaga")).toBe("Dj Hardcore");
    expect(firstName("DJ Koze")).toBe("DJ Koze");
    expect(firstName("MC Lyte")).toBe("MC Lyte");
    expect(firstName("Djrum")).toBe("Djrum");
    expect(firstName("DJ")).toBe("DJ");
  });
});
