import { describe, expect, it } from "vitest";
import { cleanTrackUrl, isProfileLink, oembedEndpoint } from "./links";

describe("cleanTrackUrl: Link aus dem Eingabefeld prüfen und bereinigen", () => {
  it("nimmt SoundCloud ohne https:// und ohne www an", () => {
    expect(cleanTrackUrl("soundcloud.com/lumareyes/late-hours")).toEqual({
      url: "https://soundcloud.com/lumareyes/late-hours",
      provider: "soundcloud",
    });
  });

  it("entfernt Tracking-Parameter, behält aber die YouTube-Video-ID", () => {
    expect(cleanTrackUrl(" https://www.youtube.com/watch?v=abc123&si=xyz&utm_source=ig ")).toEqual({
      url: "https://www.youtube.com/watch?v=abc123",
      provider: "youtube",
    });
    expect(cleanTrackUrl("https://soundcloud.com/a/b?si=123&utm_medium=x")?.url).toBe("https://soundcloud.com/a/b");
  });

  it("macht aus http ein https", () => {
    expect(cleanTrackUrl("http://www.mixcloud.com/dj/set/")?.url).toBe("https://www.mixcloud.com/dj/set/");
  });

  it("erkennt Bandcamp und andere Links (dann ohne Abruf, Titel von Hand)", () => {
    expect(cleanTrackUrl("https://halden.bandcamp.com/track/ostkreuz-dub")?.provider).toBe("bandcamp");
    expect(cleanTrackUrl("https://example.org/track/1")?.provider).toBe("other");
  });

  it("weist Unsinn, andere Protokolle und interne Adressen ab", () => {
    for (const bad of ["", "hello", "javascript:alert(1)", "ftp://soundcloud.com/a", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.2/a", "https://user:pw@soundcloud.com/a"]) {
      expect(cleanTrackUrl(bad), bad).toBeNull();
    }
  });

  it("weist zu lange Links ab", () => {
    expect(cleanTrackUrl(`https://soundcloud.com/${"a".repeat(600)}`)).toBeNull();
  });
});

describe("oembedEndpoint: nur offizielle, feste Adressen (kein Scraping, kein freier Abruf)", () => {
  it("kennt SoundCloud, YouTube und Mixcloud", () => {
    expect(oembedEndpoint("soundcloud", "https://soundcloud.com/a/b")).toBe(
      "https://soundcloud.com/oembed?format=json&url=https%3A%2F%2Fsoundcloud.com%2Fa%2Fb",
    );
    expect(oembedEndpoint("youtube", "https://youtu.be/x")).toMatch(/^https:\/\/www\.youtube\.com\/oembed\?format=json&url=/);
    expect(oembedEndpoint("mixcloud", "https://www.mixcloud.com/a/b/")).toMatch(/^https:\/\/app\.mixcloud\.com\/oembed\/\?format=json&url=/);
  });

  it("gibt für Bandcamp und andere nichts zurück", () => {
    expect(oembedEndpoint("bandcamp", "https://x.bandcamp.com/track/y")).toBeNull();
    expect(oembedEndpoint("other", "https://example.org")).toBeNull();
  });
});

describe("isProfileLink: Profil statt Mix eingefügt", () => {
  it("SoundCloud-Profil und Profil-Reiter", () => {
    expect(isProfileLink("https://soundcloud.com/baptistelapuyade", "soundcloud")).toBe(true);
    expect(isProfileLink("https://soundcloud.com/baptistelapuyade/tracks", "soundcloud")).toBe(true);
    expect(isProfileLink("https://soundcloud.com/baptistelapuyade/late-hours", "soundcloud")).toBe(false);
    expect(isProfileLink("https://soundcloud.com/baptistelapuyade/sets/warmups", "soundcloud")).toBe(false);
    expect(isProfileLink("https://on.soundcloud.com/AbC12", "soundcloud")).toBe(false); // Kurzlink auf einen Track
  });
  it("Mixcloud- und YouTube-Profile", () => {
    expect(isProfileLink("https://www.mixcloud.com/luma/", "mixcloud")).toBe(true);
    expect(isProfileLink("https://www.mixcloud.com/luma/paloma-bar/", "mixcloud")).toBe(false);
    expect(isProfileLink("https://www.youtube.com/@halden", "youtube")).toBe(true);
    expect(isProfileLink("https://www.youtube.com/watch?v=abc", "youtube")).toBe(false);
  });
  it("Bandcamp und andere: keine Prüfung", () => {
    expect(isProfileLink("https://halden.bandcamp.com/", "bandcamp")).toBe(false);
  });
});
