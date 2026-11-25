import { describe, expect, it } from "vitest";
import { bandcampEmbedSrc, parseTimestamp, parseYouTube, seekTarget, soundcloudWidgetSrc } from "./deck";

describe("parseYouTube", () => {
  it("liest die ID aus watch-Links und ignoriert Playlist-Parameter", () => {
    expect(parseYouTube("https://www.youtube.com/watch?v=QTvFzBS6e68&list=RDQTvFzBS6e68&start_radio=1")).toEqual({ id: "QTvFzBS6e68", start: 0 });
  });
  it("liest Kurzlinks und Startzeiten", () => {
    expect(parseYouTube("https://youtu.be/D5LkLmxcgIQ?t=105")).toEqual({ id: "D5LkLmxcgIQ", start: 105 });
    expect(parseYouTube("https://www.youtube.com/watch?v=D5LkLmxcgIQ&t=1m45s")).toEqual({ id: "D5LkLmxcgIQ", start: 105 });
  });
  it("lehnt fremde Hosts und kaputte IDs ab", () => {
    expect(parseYouTube("https://example.com/watch?v=QTvFzBS6e68")).toBeNull();
    expect(parseYouTube("https://www.youtube.com/watch?v=<script>")).toBeNull();
    expect(parseYouTube("kein link")).toBeNull();
  });
});

describe("parseTimestamp", () => {
  it("versteht Sekunden, mm:ss und 1m45s", () => {
    expect(parseTimestamp("105")).toBe(105);
    expect(parseTimestamp("1:45")).toBe(105);
    expect(parseTimestamp("1:02:03")).toBe(3723);
    expect(parseTimestamp("1m45s")).toBe(105);
  });
  it("gibt 0 für Unsinn zurück", () => {
    expect(parseTimestamp("")).toBe(0);
    expect(parseTimestamp("abc")).toBe(0);
    expect(parseTimestamp("-5")).toBe(0);
  });
});

describe("seekTarget", () => {
  it("springt vor und zurück innerhalb der Länge", () => {
    expect(seekTarget(100, 30, 372)).toBe(130);
    expect(seekTarget(10, -15, 372)).toBe(0);
    expect(seekTarget(360, 30, 372)).toBe(371);
  });
  it("ohne bekannte Länge nur nach unten begrenzt", () => {
    expect(seekTarget(100, 30, 0)).toBe(130);
  });
});

describe("Embed-Adressen", () => {
  it("Bandcamp nur mit numerischer Album-ID", () => {
    expect(bandcampEmbedSrc("4186565524")).toBe(
      "https://bandcamp.com/EmbeddedPlayer/album=4186565524/size=large/bgcol=ffffff/linkcol=111111/tracklist=false/artwork=small/transparent=true/",
    );
    expect(bandcampEmbedSrc("12/../x")).toBeNull();
  });
  it("SoundCloud nur für soundcloud.com, ohne Autostart", () => {
    const src = soundcloudWidgetSrc("https://soundcloud.com/data-transmission/spotlight-mix-norm-de-plume");
    expect(src).toContain("https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fdata-transmission%2Fspotlight-mix-norm-de-plume");
    expect(src).toContain("auto_play=false");
    expect(soundcloudWidgetSrc("https://evil.example/x")).toBeNull();
  });
});
