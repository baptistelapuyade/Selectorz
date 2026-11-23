import { describe, expect, it } from "vitest";
import { fromServer, missing, missingMessage, move, newSection, sameDraft, summary, toPublic, toServer, type EditDraft } from "./model";

const tr = (n: number) => ({ url: `https://soundcloud.com/a/t${n}`, title: `Track ${n}`, provider: "soundcloud" });
const draft = (extra: Partial<EditDraft> = {}): EditDraft => ({
  display_name: "Luma Reyes",
  bio: "",
  city: "Berlin",
  genres: ["House"],
  plays: [],
  look: "day",
  accent: "#8C93FF",
  photo_path: "u/avatar.png",
  photo_style: "dots",
  links: [],
  sections: [{ ...newSection("mix"), content: { mixes: [tr(1)] } }],
  ...extra,
});

describe("Editor-Modell", () => {
  it("move: verschiebt nach oben und unten, ungültige Ziele ändern nichts", () => {
    expect(move(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(move(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(move(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });

  it("toServer lässt die Listen-Schlüssel weg; fromServer setzt eindeutige Schlüssel", () => {
    const d = draft({ sections: [newSection("text"), newSection("set_openers")] });
    const out = toServer(d);
    expect(out.sections.every((s) => !("key" in s))).toBe(true);
    const back = fromServer({ id: "x", handle: "luma", status: "published", published_at: null, changed: false, draft: out });
    expect(new Set(back.draft.sections.map((s) => s.key)).size).toBe(2);
  });

  it("sameDraft ignoriert die Schlüssel, erkennt aber jede inhaltliche Änderung", () => {
    const a = draft();
    const b = { ...a, sections: a.sections.map((s) => ({ ...s, key: "other" })) };
    expect(sameDraft(a, b)).toBe(true);
    expect(sameDraft(a, { ...a, city: "Leipzig" })).toBe(false);
  });

  it("missing: wie publish_profile (Foto, Name, Sound, sichtbare Musik; Text zählt nicht)", () => {
    expect(missing(draft())).toEqual([]);
    const hidden = draft({ sections: [{ ...newSection("mix"), visible: false, content: { mixes: [tr(1)] } }, { ...newSection("text"), content: { text: "hi" } }] });
    expect(missing(hidden)).toEqual(["music"]);
    expect(missing(draft({ photo_path: null, genres: [] }))).toEqual(["photo", "sound"]);
    expect(missingMessage(["photo", "sound"])).toBe("Add a photo and your sound first. Your public page stays as it is.");
  });

  it("toPublic: nur sichtbare, gefüllte Sections in der Vorschau", () => {
    const d = draft({ sections: [newSection("set_closers"), { ...newSection("set_openers"), visible: false, content: { tracks: [tr(2)] } }, ...draft().sections] });
    expect(toPublic("luma", d).sections.map((s) => s.kind)).toEqual(["mix"]);
  });

  it("summary: kurze Beschreibung je Section", () => {
    expect(summary({ ...newSection("set_openers"), content: { tracks: [tr(1), tr(2)] } })).toBe("2 tracks");
    expect(summary({ ...newSection("mix"), content: { mixes: [tr(1)] } })).toBe("1 mix · Track 1");
    expect(summary({ ...newSection("mix"), visible: false })).toBe("Hidden from your page");
    expect(summary(newSection("text"))).toBe("Empty, add a few lines");
  });
});
