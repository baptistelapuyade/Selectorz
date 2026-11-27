// Profil-Story-Karte (SHARE-07/09/10/10a): Hochformat 9:16, Text außerhalb der Zonen, die Instagram verdeckt.
export const STORY_W = 1080;
export const STORY_H = 1920;
export const SAFE = { top: Math.round(STORY_H * 0.13), bottom: STORY_H - Math.round(STORY_H * 0.17) };
export const SITE = "selectorz.art";

export const storyUrl = (handle: string) => `${SITE}/${handle}`;

type Measure = (text: string, size: number) => number;

function wrap(words: string[], size: number, width: number, measure: Measure) {
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (!cur || measure(next, size) <= width) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Fließtext in Zeilen umbrechen (statt per maxWidth zu stauchen)
export function wrapLines(text: string, width: number, measure: (t: string) => number) {
  return wrap(text.trim().split(/\s+/), 0, width, (t) => measure(t));
}

// Name möglichst groß, höchstens drei Zeilen; lieber kleiner als abgeschnitten.
// Mit prefer = 2: erst prüfen, ob zwei Zeilen bei mindestens min passen (ruhiger als drei große Zeilen).
export function fitName(name: string, width: number, measure: Measure, max = 210, min = 72, prefer = 3) {
  const words = name.trim().split(/\s+/);
  if (prefer < 3)
    for (let size = max; size >= min; size -= 6) {
      if (words.some((w) => measure(w, size) > width)) continue;
      const lines = wrap(words, size, width, measure);
      if (lines.length <= prefer) return { size, lines };
    }
  for (let size = max; size >= min; size -= 6) {
    if (words.some((w) => measure(w, size) > width)) continue;
    const lines = wrap(words, size, width, measure);
    if (lines.length <= 3) return { size, lines };
  }
  // Notfall: sehr lange Wörter an Zeichen trennen
  const chunks: string[] = [];
  for (const w of words) {
    let rest = w;
    while (rest) {
      let n = rest.length;
      while (n > 1 && measure(rest.slice(0, n), min) > width) n--;
      chunks.push(rest.slice(0, n));
      rest = rest.slice(n);
    }
  }
  return { size: min, lines: wrap(chunks, min, width, measure) };
}
