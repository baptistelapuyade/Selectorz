import type { PublicProfile } from "@/lib/profile";

// Beispieldaten aus den Boards (Luma Reyes). Nur für Vorschau und Tests.
export const SAMPLE_PROFILE: PublicProfile = {
  handle: "lumareyes",
  display_name: "Luma Reyes",
  bio: "Two turntables and a CDJ for edits. Records from Berlin shops, a few promos. Long blends, sets that take their time.",
  city: "Berlin",
  genres: ["House", "Disco", "Minimal"],
  plays: ["Vinyl", "USB", "Live"],
  look: "day",
  accent: "#8C93FF",
  photo_path: null,
  links: [
    { label: "Instagram", url: "https://instagram.com/" },
    { label: "SoundCloud", url: "https://soundcloud.com/" },
    { label: "Mixcloud", url: "https://mixcloud.com/" },
    { label: "Resident Advisor", url: "https://ra.co/" },
    { label: "lumareyes.com", url: "https://example.com/" },
  ],
  sections: [
    { kind: "mix", content: { mixes: [{ url: "https://soundcloud.com/forss/flickermood", title: "Sunday Slow Mix", label: "Groovy House" }] } },
    {
      kind: "star_track",
      content: {
        track: { url: "https://soundcloud.com/forss/flickermood", title: "Ostkreuz Dub", artist: "Halden · Original Mix" },
        note: "The record I keep coming back to. Patient, dubby, and it works at 4am as well as 11pm.",
      },
    },
    {
      kind: "set_openers",
      content: {
        note: "Records I love reaching for early in the night.",
        tracks: [
          { url: "https://soundcloud.com/forss/flickermood", title: "Morning Static", artist: "Tide Archive" },
          { url: "https://mirea.bandcamp.com/track/low-ceiling", title: "Low Ceiling", artist: "Mirea" },
          { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Paper Rooms (Dub)", artist: "Okon & Vale" },
        ],
      },
    },
    {
      kind: "transition",
      content: { url: "https://www.mixcloud.com/spartacus/party-time/", title: "Live at Paloma Bar", start: 2832, end: 2920, note: "Two records, one bassline. Live at Paloma Bar, March." },
    },
    {
      kind: "set_closers",
      content: { tracks: [{ url: "https://soundcloud.com/forss/flickermood", title: "After Hours Choir", artist: "Dalton Pike" }] },
    },
  ],
};
