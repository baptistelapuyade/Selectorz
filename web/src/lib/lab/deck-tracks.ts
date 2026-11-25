// Testdaten für das Labor „Deck“ (/lab/deck). Links vom PO (25.11.2026), Titel per oEmbed geprüft.
// Label/Jahr nur, wo gesichert (Titel, Bandcamp-Seite). Cue-Punkte sind Beispielwerte; auf der Seite lassen sie sich mit „Set cue here“ neu setzen.

type Base = { key: string; title: string; artist: string; label: string; year: string; url: string; uploader: string; color: string; ink: string; cue: number; cueNote: string };
export type LabTrack = (Base & { src: "youtube"; videoId: string }) | (Base & { src: "bandcamp"; albumId: string });

export const LAB_TRACKS: LabTrack[] = [
  {
    key: "deep-burnt", src: "youtube", videoId: "QTvFzBS6e68", title: "Deep Burnt", artist: "Pepe Bradock", label: "", year: "",
    url: "https://www.youtube.com/watch?v=QTvFzBS6e68", uploader: "darrensmooth", color: "#F2F2F0", ink: "#111111", cue: 60, cueNote: "Sample cue",
  },
  {
    key: "sun-cant-compare", src: "youtube", videoId: "tdIQTEYXDP4", title: "The Sun Can't Compare (Long Version)", artist: "Larry Heard presents Mr. White", label: "", year: "",
    url: "https://www.youtube.com/watch?v=tdIQTEYXDP4", uploader: "Streptoccoccus", color: "#E4F45A", ink: "#111111", cue: 45, cueNote: "Sample cue",
  },
  {
    key: "all-nite", src: "bandcamp", albumId: "4186565524", title: "All Nite / Feeling Free", artist: "St. David & Wildbox", label: "Wildbox", year: "2026",
    url: "https://wildbox.bandcamp.com/album/all-nite-feeling-free", uploader: "Wildbox", color: "#1A1A1D", ink: "#F2F2F0", cue: 0, cueNote: "",
  },
  {
    key: "boy-is-bangin", src: "youtube", videoId: "8Zsx5tXdgMY", title: "Boy Is Bangin", artist: "Tafkamp", label: "PALING003", year: "",
    url: "https://www.youtube.com/watch?v=8Zsx5tXdgMY", uploader: "HATE", color: "#F0532A", ink: "#111111", cue: 30, cueNote: "Sample cue",
  },
  {
    key: "routine", src: "youtube", videoId: "D5LkLmxcgIQ", title: "Routine", artist: "Skee Mask", label: "Ilian Tape", year: "",
    url: "https://www.youtube.com/watch?v=D5LkLmxcgIQ", uploader: "ILIAN TAPE", color: "#7FD9C4", ink: "#111111", cue: 40, cueNote: "Sample cue",
  },
];

// Testmix für das SoundCloud-Widget. Im Produkt nur eigene Uploads der DJ (Strategie 24.11.2026).
export const LAB_MIX = {
  url: "https://soundcloud.com/data-transmission/spotlight-mix-norm-de-plume",
  title: "Spotlight Mix: Norm de Plume",
  by: "Data Transmission",
  cue: 600,
};
