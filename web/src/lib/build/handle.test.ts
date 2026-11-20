import { describe, expect, it } from "vitest";
import { isHandle } from "@/lib/handles";
import { handleProblem, suggestHandle } from "./handle";

describe("suggestHandle: Handle-Vorschlag aus dem DJ-Namen", () => {
  it("klein, ohne Leerzeichen und Sonderzeichen", () => {
    expect(suggestHandle("Luma Reyes")).toBe("lumareyes");
    expect(suggestHandle("DJ Kofi & Friends!")).toBe("djkofifriends");
  });

  it("Umlaute und Akzente werden zu Grundbuchstaben", () => {
    expect(suggestHandle("Jönsson Élodie")).toBe("jonssonelodie");
    expect(suggestHandle("Straße")).toBe("strasse");
  });

  it("Punkte und Unterstriche dürfen bleiben, aber nicht am Rand", () => {
    expect(suggestHandle("._mira.k_.")).toBe("mira.k");
  });

  it("höchstens 30 Zeichen, Ergebnis ist immer ein gültiges Handle oder leer", () => {
    const long = suggestHandle("A Very Long Name That Goes On And On Forever");
    expect(long.length).toBeLessThanOrEqual(30);
    expect(isHandle(long)).toBe(true);
    expect(suggestHandle("")).toBe("");
    expect(suggestHandle("€€")).toBe("");
  });

  it("reservierte Namen bekommen einen Zusatz", () => {
    expect(suggestHandle("Login")).toBe("login.dj");
    expect(isHandle(suggestHandle("Settings"))).toBe(true);
  });
});

describe("handleProblem: verständliche Meldung beim Tippen", () => {
  it("gültig → keine Meldung", () => {
    expect(handleProblem("lumareyes")).toBeNull();
  });
  it("zu kurz, falsche Zeichen, reserviert", () => {
    expect(handleProblem("ab")).toMatch(/3/);
    expect(handleProblem("Luma Reyes")).toMatch(/letters/i);
    expect(handleProblem("settings")).toMatch(/taken|reserved/i);
    expect(handleProblem(".luma")).toMatch(/start|end/i);
  });
});
