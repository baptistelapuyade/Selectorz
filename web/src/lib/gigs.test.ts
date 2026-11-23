import { describe, expect, it } from "vitest";
import { cleanGigUrl, gigDate, gigLabel, gigToday, linkLabel, played, untilLabel, upcoming } from "./gigs";

describe("Gigs", () => {
  it("Wochentag stimmt immer (06.12.2026 ist ein Sonntag, nicht Samstag)", () => {
    expect(gigDate("2026-12-06")).toMatchObject({ wd: "SUN", day: "06", mon: "DEC" });
    expect(gigDate("2026-11-27").wd).toBe("FRI");
    expect(gigDate("2026-12-31").wd).toBe("THU");
    expect(gigDate("2027-01-09").wd).toBe("SAT");
  });

  it("gigLabel: Jahr nur, wenn es nicht das aktuelle ist", () => {
    expect(gigLabel("2026-12-12", "2026-11-23")).toBe("Sat 12 Dec");
    expect(gigLabel("2027-01-09", "2026-11-23")).toBe("Sat 09 Jan 2027");
  });

  it("gigToday: in Berlin bis 12 Uhr mittags noch der Vortag", () => {
    expect(gigToday(new Date("2026-11-28T10:59:00Z"))).toBe("2026-11-27"); // 11:59 Berlin
    expect(gigToday(new Date("2026-11-28T11:01:00Z"))).toBe("2026-11-28"); // 12:01 Berlin
    expect(gigToday(new Date("2026-07-04T09:30:00Z"))).toBe("2026-07-03"); // Sommerzeit: 11:30
  });

  it("untilLabel und Sortierung kommend/gespielt", () => {
    expect(untilLabel("2026-11-27", "2026-11-23")).toBe("IN 4 DAYS");
    expect(untilLabel("2026-11-24", "2026-11-23")).toBe("TOMORROW");
    expect(untilLabel("2026-11-23", "2026-11-23")).toBe("TONIGHT");
    const g = (date: string) => ({ id: date, date, event: "x", city: "y", url: null });
    const all = [g("2026-12-12"), g("2026-11-20"), g("2026-11-27"), g("2026-11-23")];
    expect(upcoming(all, "2026-11-23").map((x) => x.date)).toEqual(["2026-11-23", "2026-11-27", "2026-12-12"]);
    expect(played(all, "2026-11-23").map((x) => x.date)).toEqual(["2026-11-20"]);
  });

  it("linkLabel aus der Adresse", () => {
    expect(linkLabel("https://ra.co/events/2214")).toBe("RA");
    expect(linkLabel("https://www.instagram.com/p/abc")).toBe("Instagram");
    expect(linkLabel("https://hausderplatten.de/tickets")).toBe("Tickets");
    expect(linkLabel(null)).toBeNull();
  });

  it("cleanGigUrl: ergänzt https, lehnt Kaputtes ab", () => {
    expect(cleanGigUrl("ra.co/events/2214")).toEqual({ ok: true, url: "https://ra.co/events/2214" });
    expect(cleanGigUrl("")).toEqual({ ok: true, url: null });
    expect(cleanGigUrl("ra.co events 2214")).toEqual({ ok: false });
    expect(cleanGigUrl("javascript:alert(1)")).toEqual({ ok: false });
  });
});
