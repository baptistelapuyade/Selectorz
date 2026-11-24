import { describe, expect, it } from "vitest";
import { chainMail, type MailEvent } from "./chain-mail";

const ev = (x: Partial<MailEvent>): MailEvent => ({
  id: "e", kind: "your_turn", to: "a@example.com",
  chain: { id: "c1", title: "Slow Sunday", target: 6, count: 2 },
  other: { name: "Kofi Mensah" },
  last: { title: "Glass Floor", artist: "Teodora", comment: "Kept the dub, added a little shine.", mine: false, at: "2026-11-20T12:00:00Z" },
  ...x,
});
const site = "https://www.selectorz.art";

describe("Ketten-Mails", () => {
  it("Zug-Mail wie Board MailTurn: Betreff, Track, ein Button zur Kette, Abmeldelink", () => {
    const m = chainMail(ev({}), site);
    expect(m.subject).toBe("Your turn: Kofi answered");
    expect(m.text).toContain("Track 3 is yours.");
    expect(m.text).toContain("Pick track 3: https://www.selectorz.art/chain/c1");
    expect(m.html.match(/<a href/g)).toHaveLength(2); // Button + „Turn off chain emails“
    expect(m.html).toContain("Glass Floor");
    expect(m.headers["List-Unsubscribe"]).toBe("<https://www.selectorz.art/settings>");
  });
  it("Erinnerung und Abschluss", () => {
    const r = chainMail(ev({ kind: "reminder" }), site, new Date("2026-11-23T12:00:00Z"));
    expect(r.subject).toBe("Kofi is still waiting for your track");
    expect(r.text).toContain("picked by Kofi 3 days ago");
    expect(r.text).toContain("only reminder");
    const c = chainMail(ev({ kind: "completed", chain: { id: "c1", title: "Slow Sunday", target: 6, count: 6 } }), site);
    expect(c.subject).toBe("Slow Sunday is complete");
    expect(c.text).toContain("See your selection");
  });
  it("HTML maskiert Eingaben und enthält keine Empfängeradresse", () => {
    const m = chainMail(ev({ last: { title: "<script>x</script>", artist: "", comment: "", mine: false, at: "" } }), site);
    expect(m.html).not.toContain("<script>x");
    expect(m.html + m.text).not.toContain("a@example.com");
  });
});
