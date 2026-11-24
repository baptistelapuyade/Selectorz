"use client";

import { useState } from "react";
import { cleanLink, linkName, MAX_LINKS, shortUrl } from "@/lib/edit/links";
import { move } from "@/lib/edit/model";
import { Arrow, Grip, Panel, useDragList } from "./panel";

type Link = { label: string; url: string };
type Props = { links: Link[]; set: (links: Link[]) => void; onClose: () => void };

// Links (Board EditLinks): einfügen, Name kommt aus der Adresse, umbenennen, sortieren, höchstens 6.
export function LinksPanel({ links, set, onClose }: Props) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const drag = useDragList((a, b) => set(move(links, a, b)));
  const add = () => {
    const url = cleanLink(raw);
    if (!url) return setError("That doesn't look like a link. Paste the full address, like instagram.com/yourname.");
    if (links.some((l) => l.url === url)) return setError("That link is already on your page.");
    set([...links, { label: linkName(url), url }]);
    setRaw("");
    setError(null);
  };
  return (
    <Panel title="Your links" onClose={onClose} note={`${links.length} of ${MAX_LINKS} links · goes live with “Publish changes”`}>
      <p className="text-[15px] leading-[1.45] text-ink-2">Where people can find you. Paste a link, we name it.</p>
      {links.length > 0 && (
        <ol className="flex flex-col gap-2" aria-label="Links">
          {links.map((l, i) => (
            <li key={l.url} {...drag(i)} className="flex items-center gap-2 rounded-l bg-surface py-2 pl-1 pr-2">
              <Grip />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <input
                  aria-label={`Name for ${shortUrl(l.url)}`}
                  value={l.label}
                  maxLength={40}
                  onChange={(e) => set(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  onBlur={(e) => !e.target.value.trim() && set(links.map((x, j) => (j === i ? { ...x, label: linkName(x.url) } : x)))}
                  className="h-8 rounded-[4px] bg-transparent px-1 text-[15px] font-semibold outline-none focus:bg-bg"
                />
                <span className="truncate px-1 text-[12px] text-ink-3">{shortUrl(l.url)}</span>
              </span>
              <Arrow dir="up" label={`Move ${l.label} up`} disabled={i === 0} onClick={() => set(move(links, i, i - 1))} />
              <Arrow dir="down" label={`Move ${l.label} down`} disabled={i === links.length - 1} onClick={() => set(move(links, i, i + 1))} />
              <button type="button" aria-label={`Remove ${l.label}`} onClick={() => set(links.filter((_, j) => j !== i))} className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[20px] text-ink-3 hover:bg-bg">
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
      {links.length < MAX_LINKS ? (
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label htmlFor="new-link" className="text-[14px] font-semibold">New link</label>
          <span className="flex gap-2">
            <input
              id="new-link"
              inputMode="url"
              value={raw}
              placeholder="instagram.com/yourname"
              onChange={(e) => {
                setRaw(e.target.value);
                setError(null);
              }}
              className={`field h-12 min-w-0 flex-1 rounded-s border bg-surface px-3.5 text-[16px] outline-none focus:border-2 focus:border-ink ${error ? "border-2 border-error-border" : "border-field-border"}`}
            />
            <button type="submit" disabled={!raw.trim()} className="h-12 flex-none rounded-full bg-ink px-5 text-[14px] font-semibold text-night-t1 disabled:bg-field-border">
              Add
            </button>
          </span>
          {error && <p role="alert" className="text-[13px] font-semibold text-error-text">{error}</p>}
          <span className="label-mono text-ink-3">{links.length} of {MAX_LINKS}{links.length === MAX_LINKS - 1 ? " · one more link fits" : ""}</span>
        </form>
      ) : (
        <p className="label-mono text-ink-3">{MAX_LINKS} of {MAX_LINKS} · remove one to add another</p>
      )}
    </Panel>
  );
}
