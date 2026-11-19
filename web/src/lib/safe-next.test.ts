import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("lässt relative Pfade durch", () => {
    expect(safeNext("/chain/abc?x=1")).toBe("/chain/abc?x=1");
  });
  it("blockiert fremde Ziele (offener Redirect)", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", ""]) {
      expect(safeNext(bad)).toBe("/home");
    }
  });
  it("fällt bei fehlendem Wert zurück", () => {
    expect(safeNext(undefined)).toBe("/home");
    expect(safeNext(["/a"])).toBe("/home");
  });
});
