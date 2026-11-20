// Feste Genre-Liste (PRD 14.13): Hauptstile als Chips, Subgenres per Suche und gruppierter Liste. Kein Freitext.
export const MAIN_GENRES = ["House", "Techno", "Disco", "Electro", "Breaks", "Ambient"] as const;

const GROUPS: Record<string, string[]> = {
  House: [
    "House", "Deep House", "Afro House", "Lo-fi House", "Tech House", "Minimal House", "Microhouse", "Progressive House",
    "Acid House", "Chicago House", "Detroit House", "Garage House", "Soulful House", "Jazzy House", "Latin House",
    "Funky House", "French House", "Ghetto House", "Outsider House", "Hard House", "Disco House", "Balearic House",
    "Melodic House", "Organic House", "Amapiano", "Gqom",
  ],
  Techno: [
    "Techno", "Dub Techno", "Hypnotic Techno", "Minimal Techno", "Detroit Techno", "Acid Techno", "Industrial Techno",
    "Hard Techno", "Peak Time Techno", "Melodic Techno", "Raw Techno", "Deep Techno", "Ambient Techno", "Schranz",
    "Hardgroove", "EBM", "Dark Techno", "Rominimal",
  ],
  Disco: [
    "Disco", "Nu-Disco", "Italo Disco", "Cosmic Disco", "Space Disco", "Boogie", "Post-Disco", "Edits", "Afro Disco",
    "Funk", "Soul", "Hi-NRG", "Balearic",
  ],
  Electro: ["Electro", "Electro Funk", "Miami Bass", "Electroclash", "Synthwave", "Italo", "Minimal Wave", "Cold Wave", "New Beat"],
  Breaks: [
    "Breaks", "Breakbeat", "UK Garage", "Speed Garage", "2-Step", "Bassline", "Drum & Bass", "Jungle", "Dubstep",
    "UK Bass", "Grime", "Footwork", "Juke", "Big Beat", "Nu Skool Breaks", "Halftime",
  ],
  Ambient: ["Ambient", "Downtempo", "Chillout", "Dub", "Trip-Hop", "Experimental", "Drone", "Leftfield", "Kosmische", "New Age", "IDM"],
  Global: [
    "Afrobeat", "Afro-Cuban", "Highlife", "Kuduro", "Baile Funk", "Cumbia", "Reggaeton", "Dancehall", "Reggae", "Raï",
    "Baladi", "Arabic Disco", "Tropical", "Latin", "Brazilian", "Global Club",
  ],
  "More dance": [
    "Trance", "Progressive Trance", "Psytrance", "Goa", "Hardcore", "Gabber", "Happy Hardcore", "Eurodance", "Rave",
    "Club", "Jersey Club", "Baltimore Club", "Hyperpop", "Electronica", "Indie Dance", "Dark Disco", "Krautrock",
  ],
  "Hip-Hop and more": ["Hip-Hop", "R&B", "Jazz", "Broken Beat", "Neo Soul", "Pop", "Rock", "Post-Punk", "Synth-Pop"],
};

export type Genre = { name: string; group: string };
export const GENRE_GROUPS = Object.keys(GROUPS);
export const GENRES: Genre[] = Object.entries(GROUPS).flatMap(([group, names]) => names.map((name) => ({ name, group })));

export const PLAYS = ["Vinyl", "USB / CDJ", "Controller", "Live / Hybrid"] as const;
