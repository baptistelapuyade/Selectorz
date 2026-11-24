import { describe, expect, it } from "vitest";
import { cleanLink, linkName, shortUrl } from "./links";
import { checkRange, formatTime, parseTime } from "./time";

describe("Zeiten der Transition", () => {
  it("parseTime/formatTime", () => {
    expect(parseTime("47:12")).toBe(2832);
    expect(parseTime("1:02:30")).toBe(3750);
    expect(parseTime("0:05")).toBe(5);
    expect(parseTime("47:72")).toBeNull();
    expect(parseTime("abc")).toBeNull();
    expect(formatTime(2832)).toBe("47:12");
    expect(formatTime(3750)).toBe("1:02:30");
  });
  it("checkRange: Ende nach Start, höchstens 3 Minuten", () => {
    expect(checkRange("47:12", "48:40")).toEqual({ ok: true, start: 2832, end: 2920 });
    expect(checkRange("48:40", "47:12")).toMatchObject({ ok: false });
    expect(checkRange("10:00", "13:01")).toMatchObject({ ok: false, error: expect.stringContaining("3 minutes") });
  });
});

describe("Links", () => {
  it("cleanLink ergänzt https und lehnt Kaputtes ab", () => {
    expect(cleanLink("instagram.com/lumareyes")).toBe("https://instagram.com/lumareyes");
    expect(cleanLink("http://ra.co/dj/luma")).toBe("https://ra.co/dj/luma");
    expect(cleanLink("not a link")).toBeNull();
    expect(cleanLink("localhost")).toBeNull();
  });
  it("linkName aus der Adresse, sonst Website", () => {
    expect(linkName("https://www.instagram.com/luma")).toBe("Instagram");
    expect(linkName("https://ra.co/dj/luma")).toBe("Resident Advisor");
    expect(linkName("https://luma.bandcamp.com")).toBe("Bandcamp");
    expect(linkName("https://lumareyes.com")).toBe("Website");
    expect(shortUrl("https://www.instagram.com/luma/")).toBe("instagram.com/luma");
  });
});
