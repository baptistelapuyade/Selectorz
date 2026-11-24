import { describe, expect, it } from "vitest";
import { palette, pickLabel, selectionTitle, stampFor, STAMPS } from "./selection";

describe("Selection", () => {
  it("palette: Akzente der Personen, Rollenfarbe ohne Seite, White label bei gleicher Farbe", () => {
    expect(palette([{ role: "A", color: "#C8F25C" }, { role: "B", color: null }])).toEqual({ white: false, A: "#C8F25C", B: "#F0532A" });
    expect(palette([{ role: "A", color: "#8C93FF" }, { role: "B", color: "#8c93ff" }]).white).toBe(true);
  });
  it("stampFor ist fest pro ID und aus der Liste", () => {
    expect(stampFor("abc")).toBe(stampFor("abc"));
    expect(STAMPS).toContain(stampFor("e0c2"));
  });
  it("Titel fällt auf die Namen zurück, Labels picked/answered", () => {
    expect(selectionTitle({ title: " " }, "Luma Reyes", "Kofi Mensah")).toBe("Luma × Kofi");
    const n = { A: "Luma Reyes", B: "Kofi" };
    expect(pickLabel({ position: 1 }, n, "A")).toBe("Luma picked");
    expect(pickLabel({ position: 2 }, n, "B")).toBe("Kofi answered");
  });
});
